import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { DemoRepository } from "./demo.js";
import { FirebaseRepository, firebaseVerifier } from "./firebase.js";

try {
  const config = readConfig();
  const firebaseApp =
    config.mode === "firebase"
      ? (getApps().find((app) => app.name === "canvas-console") ??
        initializeApp(
          { projectId: config.projectId, credential: applicationDefault() },
          "canvas-console",
        ))
      : undefined;
  const auth = firebaseApp ? getAuth(firebaseApp) : undefined;
  const tokenAuth =
    auth && config.tenantId
      ? auth.tenantManager().authForTenant(config.tenantId)
      : auth;
  const app = await buildApp(
    config,
    firebaseApp && tokenAuth
      ? {
          repository: new FirebaseRepository(getFirestore(firebaseApp)),
          verifyToken: firebaseVerifier(tokenAuth, config),
        }
      : { repository: new DemoRepository() },
  );
  await app.listen({ host: config.host, port: config.port });
  process.stdout.write(
    `Canvas Console API listening on ${config.host}:${config.port} (${config.mode}).\n`,
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
} catch (error) {
  // Do not print ADC/SDK errors, tokens, request bodies or credential filesystem paths.
  const message =
    error instanceof Error &&
    /APP_MODE|Demo mode|WEB_ORIGIN|PORT|FIREBASE_PROJECT_ID|emulator/.test(
      error.message,
    )
      ? error.message
      : "API startup failed. Check server configuration and credentials.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
