import { useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { AddRegular, SearchRegular } from "@fluentui/react-icons";
import type { ApiKey, CreatedKey } from "@canvas-console/contracts";
import { useConsole } from "../lib/console-context";
import {
  BusyLabel,
  CopyButton,
  date,
  DetailPanel,
  EmptyState,
  InlineError,
  PageHeading,
  Status,
} from "../components/console-ui";

export function KeysPage() {
  const { data, createKey, revokeKey } = useConsole();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const keys = data!.keys.filter((key) =>
    `${key.name} ${key.prefix}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );
  function openCreate() {
    setCreating(true);
    setName("");
    setError(null);
  }
  async function submit() {
    if (submitting.current) return;
    if (!name.trim()) {
      setError("Anahtar için bir ad yazın.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await createKey(name.trim());
      setCreated(result);
      setCreating(false);
      setName("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Anahtar oluşturulamadı.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    setError(null);
    try {
      await revokeKey(revoking.id);
      setRevoking(null);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Anahtar iptal edilemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`feature-layout ${creating ? "with-detail" : ""}`}>
      <section className="page-content">
        <PageHeading
          title="API anahtarları"
          description="Uygulamalarının API erişimini yönet."
          action={
            !creating ? (
              <Button
                appearance="primary"
                icon={<AddRegular />}
                onClick={openCreate}
              >
                Yeni anahtar
              </Button>
            ) : undefined
          }
        />
        <div className="filter-row">
          <Input
            className="search-input"
            contentBefore={<SearchRegular />}
            value={query}
            placeholder="Anahtar ara"
            aria-label="Anahtar ara"
            onChange={(_, state) => setQuery(state.value)}
          />
        </div>
        <div className="table-scroll">
          <Table className="data-table" aria-label="API anahtarları">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Ad</TableHeaderCell>
                <TableHeaderCell>Anahtar</TableHeaderCell>
                <TableHeaderCell>Son kullanım</TableHeaderCell>
                <TableHeaderCell>Durum</TableHeaderCell>
                <TableHeaderCell className="action-column">
                  <span className="sr-only">İşlem</span>
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell>
                    <span className="cell-primary">{key.name}</span>
                    <span className="secondary-text">
                      {date(key.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code className="key-prefix">{key.prefix}••••</code>
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt
                      ? date(key.lastUsedAt, true)
                      : "Henüz kullanılmadı"}
                  </TableCell>
                  <TableCell>
                    <Status
                      kind={key.status === "active" ? "success" : "muted"}
                    >
                      {key.status === "active" ? "Etkin" : "İptal edildi"}
                    </Status>
                  </TableCell>
                  <TableCell className="action-column">
                    <Button
                      appearance="subtle"
                      size="small"
                      disabled={key.status === "revoked"}
                      onClick={() => {
                        setRevoking(key);
                        setError(null);
                      }}
                    >
                      İptal et
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {keys.length === 0 ? (
          <EmptyState
            title={query ? "Anahtar bulunamadı" : "İlk API anahtarını oluştur"}
            description={
              query
                ? "Farklı bir ad veya anahtar öneki arayın."
                : "Uygulamanı bağlamak için bir anahtar oluştur."
            }
            action={
              !query ? (
                <Button onClick={openCreate}>Yeni anahtar</Button>
              ) : undefined
            }
          />
        ) : null}
        <p className="table-footnote">
          Tam anahtar yalnızca oluşturulurken gösterilir.
        </p>
      </section>
      {creating ? (
        <DetailPanel
          title="Yeni API anahtarı"
          onClose={() => {
            if (!busy) setCreating(false);
          }}
          footer={
            <>
              <p className="secondary-text">
                Anahtarı oluşturduktan sonra güvenli bir yere kaydet.
              </p>
              <div className="detail-actions">
                <Button
                  appearance="primary"
                  type="submit"
                  form="create-api-key-form"
                  disabled={busy}
                >
                  <BusyLabel busy={busy}>Oluştur</BusyLabel>
                </Button>
                <Button disabled={busy} onClick={() => setCreating(false)}>
                  Vazgeç
                </Button>
              </div>
            </>
          }
        >
          <form
            id="create-api-key-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <Field label="Ad" required>
              <Input
                autoFocus
                disabled={busy}
                maxLength={80}
                value={name}
                placeholder="Örn. Web uygulamam"
                onChange={(_, state) => setName(state.value)}
              />
            </Field>
            <p className="field-help">
              Bu ad yalnızca anahtarlarını ayırt etmek için kullanılır.
            </p>
            <InlineError message={error} />
          </form>
          <div className="detail-section">
            <h3>Güvenli bağlantı</h3>
            <p className="secondary-text">
              Anahtarını sunucu tarafında sakla. Kaynak koda veya tarayıcıya
              ekleme.
            </p>
            <p className="secondary-text">
              Erişimi dilediğin zaman bu panelden iptal edebilirsin.
            </p>
          </div>
        </DetailPanel>
      ) : null}
      <Dialog
        open={created !== null}
        onOpenChange={(_, state) => {
          if (!state.open) setCreated(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>API anahtarın hazır</DialogTitle>
            <DialogContent>
              <p>
                <strong>{created?.key.name}</strong> için anahtarı şimdi
                kopyala. Bu pencereyi kapattıktan sonra tekrar gösterilmez.
              </p>
              <div className="secret-field">
                <code>{created?.secret}</code>
                {created ? (
                  <CopyButton
                    value={created.secret}
                    label="API anahtarını kopyala"
                  />
                ) : null}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setCreated(null)}>
                Kaydettim, kapat
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Dialog
        open={revoking !== null}
        onOpenChange={(_, state) => {
          if (!state.open && !busy) setRevoking(null);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Anahtar iptal edilsin mi?</DialogTitle>
            <DialogContent>
              <p>
                <strong>{revoking?.name}</strong> anahtarını kullanan
                uygulamalar API erişimini kaybeder. Bu işlem geri alınamaz.
              </p>
              <InlineError message={error} />
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setRevoking(null)}>
                Vazgeç
              </Button>
              <Button
                appearance="primary"
                disabled={busy}
                onClick={() => void revoke()}
              >
                <BusyLabel busy={busy}>Anahtarı iptal et</BusyLabel>
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
