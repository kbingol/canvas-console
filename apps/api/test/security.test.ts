import assert from "node:assert/strict";
import { test } from "node:test";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { buildApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { DemoRepository } from "../src/demo.js";
import { digest, issueKey } from "../src/domain.js";
import { verifyIdentity } from "../src/firebase.js";

test("production cannot silently start the demo or enable emulator credentials", () => {
  assert.throws(() => readConfig({ NODE_ENV: "production" }), /explicitly/);
  assert.throws(
    () => readConfig({ NODE_ENV: "production", APP_MODE: "demo" }),
    /development-only/,
  );
  assert.throws(
    () => readConfig({ APP_MODE: "demo", HOST: "0.0.0.0" }),
    /loopback/,
  );
  assert.throws(
    () =>
      readConfig({ APP_MODE: "demo", WEB_ORIGIN: "https://public.example" }),
    /loopback/,
  );
  assert.throws(
    () =>
      readConfig({
        APP_MODE: "firebase",
        FIREBASE_PROJECT_ID: "test",
        NODE_ENV: "production",
        FIRESTORE_EMULATOR_HOST: "localhost:9000",
      }),
    /emulator/,
  );
});

test("one-time keys contain 256 random bits; repository only receives their hash", () => {
  const a = issueKey("Production", "user-a");
  const b = issueKey("Production", "user-a");
  assert.notEqual(a.created.secret, b.created.secret);
  assert.equal(Buffer.from(a.created.secret.slice(6), "base64url").length, 32);
  assert.equal(a.stored.hash, digest(a.created.secret));
  assert.equal(JSON.stringify(a.stored).includes(a.created.secret), false);
  assert.equal("hash" in a.created.key, false);
});

test("Firebase verification checks revocation and expected tenant; claims never select the role", async () => {
  const calls: unknown[][] = [];
  const auth = {
    verifyIdToken: async (...args: unknown[]) => {
      calls.push(args);
      return {
        uid: "member",
        email: "m@example.invalid",
        admin: true,
        firebase: { tenant: "tenant-a" },
      } as unknown as DecodedIdToken;
    },
  } as Pick<Auth, "verifyIdToken">;
  const identity = await verifyIdentity(auth, "Bearer valid-token", "tenant-a");
  assert.deepEqual(calls, [["valid-token", true]]);
  assert.equal("role" in identity, false);
  await assert.rejects(
    verifyIdentity(auth, "Bearer valid-token", "tenant-b"),
    /tenant/,
  );
  await assert.rejects(verifyIdentity(auth, undefined, "tenant-a"), /required/);
});

test("workspace keys and customer administration cannot cross a tenant boundary", async () => {
  const repo = new DemoRepository();
  const a = await repo.authenticate(
    { uid: "a", email: "a@example.invalid", name: "A", tenantId: "tenant-a" },
    true,
  );
  const b = await repo.authenticate(
    { uid: "b", email: "b@example.invalid", name: "B", tenantId: "tenant-b" },
    true,
  );
  const key = issueKey("Tenant A secret", a.session.uid);
  await repo.createKey(a, key.stored);
  await assert.rejects(repo.revokeKey(b, key.stored.id), /not found/);
  await assert.rejects(
    repo.setCustomer(a, b.session.workspaceId, "suspended"),
    /not found/,
  );
  const result = await repo.overview(b);
  assert.equal(result.keys.length, 0);
  assert.equal(result.customers.length, 4);
  assert.ok(
    result.customers.some((customer) => customer.id === b.session.workspaceId),
  );
  assert.equal(
    result.customers.some((customer) => customer.id === a.session.workspaceId),
    false,
  );
  const own = await repo.overview(a);
  assert.equal(
    own.customers.some((customer) =>
      result.customers.some((other) => other.id === customer.id),
    ),
    false,
  );
  const sample = own.customers.find(
    (customer) => customer.id !== a.session.workspaceId,
  )!;
  assert.equal(
    (await repo.setCustomer(a, sample.id, "suspended")).status,
    "suspended",
  );
  await assert.rejects(
    repo.setCustomer(a, a.session.workspaceId, "suspended"),
    /current workspace/,
  );
});

test("HTTP role checks ignore demo role headers in Firebase mode, and block simulated credits", async (t) => {
  const config = readConfig({
    APP_MODE: "firebase",
    FIREBASE_PROJECT_ID: "test",
    ADMIN_UIDS: "admin",
  });
  const app = await buildApp(config, {
    repository: new DemoRepository(),
    verifyToken: async (header) => {
      if (header !== "Bearer member" && header !== "Bearer admin")
        throw new Error("Invalid token");
      return {
        uid: header.slice(7),
        email: "user@example.invalid",
        name: "User",
        tenantId: "",
      };
    },
  });
  t.after(() => app.close());
  const member = { authorization: "Bearer member", "x-demo-role": "admin" };
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: "/api/providers/google",
        headers: member,
        payload: { enabled: false },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/demo/credit",
        headers: member,
        payload: {},
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await app.inject({
        method: "PATCH",
        url: "/api/providers/google",
        headers: { authorization: "Bearer admin" },
        payload: { enabled: false },
      })
    ).statusCode,
    200,
  );
  const result = (
    await app.inject({ url: "/api/overview", headers: member })
  ).json();
  assert.deepEqual(result.providers, []);
  assert.deepEqual(result.customers, []);
});

test("HTTP demo creates/revokes keys, credits idempotently, and accepts only the configured browser origin", async (t) => {
  const app = await buildApp(readConfig({ APP_MODE: "demo" }), {
    repository: new DemoRepository(),
  });
  t.after(() => app.close());
  const created = await app.inject({
    method: "POST",
    url: "/api/keys",
    payload: { name: "Local test" },
  });
  assert.equal(created.statusCode, 201);
  const data = created.json();
  const overview = (await app.inject("/api/overview")).json();
  assert.equal(JSON.stringify(overview).includes(data.secret), false);
  assert.equal(JSON.stringify(overview).includes(digest(data.secret)), false);
  assert.equal(
    (await app.inject({ method: "DELETE", url: `/api/keys/${data.key.id}` }))
      .statusCode,
    204,
  );
  assert.equal(
    (await app.inject("/api/overview")).json().keys[0].status,
    "revoked",
  );
  const payload = { amountMicros: 7_000_000 };
  const credit = {
    method: "POST" as const,
    url: "/api/demo/credit",
    payload,
    headers: { "idempotency-key": "same-credit" },
  };
  const first = (await app.inject(credit)).json();
  const second = (await app.inject(credit)).json();
  assert.equal(first.simulated, true);
  assert.equal(first.wallet.balanceMicros, second.wallet.balanceMicros);
  assert.equal(first.ledger.length, second.ledger.length);
  assert.equal(
    (await app.inject({ ...credit, payload: { amountMicros: 1 } })).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        url: "/api/overview",
        headers: { origin: "https://other.example" },
      })
    ).statusCode,
    403,
  );
  const browser = await app.inject({
    url: "/api/overview",
    headers: { origin: "http://localhost:5173" },
  });
  assert.equal(
    browser.headers["access-control-allow-origin"],
    "http://localhost:5173",
  );
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/v1/chat/completions",
        payload: {},
      })
    ).statusCode,
    404,
  );
});

test("HTTP parser errors retain 400/413/415 without exposing parser or server details", async (t) => {
  const app = await buildApp(readConfig({ APP_MODE: "demo" }), {
    repository: new DemoRepository(),
  });
  t.after(() => app.close());
  const malformed = await app.inject({
    method: "POST",
    url: "/api/keys",
    headers: { "content-type": "application/json" },
    payload: "{broken-json",
  });
  assert.equal(malformed.statusCode, 400);
  assert.deepEqual(malformed.json(), { error: "Invalid request." });
  const oversized = await app.inject({
    method: "POST",
    url: "/api/keys",
    payload: { name: "x".repeat(40_000) },
  });
  assert.equal(oversized.statusCode, 413);
  assert.deepEqual(oversized.json(), { error: "Request body is too large." });
  const unsupported = await app.inject({
    method: "POST",
    url: "/api/keys",
    headers: { "content-type": "application/x-unsupported" },
    payload: "private request content",
  });
  assert.equal(unsupported.statusCode, 415);
  assert.deepEqual(unsupported.json(), { error: "Unsupported media type." });
});
