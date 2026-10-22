import assert from "node:assert/strict";
import { test } from "node:test";
import type { Firestore } from "firebase-admin/firestore";
import { DemoRepository } from "../src/demo.js";
import { FirebaseRepository, FIRESTORE_NAMESPACE } from "../src/firebase.js";
import { digest } from "../src/domain.js";
import { planWalletCommand } from "../src/wallet.js";
import type { Wallet } from "@canvas-console/contracts";

const wallet: Wallet = {
  balanceMicros: 100,
  reservedMicros: 0,
  currency: "USD",
};

test("reservation bounds protect available funds and settlement cannot exceed authorization", () => {
  const reserve = planWalletCommand(wallet, undefined, undefined, {
    kind: "reserve",
    amountMicros: 80,
    reservationId: "job-a",
    idempotencyKey: "reserve-a",
  });
  assert.throws(
    () =>
      planWalletCommand(reserve.wallet, undefined, undefined, {
        kind: "reserve",
        amountMicros: 30,
        reservationId: "job-b",
        idempotencyKey: "reserve-b",
      }),
    /Insufficient/,
  );
  assert.throws(
    () =>
      planWalletCommand(reserve.wallet, undefined, reserve.reservation, {
        kind: "settle",
        amountMicros: 81,
        reservationId: "job-a",
        idempotencyKey: "settle-a",
      }),
    /exceeds/,
  );
  const settleCommand = {
    kind: "settle" as const,
    amountMicros: 60,
    reservationId: "job-a",
    idempotencyKey: "settle-a",
  };
  const settled = planWalletCommand(
    reserve.wallet,
    undefined,
    reserve.reservation,
    settleCommand,
  );
  assert.deepEqual(settled.wallet, {
    balanceMicros: 40,
    reservedMicros: 0,
    currency: "USD",
  });
  assert.equal(settled.ledger?.amountMicros, -60);
  const replay = planWalletCommand(
    settled.wallet,
    settled.receipt,
    settled.reservation,
    settleCommand,
  );
  assert.equal(replay.replay, true);
  assert.equal(replay.ledger, undefined);
  assert.throws(
    () =>
      planWalletCommand(settled.wallet, undefined, settled.reservation, {
        kind: "release",
        reservationId: "job-a",
        idempotencyKey: "release-a",
      }),
    /active reservation/,
  );
  assert.throws(
    () =>
      planWalletCommand(wallet, undefined, undefined, {
        kind: "credit",
        amountMicros: 0.01,
        idempotencyKey: "fraction",
      }),
    /integer/,
  );
});

test("parallel local reservations cannot overdraw the wallet", async () => {
  const repo = new DemoRepository();
  const actor = await repo.authenticate(
    { uid: "local", email: "", name: "Local", tenantId: "local" },
    false,
  );
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) =>
      repo.walletCommand(actor, {
        kind: "reserve",
        amountMicros: 10_000_000,
        reservationId: `job-${i}`,
        idempotencyKey: `reserve-${i}`,
      }),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 12);
  const overview = await repo.overview(actor);
  assert.equal(overview.wallet.reservedMicros, 120_000_000);
  assert.equal(overview.wallet.balanceMicros, 125_000_000);
});

/** Strict transactional double: no Google calls, commits atomically, rejects reads after writes. */
class TransactionDatabase {
  records = new Map<string, Record<string, unknown>>();
  private tail = Promise.resolve();
  doc = (path: string): any => ({
    path,
    collection: (name: string) => ({
      doc: (id: string) => this.doc(`${path}/${name}/${id}`),
    }),
  });
  runTransaction = async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: { path: string }) => {
        assert.equal(
          writes.length,
          0,
          "Firestore transactions require all reads before writes",
        );
        assert.ok(ref.path.startsWith(`${FIRESTORE_NAMESPACE}/`));
        const data = structuredClone(this.records.get(ref.path));
        return { exists: data !== undefined, data: () => data };
      },
      create: (ref: { path: string }, data: Record<string, unknown>) => {
        assert.equal(this.records.has(ref.path), false);
        writes.push(() => {
          this.records.set(ref.path, structuredClone(data));
        });
      },
      update: (ref: { path: string }, data: Record<string, unknown>) =>
        writes.push(() => {
          this.records.set(ref.path, {
            ...this.records.get(ref.path),
            ...structuredClone(data),
          });
        }),
      set: (ref: { path: string }, data: Record<string, unknown>) =>
        writes.push(() => {
          this.records.set(ref.path, structuredClone(data));
        }),
    };
    try {
      const value = await callback(tx);
      writes.forEach((write) => write());
      return value;
    } finally {
      release();
    }
  };
}

test("Firestore bootstrap/credit/reserve/settle are namespaced, atomic and replay-safe", async () => {
  const db = new TransactionDatabase();
  const repo = new FirebaseRepository(db as unknown as Firestore);
  const identity = {
    uid: "firebase-member",
    email: "m@example.invalid",
    name: "Member",
    tenantId: "tenant-a",
  };
  const [a, b] = await Promise.all([
    repo.authenticate(identity, false),
    repo.authenticate(identity, false),
  ]);
  assert.equal(a.session.workspaceId, b.session.workspaceId);
  assert.equal(a.session.role, "member");
  const base = `${FIRESTORE_NAMESPACE}/workspaces/${a.session.workspaceId}`;
  assert.equal(db.records.size, 2);
  const credit = {
    kind: "credit" as const,
    amountMicros: 100,
    idempotencyKey: "payment-receipt-1",
  };
  await Promise.all([
    repo.walletCommand(a, credit),
    repo.walletCommand(a, credit),
  ]);
  assert.equal((db.records.get(base)?.wallet as Wallet).balanceMicros, 100);
  assert.equal(
    [...db.records.keys()].filter((key) => key.includes("/ledger/")).length,
    1,
  );
  await repo.walletCommand(a, {
    kind: "reserve",
    amountMicros: 70,
    reservationId: "job",
    idempotencyKey: "reserve-job",
  });
  await assert.rejects(
    repo.walletCommand(a, {
      kind: "reserve",
      amountMicros: 40,
      reservationId: "job-2",
      idempotencyKey: "reserve-job-2",
    }),
    /Insufficient/,
  );
  const settle = {
    kind: "settle" as const,
    amountMicros: 60,
    reservationId: "job",
    idempotencyKey: "settle-job",
  };
  await repo.walletCommand(a, settle);
  await repo.walletCommand(a, settle);
  assert.deepEqual(db.records.get(base)?.wallet, {
    balanceMicros: 40,
    reservedMicros: 0,
    currency: "USD",
  });
  assert.equal(
    db.records.get(`${base}/reservations/${digest("job")}`)?.status,
    "settled",
  );
  const before = JSON.stringify([...db.records]);
  await assert.rejects(
    repo.walletCommand(
      { ...a, tenantId: "tenant-b" },
      { kind: "credit", amountMicros: 1, idempotencyKey: "evil" },
    ),
    /denied/,
  );
  assert.equal(JSON.stringify([...db.records]), before);
});
