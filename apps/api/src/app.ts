import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { Customer } from "@canvas-console/contracts";
import type { Config } from "./config.js";
import { isLoopback } from "./config.js";
import { ApiError, assertAdmin, issueKey } from "./domain.js";
import type { Actor, Identity, Repository } from "./domain.js";

declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}
export interface Dependencies {
  repository: Repository;
  verifyToken?: (authorization: string | undefined) => Promise<Identity>;
}
const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({ type: "object", additionalProperties: false, properties, required });
const idParams = objectSchema(
  { id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" } },
  ["id"],
);

export async function buildApp(config: Config, dependencies: Dependencies) {
  const app = Fastify({ bodyLimit: 32_768, trustProxy: false, logger: false });
  app.decorateRequest("actor", null);
  await app.register(cors, {
    origin: config.webOrigin,
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      ...(config.mode === "demo" ? ["X-Demo-Role"] : []),
    ],
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.headers.origin && request.headers.origin !== config.webOrigin)
      throw new ApiError(403, "Origin is not allowed.");
    if (config.mode === "demo" && !isLoopback(request.ip))
      throw new ApiError(403, "Demo access is limited to loopback.");
    reply.header("Cache-Control", "no-store");
  });
  app.get("/health", async () => ({
    status: "ok",
    mode: config.mode,
    inferenceConfigured: false,
  }));
  app.addHook("preHandler", async (request) => {
    if (!request.url.startsWith("/api/")) return;
    let identity: Identity;
    let admin: boolean;
    if (config.mode === "demo") {
      const role = request.headers["x-demo-role"];
      if (role !== undefined && role !== "member" && role !== "admin")
        throw new ApiError(400, "Invalid demo role.");
      identity = {
        uid: "local-demo",
        email: "demo@example.invalid",
        name: "Demo user",
        tenantId: "local-demo",
      };
      admin = role !== "member";
    } else {
      if (!dependencies.verifyToken)
        throw new ApiError(503, "Authentication is not configured.");
      identity = await dependencies.verifyToken(request.headers.authorization);
      if (identity.tenantId !== config.tenantId)
        throw new ApiError(403, "Authentication tenant is not allowed.");
      admin = config.adminUids.has(identity.uid);
    }
    request.actor = await dependencies.repository.authenticate(identity, admin);
  });
  const actor = (request: { actor: Actor | null }): Actor => {
    if (!request.actor) throw new ApiError(401, "Authentication is required.");
    return request.actor;
  };
  app.get("/api/overview", async (request) =>
    dependencies.repository.overview(actor(request)),
  );
  app.post<{ Body: { name: string } }>(
    "/api/keys",
    {
      schema: {
        body: objectSchema(
          { name: { type: "string", minLength: 1, maxLength: 80 } },
          ["name"],
        ),
      },
    },
    async (request, reply) => {
      const name = request.body.name.trim();
      if (!name) throw new ApiError(400, "A key name is required.");
      const a = actor(request);
      const issued = issueKey(name, a.session.uid);
      await dependencies.repository.createKey(a, issued.stored);
      return reply.code(201).send(issued.created);
    },
  );
  app.delete<{ Params: { id: string } }>(
    "/api/keys/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      await dependencies.repository.revokeKey(
        actor(request),
        request.params.id,
      );
      return reply.code(204).send();
    },
  );
  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>(
    "/api/providers/:id",
    {
      schema: {
        params: idParams,
        body: objectSchema({ enabled: { type: "boolean" } }, ["enabled"]),
      },
    },
    async (request) => {
      const a = actor(request);
      assertAdmin(a);
      return dependencies.repository.setProvider(
        a,
        request.params.id,
        request.body.enabled,
      );
    },
  );
  app.patch<{ Params: { id: string }; Body: { status: Customer["status"] } }>(
    "/api/customers/:id",
    {
      schema: {
        params: idParams,
        body: objectSchema({ status: { enum: ["active", "suspended"] } }, [
          "status",
        ]),
      },
    },
    async (request) => {
      const a = actor(request);
      assertAdmin(a);
      return dependencies.repository.setCustomer(
        a,
        request.params.id,
        request.body.status,
      );
    },
  );
  app.post<{ Body: { amountMicros?: number } }>(
    "/api/demo/credit",
    {
      schema: {
        body: objectSchema({
          amountMicros: { type: "integer", minimum: 1, maximum: 1_000_000_000 },
        }),
      },
    },
    async (request) => {
      if (config.mode !== "demo" || !dependencies.repository.demoCredit)
        throw new ApiError(404, "Not found.");
      const key = request.headers["idempotency-key"] ?? randomUUID();
      if (typeof key !== "string" || key.length > 200)
        throw new ApiError(400, "Invalid idempotency key.");
      const a = actor(request);
      await dependencies.repository.demoCredit(
        a,
        request.body.amountMicros ?? 25_000_000,
        key,
      );
      const overview = await dependencies.repository.overview(a);
      return {
        simulated: true,
        message: "Demo credit only. No payment was processed.",
        wallet: overview.wallet,
        ledger: overview.ledger,
      };
    },
  );
  app.setErrorHandler((error, _request, reply) => {
    const details =
      error && typeof error === "object"
        ? (error as { statusCode?: unknown; validation?: unknown })
        : {};
    const status =
      error instanceof ApiError
        ? error.statusCode
        : details.validation
          ? 400
          : typeof details.statusCode === "number" &&
              details.statusCode >= 400 &&
              details.statusCode < 500
            ? details.statusCode
            : 500;
    const safeMessages: Record<number, string> = {
      400: "Invalid request.",
      401: "Authentication is required.",
      403: "Access is denied.",
      404: "Not found.",
      413: "Request body is too large.",
      415: "Unsupported media type.",
      429: "Too many requests.",
    };
    const message =
      error instanceof ApiError
        ? error.message
        : (safeMessages[status] ?? "The request could not be completed.");
    reply.code(status).send({ error: message });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply
      .code(404)
      .send({ error: "Route not found. Model inference is not implemented." }),
  );
  return app;
}
