import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type {
  Customer,
  LedgerEntry,
  Model,
  Overview,
  Provider,
  Session,
  UsageRecord,
  Wallet,
} from "@canvas-console/contracts";
import type { Config } from "./config.js";
import {
  ApiError,
  assertAdmin,
  assertTenant,
  digest,
  publicKey,
} from "./domain.js";
import type { Actor, Identity, Repository, StoredKey } from "./domain.js";
import { planWalletCommand, walletOperationId } from "./wallet.js";
import type { Reservation, WalletCommand, WalletReceipt } from "./wallet.js";

export const FIRESTORE_NAMESPACE = "canvasConsole/v1";

export async function verifyIdentity(
  auth: Pick<Auth, "verifyIdToken">,
  bearer: string | undefined,
  tenantId: string,
): Promise<Identity> {
  if (!bearer?.startsWith("Bearer ") || bearer.length > 16_384)
    throw new ApiError(401, "A Firebase ID token is required.");
  let token: DecodedIdToken;
  try {
    token = await auth.verifyIdToken(bearer.slice(7), true);
  } catch {
    throw new ApiError(401, "The sign-in session is invalid or expired.");
  }
  if ((token.firebase?.tenant ?? "") !== tenantId)
    throw new ApiError(403, "Authentication tenant is not allowed.");
  return {
    uid: token.uid,
    email: token.email ?? "",
    name:
      typeof token.name === "string" ? token.name : (token.email ?? "Member"),
    tenantId,
  };
}

function toCustomer(id: string, data: DocumentData): Customer {
  return {
    id,
    name: data.name,
    email: data.email,
    createdAt: data.createdAt,
    status: data.status,
    balanceMicros: data.wallet.balanceMicros,
    requestCount: data.requestCount ?? 0,
  };
}

/** All app data is beneath canvasConsole/v1. No existing platform collections are read or modified. */
export class FirebaseRepository implements Repository {
  private root;
  constructor(private readonly db: Firestore) {
    this.root = db.doc(FIRESTORE_NAMESPACE);
  }
  private workspace(id: string) {
    return this.root.collection("workspaces").doc(id);
  }
  private async assertWorkspace(actor: Actor): Promise<DocumentData> {
    const snapshot = await this.workspace(actor.session.workspaceId).get();
    const data = snapshot.data();
    if (!data || data.tenantId !== actor.tenantId)
      throw new ApiError(404, "Workspace not found.");
    if (data.status !== "active")
      throw new ApiError(403, "Workspace is suspended.");
    return data;
  }
  async authenticate(
    identity: Identity,
    bootstrapAdmin: boolean,
  ): Promise<Actor> {
    const identityId = digest(`${identity.tenantId}:${identity.uid}`);
    const userRef = this.root.collection("users").doc(identityId);
    return this.db.runTransaction(async (tx) => {
      const userSnapshot = await tx.get(userRef);
      const user = userSnapshot.data();
      if (
        user &&
        (user.uid !== identity.uid ||
          user.tenantId !== identity.tenantId ||
          user.status !== "active")
      )
        throw new ApiError(403, "Account access is denied.");
      const workspaceId: string =
        user?.workspaceId ?? `wrk_${identityId.slice(0, 24)}`;
      if (!/^wrk_[a-f0-9]{24}$/.test(workspaceId))
        throw new ApiError(403, "Workspace membership is invalid.");
      const workspaceRef = this.workspace(workspaceId);
      const workspaceSnapshot = await tx.get(workspaceRef);
      const workspace = workspaceSnapshot.data();
      if (user && !workspace)
        throw new ApiError(403, "Workspace membership is invalid.");
      if (workspace) {
        assertTenant(workspace.tenantId, identity.tenantId);
        if (workspace.status !== "active")
          throw new ApiError(403, "Workspace is suspended.");
      }
      const role: Session["role"] =
        bootstrapAdmin || user?.role === "admin" ? "admin" : "member";
      const workspaceName = workspace?.name ?? `${identity.name}'s workspace`;
      if (!userSnapshot.exists) {
        const createdAt = new Date().toISOString();
        tx.create(userRef, {
          ...identity,
          workspaceId,
          role,
          status: "active",
          createdAt,
        });
        if (!workspaceSnapshot.exists)
          tx.create(workspaceRef, {
            name: workspaceName,
            email: identity.email,
            tenantId: identity.tenantId,
            createdAt,
            status: "active",
            requestCount: 0,
            wallet: { balanceMicros: 0, reservedMicros: 0, currency: "USD" },
          });
      }
      return {
        tenantId: identity.tenantId,
        session: {
          uid: identity.uid,
          name: identity.name,
          email: identity.email,
          workspaceId,
          workspaceName,
          role,
          mode: "firebase",
        },
      };
    });
  }
  async overview(actor: Actor): Promise<Overview> {
    const data = await this.assertWorkspace(actor);
    const ref = this.workspace(actor.session.workspaceId);
    const keysQuery =
      actor.session.role === "admin"
        ? ref.collection("keys")
        : ref.collection("keys").where("ownerUid", "==", actor.session.uid);
    const [models, keys, usage, ledger, providers, customers] =
      await Promise.all([
        this.root
          .collection("models")
          .where("tenantId", "==", actor.tenantId)
          .limit(200)
          .get(),
        keysQuery.limit(100).get(),
        ref.collection("usage").orderBy("createdAt", "desc").limit(100).get(),
        ref.collection("ledger").orderBy("createdAt", "desc").limit(100).get(),
        actor.session.role === "admin"
          ? this.root
              .collection("providers")
              .where("tenantId", "==", actor.tenantId)
              .limit(100)
              .get()
          : undefined,
        actor.session.role === "admin"
          ? this.root
              .collection("workspaces")
              .where("tenantId", "==", actor.tenantId)
              .limit(100)
              .get()
          : undefined,
      ]);
    return {
      session: { ...actor.session, workspaceName: data.name },
      models: models.docs.map((doc) => {
        const m = doc.data();
        return {
          id: doc.id,
          name: m.name,
          providerId: m.providerId,
          provider: m.provider,
          kind: m.kind,
          description: m.description,
          nativeId: m.nativeId,
          api: m.api,
          endpoint: m.endpoint,
          inputPrice: m.inputPrice ?? null,
          outputPrice: m.outputPrice ?? null,
          priceUnit: m.priceUnit,
          context: m.context,
          capabilities: m.capabilities ?? [],
        } as Model;
      }),
      keys: keys.docs.map((doc) =>
        publicKey({ ...doc.data(), id: doc.id } as StoredKey),
      ),
      usage: usage.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id }) as UsageRecord,
      ),
      wallet: data.wallet as Wallet,
      ledger: ledger.docs.map(
        (doc) => ({ ...doc.data(), id: doc.id }) as LedgerEntry,
      ),
      providers:
        providers?.docs.map((doc) => {
          const p = doc.data();
          // Explicit allowlist keeps credentials and all server-only fields out of the browser.
          return {
            id: doc.id,
            name: p.name,
            api: p.api,
            baseUrl: p.baseUrl,
            enabled: p.enabled,
            credentialConfigured: Boolean(p.credentialConfigured),
            modelCount: p.modelCount ?? 0,
          } as Provider;
        }) ?? [],
      customers:
        customers?.docs.map((doc) => toCustomer(doc.id, doc.data())) ?? [],
    };
  }
  async createKey(actor: Actor, key: StoredKey): Promise<void> {
    const workspaceRef = this.workspace(actor.session.workspaceId);
    await this.db.runTransaction(async (tx) => {
      const workspace = (await tx.get(workspaceRef)).data();
      if (
        !workspace ||
        workspace.tenantId !== actor.tenantId ||
        workspace.status !== "active"
      )
        throw new ApiError(403, "Workspace access is denied.");
      tx.create(workspaceRef.collection("keys").doc(key.id), key);
    });
  }
  async revokeKey(actor: Actor, id: string): Promise<void> {
    await this.assertWorkspace(actor);
    const ref = this.workspace(actor.session.workspaceId)
      .collection("keys")
      .doc(id);
    await this.db.runTransaction(async (tx) => {
      const key = (await tx.get(ref)).data();
      if (
        !key ||
        (actor.session.role !== "admin" && key.ownerUid !== actor.session.uid)
      )
        throw new ApiError(404, "API key not found.");
      tx.update(ref, {
        status: "revoked",
        revokedAt: new Date().toISOString(),
      });
    });
  }
  async setProvider(
    actor: Actor,
    id: string,
    enabled: boolean,
  ): Promise<Provider> {
    assertAdmin(actor);
    await this.assertWorkspace(actor);
    const ref = this.root.collection("providers").doc(id);
    return this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (!data || data.tenantId !== actor.tenantId)
        throw new ApiError(404, "Provider not found.");
      tx.update(ref, { enabled });
      return {
        id,
        name: data.name,
        api: data.api,
        baseUrl: data.baseUrl,
        enabled,
        credentialConfigured: Boolean(data.credentialConfigured),
        modelCount: data.modelCount ?? 0,
      };
    });
  }
  async setCustomer(
    actor: Actor,
    id: string,
    status: Customer["status"],
  ): Promise<Customer> {
    assertAdmin(actor);
    await this.assertWorkspace(actor);
    if (id === actor.session.workspaceId && status === "suspended")
      throw new ApiError(409, "Cannot suspend the current workspace.");
    const ref = this.workspace(id);
    return this.db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (!data || data.tenantId !== actor.tenantId)
        throw new ApiError(404, "Customer not found.");
      tx.update(ref, { status });
      return toCustomer(id, { ...data, status });
    });
  }
  /** Internal foundation only: no public credit/settle endpoint, inference or payment integration. */
  async walletCommand(actor: Actor, command: WalletCommand): Promise<void> {
    const workspaceRef = this.workspace(actor.session.workspaceId);
    const operationRef = workspaceRef
      .collection("walletOperations")
      .doc(walletOperationId(command.idempotencyKey));
    const reservationRef =
      "reservationId" in command
        ? workspaceRef
            .collection("reservations")
            .doc(digest(command.reservationId))
        : undefined;
    await this.db.runTransaction(async (tx) => {
      // Complete all reads before any writes; Firestore retries on concurrent changes.
      const workspace = (await tx.get(workspaceRef)).data();
      const operation = (await tx.get(operationRef)).data() as
        | WalletReceipt
        | undefined;
      const reservation = reservationRef
        ? ((await tx.get(reservationRef)).data() as Reservation | undefined)
        : undefined;
      if (
        !workspace ||
        workspace.tenantId !== actor.tenantId ||
        workspace.status !== "active"
      )
        throw new ApiError(403, "Workspace access is denied.");
      const plan = planWalletCommand(
        workspace.wallet as Wallet,
        operation,
        reservation,
        command,
      );
      if (plan.replay) return;
      tx.update(workspaceRef, { wallet: plan.wallet });
      tx.create(operationRef, plan.receipt);
      if (plan.reservation && reservationRef)
        tx.set(reservationRef, plan.reservation);
      if (plan.ledger)
        tx.create(
          workspaceRef.collection("ledger").doc(plan.ledger.id),
          plan.ledger,
        );
    });
  }
}

export function firebaseVerifier(
  auth: Pick<Auth, "verifyIdToken">,
  config: Config,
) {
  return (bearer: string | undefined) =>
    verifyIdentity(auth, bearer, config.tenantId);
}
