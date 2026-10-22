import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  ApiKey,
  CreatedKey,
  Customer,
  Overview,
  Provider,
  Session,
} from "@canvas-console/contracts";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export interface Identity {
  uid: string;
  email: string;
  name: string;
  tenantId: string;
}
export interface Actor {
  session: Session;
  tenantId: string;
}
export interface StoredKey extends ApiKey {
  hash: string;
  ownerUid: string;
}
export interface Repository {
  authenticate(identity: Identity, bootstrapAdmin: boolean): Promise<Actor>;
  overview(actor: Actor): Promise<Overview>;
  createKey(actor: Actor, key: StoredKey): Promise<void>;
  revokeKey(actor: Actor, id: string): Promise<void>;
  setProvider(actor: Actor, id: string, enabled: boolean): Promise<Provider>;
  setCustomer(
    actor: Actor,
    id: string,
    status: Customer["status"],
  ): Promise<Customer>;
  demoCredit?(
    actor: Actor,
    amountMicros: number,
    idempotencyKey: string,
  ): Promise<void>;
}
export const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export const opaqueId = (prefix: string): string => `${prefix}_${randomUUID()}`;
export function assertAdmin(actor: Actor): void {
  if (actor.session.role !== "admin")
    throw new ApiError(403, "Administrator access is required.");
}
export function assertTenant(actual: unknown, expected: string): void {
  if (actual !== expected)
    throw new ApiError(403, "Workspace access is denied.");
}
export function issueKey(
  name: string,
  uid: string,
): { stored: StoredKey; created: CreatedKey } {
  const secret = `cc_sk_${randomBytes(32).toString("base64url")}`;
  const key: ApiKey = {
    id: opaqueId("key"),
    name,
    prefix: `${secret.slice(0, 12)}…${secret.slice(-4)}`,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    status: "active",
  };
  return {
    stored: { ...key, hash: digest(secret), ownerUid: uid },
    created: { key, secret },
  };
}
export function publicKey(key: StoredKey): ApiKey {
  const { hash: _hash, ownerUid: _owner, ...publicFields } = key;
  return publicFields;
}
