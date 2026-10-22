import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

let instance: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (instance) return instance;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId)
    throw new Error(
      "Firebase bağlantı bilgileri eksik. apps/web/.env.local dosyasını kontrol edin.",
    );
  const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && import.meta.env.PROD)
    throw new Error("Üretim derlemesinde Auth emülatörü kullanılamaz.");
  const app = initializeApp(
    {
      apiKey,
      projectId,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    },
    "canvas-console",
  );
  const auth = getAuth(app);
  auth.tenantId = import.meta.env.VITE_FIREBASE_TENANT_ID || null;
  if (emulator) {
    connectAuthEmulator(auth, emulator, { disableWarnings: true });
  }
  instance = auth;
  return instance;
}
