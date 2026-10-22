import { useCallback, useEffect, useState } from "react";
import { Button, Spinner } from "@fluentui/react-components";
import { ArrowClockwiseRegular } from "@fluentui/react-icons";
import type { PageId } from "@canvas-console/contracts";
import { useConsole } from "./lib/console-context";
import { ConsoleShell } from "./components/console-shell";
import { ModelsPage } from "./features/models";
import { KeysPage } from "./features/keys";
import { UsagePage } from "./features/usage";
import { BillingPage } from "./features/billing";
import { ProvidersPage } from "./features/providers";
import { CustomersPage } from "./features/customers";
import { SettingsPage } from "./features/settings";

const validPages = new Set<PageId>([
  "models",
  "keys",
  "usage",
  "billing",
  "settings",
  "providers",
  "customers",
]);
const pageTitles: Record<PageId, string> = {
  models: "Modeller",
  keys: "API anahtarları",
  usage: "Kullanım",
  billing: "Bakiye ve ödemeler",
  settings: "Ayarlar",
  providers: "Sağlayıcılar",
  customers: "Müşteriler",
};
function currentPage(): PageId {
  const value = window.location.hash.slice(1) as PageId;
  return validPages.has(value) ? value : "models";
}

export default function App() {
  const { data, loading, error, refresh, signOut } = useConsole();
  const [page, setPage] = useState<PageId>(currentPage);
  const navigate = useCallback((next: PageId) => {
    window.location.hash = next;
    setPage(next);
  }, []);
  useEffect(() => {
    const onHash = () => setPage(currentPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const allowedPage =
    data?.session.role !== "admin" &&
    (page === "providers" || page === "customers")
      ? "models"
      : page;
  useEffect(() => {
    document.title = `${pageTitles[allowedPage]} · Canvas Console`;
  }, [allowedPage]);
  if (!data)
    return (
      <div className="initial-state">
        {loading ? (
          <>
            <Spinner size="medium" />
            <p>Çalışma alanın yükleniyor…</p>
          </>
        ) : (
          <>
            <h1>Çalışma alanı yüklenemedi</h1>
            <p role="alert">
              {error ?? "Bağlantıyı kontrol edip yeniden dene."}
            </p>
            <Button
              appearance="primary"
              icon={<ArrowClockwiseRegular />}
              onClick={() => void refresh()}
            >
              Yeniden dene
            </Button>
          </>
        )}
      </div>
    );
  const content =
    allowedPage === "keys" ? (
      <KeysPage />
    ) : allowedPage === "usage" ? (
      <UsagePage />
    ) : allowedPage === "billing" ? (
      <BillingPage />
    ) : allowedPage === "providers" ? (
      <ProvidersPage navigate={navigate} />
    ) : allowedPage === "customers" ? (
      <CustomersPage />
    ) : allowedPage === "settings" ? (
      <SettingsPage />
    ) : (
      <ModelsPage navigate={navigate} />
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        İçeriğe geç
      </a>
      <ConsoleShell
        data={data}
        page={allowedPage}
        navigate={navigate}
        signOut={signOut}
      >
        {error ? (
          <div className="refresh-error" role="alert">
            <span>{error}</span>
            <Button size="small" onClick={() => void refresh()}>
              Yeniden dene
            </Button>
          </div>
        ) : null}
        {content}
      </ConsoleShell>
    </>
  );
}
