import { useState } from "react";
import {
  Button,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular, SearchRegular } from "@fluentui/react-icons";
import type { PageId } from "@canvas-console/contracts";
import { useConsole } from "../lib/console-context";
import {
  CopyButton,
  DetailPanel,
  EmptyState,
  InlineError,
  PageHeading,
  ProviderMark,
  Status,
} from "../components/console-ui";

export function ProvidersPage({
  navigate,
}: {
  navigate: (page: PageId) => void;
}) {
  const { data, refresh, setProviderEnabled } = useConsole();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1191px)").matches
      ? (data!.providers[0]?.id ?? null)
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const providers = data!.providers.filter((provider) =>
    `${provider.name} ${provider.api}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  const selected = data!.providers.find(
    (provider) => provider.id === selectedId,
  );
  async function toggle(enabled: boolean) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await setProviderEnabled(selected.id, enabled);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sağlayıcı güncellenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    setBusy(true);
    setError(null);
    try {
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Veriler yenilenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`feature-layout ${selected ? "with-detail" : ""}`}>
      <section className="page-content">
        <PageHeading
          title="Sağlayıcılar"
          description="Model sağlayıcılarının bağlantılarını yönet."
        />
        <div className="filter-row">
          <Button
            icon={<ArrowClockwiseRegular />}
            disabled={busy}
            onClick={() => void reload()}
          >
            {busy ? "Yenileniyor…" : "Yenile"}
          </Button>
          <Input
            className="search-input"
            contentBefore={<SearchRegular />}
            placeholder="Sağlayıcı ara"
            aria-label="Sağlayıcı ara"
            value={query}
            onChange={(_, state) => setQuery(state.value)}
          />
        </div>
        {!selected ? <InlineError message={error} /> : null}
        <div className="table-scroll">
          <Table
            className="data-table provider-table"
            aria-label="Model sağlayıcıları"
          >
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Sağlayıcı</TableHeaderCell>
                <TableHeaderCell>Durum</TableHeaderCell>
                <TableHeaderCell className="numeric">Model</TableHeaderCell>
                <TableHeaderCell>Kimlik bilgisi</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow
                  key={provider.id}
                  className={selectedId === provider.id ? "selected-row" : ""}
                  onClick={() => {
                    setSelectedId(provider.id);
                    setError(null);
                  }}
                >
                  <TableCell>
                    <div className="model-cell">
                      <ProviderMark name={provider.name} />
                      <button
                        className="row-title"
                        onClick={() => setSelectedId(provider.id)}
                      >
                        {provider.name}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Status kind={provider.enabled ? "success" : "muted"}>
                      {provider.enabled ? "Etkin" : "Kapalı"}
                    </Status>
                  </TableCell>
                  <TableCell className="numeric">
                    {provider.modelCount}
                  </TableCell>
                  <TableCell>
                    {provider.credentialConfigured
                      ? "Yapılandırıldı"
                      : "Yapılandırılmadı"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {providers.length === 0 ? (
          <EmptyState
            title="Sağlayıcı bulunamadı"
            description="Farklı bir sağlayıcı adı arayın."
          />
        ) : (
          <p className="table-footnote">
            Durum, yapılandırmadaki erişimi gösterir. Canlı bağlantı testi
            yapılmaz.
          </p>
        )}
      </section>
      {selected ? (
        <DetailPanel
          title={selected.name}
          subtitle={selected.api}
          onClose={() => setSelectedId(null)}
        >
          <div className="settings-row provider-connection">
            <span>Bağlantı</span>
            <Switch
              checked={selected.enabled}
              disabled={busy}
              aria-label={`${selected.name} bağlantısını ${selected.enabled ? "kapat" : "aç"}`}
              onChange={(_, state) => void toggle(state.checked)}
            />
          </div>
          <InlineError message={error} />
          <dl className="detail-list">
            <div>
              <dt>API anahtarı</dt>
              <dd>
                {selected.credentialConfigured
                  ? "Yapılandırıldı"
                  : "Yapılandırılmadı"}
              </dd>
            </div>
            <div>
              <dt>Yayınlanan model</dt>
              <dd>{selected.modelCount}</dd>
            </div>
          </dl>
          <div className="detail-section">
            <label className="field-label">Sağlayıcı endpoint'i</label>
            <div className="endpoint-field">
              <code>{selected.baseUrl}</code>
              <CopyButton
                value={selected.baseUrl}
                label="Sağlayıcı endpoint'ini kopyala"
              />
            </div>
          </div>
          <div className="detail-section">
            <h3>Yayınlanan modeller</h3>
            <div className="provider-models">
              {data!.models
                .filter((model) => model.providerId === selected.id)
                .map((model) => (
                  <div key={model.id}>
                    <span>{model.name}</span>
                    <span className="secondary-text">{model.kind}</span>
                  </div>
                ))}
            </div>
            {data!.models.every((model) => model.providerId !== selected.id) ? (
              <p className="secondary-text">
                Bu sağlayıcı için yayınlanan model yok.
              </p>
            ) : null}
            <Button
              appearance="subtle"
              className="text-button"
              onClick={() => navigate("models")}
            >
              Model kataloğunu aç
            </Button>
          </div>
          <div className="detail-section">
            <h3>Kimlik bilgileri</h3>
            <p className="secondary-text">
              Sağlayıcı anahtarları sunucu ortamında yönetilir ve bu panelde
              gösterilmez.
            </p>
            {data!.session.mode === "demo" ? (
              <p className="secondary-text">
                Önizlemede yapılan değişiklikler gerçek sağlayıcı bağlantısını
                etkilemez.
              </p>
            ) : null}
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}
