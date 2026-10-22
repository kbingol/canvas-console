# Management API foundation

Node 22.12+ and Fastify 5. All contract imports are type-only; `npm run build -w @canvas-console/api` emits `apps/api/dist/index.js` without a runtime dependency on TypeScript contract sources.

## Run modes

`APP_MODE=demo` is an in-memory local simulation. It binds a loopback host, allows one explicit loopback `WEB_ORIGIN`, rejects non-loopback requests, and refuses production startup. Its model IDs, rates, activity and balances are illustrative. No provider calls or payment processing take place. Demo mutations disappear on restart. `X-Demo-Role: member` can exercise member UI; omitted means local demo admin. The header has no authority in Firebase mode.

Production requires explicit `APP_MODE=firebase`. Firebase Admin uses ADC (`GOOGLE_APPLICATION_CREDENTIALS` may point to an existing external file; never copy it here) and `FIREBASE_PROJECT_ID`. Optional `FIREBASE_TENANT_ID` selects tenant-aware token verification. Every authenticated request verifies the ID token with revocation checks and then loads server-owned membership. Client-supplied roles and workspace IDs are ignored. `ADMIN_UIDS` is a server-only UID allowlist; persisted admin membership is also authoritative. Removing a UID from the environment does not remove a persisted role.

The backend atomically creates this app's user membership and an empty, zero-balance workspace on first authenticated access. It does not seed production models/providers, mint balances, alter Firebase Auth claims, or access existing platform collections. A new Firebase session therefore displays an empty catalogue until server-owned configuration is provisioned separately.

## Data boundary

All Firestore documents live under `canvasConsole/v1`:

- `users/{sha256(tenantId:uid)}`: UID, tenant ID, workspace mapping, server role and account status.
- `workspaces/{derivedId}`: tenant ID, name/email/status, wallet and request count.
- `workspaces/{id}/keys`: owner UID, SHA-256 hash, display prefix, timestamps and revocation status. The raw secret is never stored and appears only in its creation response.
- `workspaces/{id}/usage`, `/ledger`: activity and immutable money entries.
- `workspaces/{id}/reservations`, `/walletOperations`: internal reservation state and immutable idempotency receipts.
- `models`, `providers`: server-owned, tenant-scoped catalogue/configuration. Provider responses explicitly exclude secrets.

Firestore client access should be denied. Firebase Admin bypasses client rules; authorization is enforced in the API. Use a dedicated project/service identity for deployment when practical. Sharing Firebase Auth's project does not grant this application access to the platform's business collections in its code, but service-account IAM itself must still be configured appropriately by the operator.

## Endpoints

| Method/path | Behavior |
| --- | --- |
| `GET /health` | Liveness, mode and `inferenceConfigured:false` |
| `GET /api/overview` | Contract `Overview`; member responses contain no global providers/customers |
| `POST /api/keys` | `{name}` → `201 CreatedKey`; save the one-time secret immediately |
| `DELETE /api/keys/:id` | Revoke a workspace key; `204` |
| `PATCH /api/providers/:id` | Admin only; `{enabled:boolean}` → updated provider |
| `PATCH /api/customers/:id` | Admin only; `{status:'active'|'suspended'}` → updated customer; current workspace cannot suspend itself |
| `POST /api/demo/credit` | Demo only; `{amountMicros?}`, default $25 simulated credit. Optional `Idempotency-Key` prevents repeat application; conflicting replay is `409` |

Errors use `{error:string}`. `WEB_ORIGIN` is a single exact origin. Firebase authentication uses `Authorization: Bearer <Firebase ID token>`. There is no public balance-write, payment, inference or provider-secret setup endpoint.

## Wallet groundwork and limits

Money uses safe integer micro-USD. Internal credit/reserve/settle/release helpers validate available funds, cap settlement to the authorized reservation, and reject conflicting idempotency-key reuse. Firestore commits wallet, operation receipt, reservation and ledger entry in a single transaction; ledger entries are only created, never rewritten. Failed operations commit nothing. These helpers are foundations, not an integrated payment/inference product. The internal credit command is not exposed in Firebase mode; production credit provenance, payment webhooks, provider receipts, reconciliation, rate limits, audit trails and durable async execution still require implementation before taking customer money or accepting model requests.

Tests use Fastify injection and a strict transactional Firestore double. They cover hash-only keys, tenant boundaries, server-only admin checks, production-demo rejection, simulated credit replay and reservation concurrency. They do not contact Firebase or validate deployed IAM/rules. No remote resources are created by tests or build.
