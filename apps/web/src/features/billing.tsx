import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import { useConsole } from "../lib/console-context";
import {
  BusyLabel,
  date,
  downloadCsv,
  EmptyState,
  InlineError,
  money,
  PageHeading,
  Status,
} from "../components/console-ui";

export function BillingPage() {
  const { data, addDemoCredit } = useConsole();
  const [period, setPeriod] = useState("30");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const demo = data!.session.mode === "demo";
  const lastCredit = data!.ledger.find((entry) => entry.type === "credit");
  const entries = data!.ledger.filter(
    (entry) =>
      period === "all" ||
      Date.parse(entry.createdAt) >= Date.now() - Number(period) * 86_400_000,
  );
  async function topUp() {
    setBusy(true);
    setError(null);
    try {
      await addDemoCredit();
      setAdded(true);
      setOpen(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Deneme bakiyesi eklenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-content wide-page">
      <PageHeading title="Bakiye ve ödemeler" />
      <div className="balance-section">
        <div>
          <span className="secondary-text balance-label">
            Kullanılabilir bakiye
          </span>
          <div className="balance-value">
            {money(data!.wallet.balanceMicros)}
          </div>
          {lastCredit ? (
            <p className="secondary-text">
              Son yükleme: {money(lastCredit.amountMicros)} ·{" "}
              {date(lastCredit.createdAt)}
            </p>
          ) : (
            <p className="secondary-text">Henüz bakiye yüklenmedi.</p>
          )}
        </div>
        <Button
          appearance="primary"
          size="large"
          onClick={() => {
            setOpen(true);
            setError(null);
          }}
        >
          Bakiye yükle
        </Button>
      </div>
      {added ? (
        <p className="success-message" role="status">
          Deneme bakiyesi eklendi. Gerçek ödeme alınmadı.
        </p>
      ) : null}
      {data!.wallet.reservedMicros > 0 ? (
        <p className="secondary-text">
          Devam eden istekler için ayrılan bakiye:{" "}
          {money(data!.wallet.reservedMicros)}
        </p>
      ) : null}
      <div className="section-divider" />
      <h2 className="section-heading">Ödeme ayarları</h2>
      <div className="settings-row">
        <div>
          <h3>{demo ? "Önizleme bakiyesi" : "Ödeme yöntemi"}</h3>
          <p>
            {demo
              ? "Bu ortamda bakiye hareketleri simüle edilir. Gerçek ödeme alınmaz."
              : "Gerçek ödeme entegrasyonu henüz yapılandırılmadı."}
          </p>
        </div>
      </div>
      <div className="section-title-row ledger-heading">
        <h2 className="section-heading">Ödeme geçmişi</h2>
        <div className="filter-row">
          <Select
            aria-label="Ödeme geçmişi dönemi"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="30">Son 30 gün</option>
            <option value="7">Son 7 gün</option>
            <option value="all">Tüm zamanlar</option>
          </Select>
          <Button
            icon={<ArrowDownloadRegular />}
            aria-label="Bakiye hareketlerini CSV olarak indir"
            disabled={entries.length === 0}
            onClick={() =>
              downloadCsv("canvas-bakiye-hareketleri.csv", [
                ["Tarih", "İşlem", "Tür", "Tutar USD", "Durum"],
                ...entries.map((entry) => [
                  entry.createdAt,
                  entry.description,
                  entry.type,
                  entry.amountMicros / 1_000_000,
                  entry.status,
                ]),
              ])
            }
          >
            Dışa aktar
          </Button>
        </div>
      </div>
      <div className="table-scroll">
        <Table
          className="data-table ledger-table"
          aria-label="Bakiye hareketleri"
        >
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Tarih</TableHeaderCell>
              <TableHeaderCell>İşlem</TableHeaderCell>
              <TableHeaderCell className="numeric">Tutar</TableHeaderCell>
              <TableHeaderCell>Durum</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{date(entry.createdAt)}</TableCell>
                <TableCell>
                  <span className="cell-primary">{entry.description}</span>
                  <span className="secondary-text">
                    {entry.type === "credit"
                      ? "Bakiye yükleme"
                      : entry.type === "refund"
                        ? "İade"
                        : "API kullanımı"}
                  </span>
                </TableCell>
                <TableCell className="numeric">
                  {entry.amountMicros > 0 ? "+" : ""}
                  {money(entry.amountMicros)}
                </TableCell>
                <TableCell>
                  <Status
                    kind={entry.status === "completed" ? "success" : "warning"}
                  >
                    {entry.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                  </Status>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="Bu dönemde bakiye hareketi yok" />
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(_, state) => {
          if (!busy) setOpen(state.open);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {demo ? "Deneme bakiyesi ekle" : "Bakiye yükleme"}
            </DialogTitle>
            <DialogContent>
              <p>
                {demo
                  ? "Yerel önizleme hesabına deneme bakiyesi eklenir. Bu işlem simülasyondur; kart bilgisi istenmez ve gerçek ödeme alınmaz."
                  : "Gerçek ödeme entegrasyonu henüz yapılandırılmadı. Şu anda bu panelden ödeme alınamaz."}
              </p>
              <InlineError message={error} />
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setOpen(false)}>
                {demo ? "Vazgeç" : "Kapat"}
              </Button>
              {demo ? (
                <Button
                  appearance="primary"
                  disabled={busy}
                  onClick={() => void topUp()}
                >
                  <BusyLabel busy={busy}>Deneme bakiyesi ekle</BusyLabel>
                </Button>
              ) : null}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}
