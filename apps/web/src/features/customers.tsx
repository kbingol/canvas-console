import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import {
  PersonProhibitedRegular,
  PersonAvailableRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import { useConsole } from "../lib/console-context";
import {
  BusyLabel,
  CopyButton,
  date,
  DetailPanel,
  EmptyState,
  InlineError,
  money,
  number,
  PageHeading,
  Status,
} from "../components/console-ui";

export function CustomersPage() {
  const { data, setCustomerStatus } = useConsole();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1191px)").matches
      ? (data!.customers[0]?.id ?? null)
      : null,
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customers = data!.customers.filter(
    (customer) =>
      (status === "all" || customer.status === status) &&
      `${customer.name} ${customer.email} ${customer.id}`
        .toLocaleLowerCase("tr")
        .includes(query.toLocaleLowerCase("tr")),
  );
  const selected = data!.customers.find(
    (customer) => customer.id === selectedId,
  );
  async function changeStatus() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await setCustomerStatus(
        selected.id,
        selected.status === "active" ? "suspended" : "active",
      );
      setConfirm(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Hesap durumu güncellenemedi.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`feature-layout ${selected ? "with-detail" : ""}`}>
      <section className="page-content">
        <PageHeading
          title="Müşteriler"
          description="Hesap erişimini ve kullanım durumunu yönet."
        />
        <div className="filter-row">
          <Input
            className="search-input"
            contentBefore={<SearchRegular />}
            placeholder="Ad, e-posta veya müşteri kimliği ara"
            aria-label="Müşteri ara"
            value={query}
            onChange={(_, state) => setQuery(state.value)}
          />
          <Select
            aria-label="Hesap durumuna göre filtrele"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Tüm hesaplar</option>
            <option value="active">Etkin hesaplar</option>
            <option value="suspended">Askıdaki hesaplar</option>
          </Select>
        </div>
        <div className="table-scroll">
          <Table className="data-table customer-table" aria-label="Müşteriler">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Müşteri</TableHeaderCell>
                <TableHeaderCell>Durum</TableHeaderCell>
                <TableHeaderCell className="numeric">Bakiye</TableHeaderCell>
                <TableHeaderCell className="numeric">İstek</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className={selectedId === customer.id ? "selected-row" : ""}
                  onClick={() => {
                    setSelectedId(customer.id);
                    setError(null);
                  }}
                >
                  <TableCell>
                    <button
                      className="row-title"
                      onClick={() => setSelectedId(customer.id)}
                    >
                      {customer.name}
                    </button>
                    <span className="secondary-text">{customer.email}</span>
                  </TableCell>
                  <TableCell>
                    <Status
                      kind={
                        customer.status === "active" ? "success" : "warning"
                      }
                    >
                      {customer.status === "active" ? "Etkin" : "Askıda"}
                    </Status>
                  </TableCell>
                  <TableCell className="numeric">
                    {money(customer.balanceMicros)}
                  </TableCell>
                  <TableCell className="numeric">
                    {number(customer.requestCount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {customers.length === 0 ? (
          <EmptyState
            title="Müşteri bulunamadı"
            description="Aramayı veya hesap filtresini değiştirebilirsin."
          />
        ) : null}
      </section>
      {selected ? (
        <DetailPanel
          title={selected.name}
          subtitle={
            <>
              <span>{selected.email}</span>
              <div className="customer-id">
                <code>{selected.id}</code>
                <CopyButton
                  value={selected.id}
                  label="Müşteri kimliğini kopyala"
                />
              </div>
            </>
          }
          onClose={() => setSelectedId(null)}
          footer={
            selected.id === data!.session.workspaceId ? (
              <p className="secondary-text">
                Kullandığın çalışma alanını buradan askıya alamazsın.
              </p>
            ) : (
              <Button
                appearance="subtle"
                className={selected.status === "active" ? "danger-action" : ""}
                icon={
                  selected.status === "active" ? (
                    <PersonProhibitedRegular />
                  ) : (
                    <PersonAvailableRegular />
                  )
                }
                onClick={() => {
                  setConfirm(true);
                  setError(null);
                }}
              >
                {selected.status === "active"
                  ? "Hesabı askıya al"
                  : "Hesabı etkinleştir"}
              </Button>
            )
          }
        >
          <div className="detail-section first-detail-section">
            <h3>Genel</h3>
            <dl className="detail-list">
              <div>
                <dt>Durum</dt>
                <dd>
                  <Status
                    kind={selected.status === "active" ? "success" : "warning"}
                  >
                    {selected.status === "active" ? "Etkin" : "Askıda"}
                  </Status>
                </dd>
              </div>
              <div>
                <dt>Bakiye</dt>
                <dd>{money(selected.balanceMicros)}</dd>
              </div>
              <div>
                <dt>Toplam istek</dt>
                <dd>{number(selected.requestCount)}</dd>
              </div>
              <div>
                <dt>Oluşturulma</dt>
                <dd>{date(selected.createdAt)}</dd>
              </div>
            </dl>
          </div>
          <div className="detail-section">
            <h3>Hesap erişimi</h3>
            <p className="secondary-text">
              {selected.status === "active"
                ? "Bu hesap API erişimine açık. Askıya alındığında yeni istekler engellenir."
                : "Bu hesabın yeni API istekleri engelleniyor. Etkinleştirildiğinde erişim yeniden açılır."}
            </p>
            {data!.session.mode === "demo" ? (
              <p className="secondary-text">
                Önizlemede hesap değişiklikleri simüle edilir.
              </p>
            ) : null}
          </div>
        </DetailPanel>
      ) : null}
      <Dialog
        open={confirm}
        onOpenChange={(_, state) => {
          if (!busy) setConfirm(state.open);
        }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              {selected?.status === "active"
                ? "Hesap askıya alınsın mı?"
                : "Hesap etkinleştirilsin mi?"}
            </DialogTitle>
            <DialogContent>
              <p>
                <strong>{selected?.name}</strong>{" "}
                {selected?.status === "active"
                  ? "hesabının yeni API istekleri engellenecek. Daha sonra yeniden etkinleştirebilirsin."
                  : "hesabı yeni API istekleri gönderebilecek."}
              </p>
              <InlineError message={error} />
            </DialogContent>
            <DialogActions>
              <Button disabled={busy} onClick={() => setConfirm(false)}>
                Vazgeç
              </Button>
              <Button
                appearance="primary"
                disabled={busy}
                onClick={() => void changeStatus()}
              >
                <BusyLabel busy={busy}>
                  {selected?.status === "active" ? "Askıya al" : "Etkinleştir"}
                </BusyLabel>
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
