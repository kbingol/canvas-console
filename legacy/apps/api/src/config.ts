export interface Config {
  mode: "demo" | "firebase";
  host: string;
  port: number;
  webOrigin: string;
  projectId?: string;
  tenantId: string;
  adminUids: ReadonlySet<string>;
}

export function isLoopback(value: string): boolean {
  return [
    "localhost",
    "127.0.0.1",
    "::1",
    "[::1]",
    "::ffff:127.0.0.1",
  ].includes(value.toLowerCase());
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = env.APP_MODE ?? (env.NODE_ENV === "production" ? "" : "demo");
  if (mode !== "demo" && mode !== "firebase")
    throw new Error("APP_MODE must explicitly be firebase in production.");
  const host = env.HOST ?? "127.0.0.1";
  const port = Number(env.PORT ?? "8080");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be a valid TCP port.");
  const webOrigin = env.WEB_ORIGIN ?? "http://localhost:5173";
  const origin = new URL(webOrigin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== webOrigin ||
    origin.username ||
    origin.password
  )
    throw new Error("WEB_ORIGIN must be one exact HTTP(S) origin.");
  if (
    mode === "demo" &&
    (![undefined, "development", "test"].includes(env.NODE_ENV) ||
      !isLoopback(host) ||
      !isLoopback(origin.hostname))
  )
    throw new Error(
      "Demo mode is development-only and requires a loopback host and web origin.",
    );
  if (mode === "firebase" && !env.FIREBASE_PROJECT_ID)
    throw new Error("FIREBASE_PROJECT_ID is required.");
  if (
    env.NODE_ENV === "production" &&
    (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST)
  )
    throw new Error(
      "Firebase emulator settings are not allowed in production.",
    );
  return {
    mode,
    host,
    port,
    webOrigin,
    projectId: env.FIREBASE_PROJECT_ID,
    tenantId: env.FIREBASE_TENANT_ID ?? "",
    adminUids: new Set(
      (env.ADMIN_UIDS ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  };
}
