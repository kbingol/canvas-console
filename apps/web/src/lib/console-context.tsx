import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  MessageBar,
  MessageBarBody,
  Spinner,
} from "@fluentui/react-components";
import type { User } from "firebase/auth";
import type { CreatedKey, Overview } from "@canvas-console/contracts";

const mode = import.meta.env.VITE_APP_MODE || "demo";
const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
async function firebaseClient() {
  const [sdk, config] = await Promise.all([
    import("firebase/auth"),
    import("./firebase"),
  ]);
  return { sdk, auth: config.getFirebaseAuth() };
}
interface ConsoleContextValue {
  data: Overview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createKey: (name: string) => Promise<CreatedKey>;
  revokeKey: (id: string) => Promise<void>;
  setProviderEnabled: (id: string, enabled: boolean) => Promise<void>;
  setCustomerStatus: (
    id: string,
    status: "active" | "suspended",
  ) => Promise<void>;
  addDemoCredit: () => Promise<void>;
  signOut: () => Promise<void>;
}
const ConsoleContext = createContext<ConsoleContextValue | null>(null);
export function useConsole() {
  const value = useContext(ConsoleContext);
  if (!value) throw new Error("ConsoleProvider bulunamadı.");
  return value;
}

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(mode === "demo");
  const [demoSignedOut, setDemoSignedOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const authIdentity = useRef<User | null>(null);

  useEffect(() => {
    if (mode === "demo") return;
    if (mode !== "firebase") {
      setAuthError("VITE_APP_MODE demo veya firebase olmalı.");
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void firebaseClient()
      .then(({ sdk, auth }) => {
        if (cancelled) return;
        unsubscribe = sdk.onAuthStateChanged(
          auth,
          (next) => {
            generation.current++;
            authIdentity.current = next;
            setData(null);
            setUser(next);
            setAuthReady(true);
          },
          () => {
            setAuthError("Oturum doğrulanamadı. Yeniden giriş yapın.");
            setAuthReady(true);
          },
        );
      })
      .catch((cause) => {
        if (!cancelled) {
          setAuthError(message(cause));
          setAuthReady(true);
        }
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const epoch = generation.current;
      const assertCurrentSession = () => {
        if (
          epoch !== generation.current ||
          (mode === "firebase" && user !== authIdentity.current)
        )
          throw new Error(
            "Oturum değişti; işlemi mevcut oturumda yeniden deneyin.",
          );
      };
      assertCurrentSession();
      const headers = new Headers(options.headers);
      if (options.body) headers.set("Content-Type", "application/json");
      if (mode === "firebase") {
        if (!user) throw new Error("Devam etmek için giriş yapın.");
        headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
      }
      assertCurrentSession();
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      const content = await response.text();
      assertCurrentSession();
      let body: unknown;
      try {
        body = content ? JSON.parse(content) : null;
      } catch {
        throw new Error(
          "API geçerli bir yanıt vermedi. API adresini kontrol edin.",
        );
      }
      if (!response.ok) {
        const detail = body as { error?: string; message?: string } | null;
        throw new Error(
          detail?.message ||
            detail?.error ||
            `İstek tamamlanamadı (${response.status}).`,
        );
      }
      return body as T;
    },
    [user],
  );

  const refresh = useCallback(async () => {
    if (mode === "firebase" && user !== authIdentity.current) return;
    const currentGeneration = generation.current;
    setLoading(true);
    setError(null);
    try {
      const next = await request<Overview>("/api/overview");
      if (currentGeneration === generation.current) setData(next);
    } catch (cause) {
      if (currentGeneration === generation.current) setError(message(cause));
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (!authReady || (mode !== "demo" && !user) || demoSignedOut) return;
    void refresh();
  }, [authReady, user, demoSignedOut, refresh]);

  const createKey = async (name: string) => {
    const created = await request<CreatedKey>("/api/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    // Refresh does not retain or request the secret; it is shown only in the creation dialog.
    await refresh();
    return created;
  };
  const revokeKey = async (id: string) => {
    await request(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  };
  const setProviderEnabled = async (id: string, enabled: boolean) => {
    await request(`/api/providers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  };
  const setCustomerStatus = async (
    id: string,
    status: "active" | "suspended",
  ) => {
    await request(`/api/customers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refresh();
  };
  const addDemoCredit = async () => {
    await request("/api/demo/credit", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ amountMicros: 25_000_000 }),
    });
    await refresh();
  };
  const signOut = async () => {
    generation.current++;
    setData(null);
    setError(null);
    if (mode === "demo") setDemoSignedOut(true);
    else {
      const { sdk, auth } = await firebaseClient();
      await sdk.signOut(auth);
    }
  };
  const login = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      if (mode === "demo") setDemoSignedOut(false);
      else {
        const { sdk, auth } = await firebaseClient();
        await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
      }
    } catch (cause) {
      const code = (cause as { code?: string }).code;
      setAuthError(
        code === "auth/popup-closed-by-user"
          ? "Giriş penceresi kapatıldı."
          : code === "auth/unauthorized-domain"
            ? "Bu adres Firebase Authentication authorized domains listesine eklenmeli."
            : message(cause),
      );
    } finally {
      setSigningIn(false);
    }
  };

  if (!authReady)
    return (
      <div className="auth-screen">
        <Spinner label="Oturum kontrol ediliyor" />
      </div>
    );
  if ((mode !== "demo" && !user) || demoSignedOut)
    return (
      <main className="auth-screen">
        <div className="auth-content">
          <div className="auth-brand">Canvas Console</div>
          <h1>Modellerinize tek yerden erişin.</h1>
          <p>API anahtarlarınızı, kullanımınızı ve bakiyenizi yönetin.</p>
          {authError ? (
            <MessageBar intent="error">
              <MessageBarBody>{authError}</MessageBarBody>
            </MessageBar>
          ) : null}
          <Button
            appearance="primary"
            size="large"
            disabled={signingIn || (mode !== "demo" && mode !== "firebase")}
            onClick={() => void login()}
          >
            {signingIn
              ? "Giriş yapılıyor…"
              : mode === "demo"
                ? "Yerel önizlemeyi aç"
                : "Google ile devam et"}
          </Button>
          {mode === "demo" ? (
            <p className="muted">
              Yerel örnek veriler. Gerçek model çağrısı veya ödeme yapılmaz.
            </p>
          ) : null}
        </div>
      </main>
    );
  return (
    <ConsoleContext.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        createKey,
        revokeKey,
        setProviderEnabled,
        setCustomerStatus,
        addDemoCredit,
        signOut,
      }}
    >
      {children}
    </ConsoleContext.Provider>
  );
}
function message(cause: unknown): string {
  if (cause instanceof TypeError && cause.message.includes("fetch"))
    return "API bağlantısı kurulamadı. Yerel API sunucusunun çalıştığını kontrol edin.";
  return cause instanceof Error ? cause.message : "İşlem tamamlanamadı.";
}
