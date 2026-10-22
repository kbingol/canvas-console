import { useMemo, useState } from "react";
import {
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  ChevronDownRegular,
  ChevronRightRegular,
} from "@fluentui/react-icons";
import type { UsageRecord } from "@canvas-console/contracts";
import { useConsole } from "../lib/console-context";
import {
  date,
  downloadCsv,
  EmptyState,
  money,
  number,
  PageHeading,
  ProviderMark,
  Status,
} from "../components/console-ui";

function UsageChart({ records }: { records: UsageRecord[] }) {
  const points = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const record of records) {
      const day = record.createdAt.slice(0, 10);
      grouped.set(day, (grouped.get(day) ?? 0) + record.costMicros);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, cost]) => ({ day, cost }));
  }, [records]);
  if (points.length === 0)
    return (
      <EmptyState
        title="Bu dönemde kullanım yok"
        description="API istekleri geldikçe harcamaların burada görünür."
      />
    );
  const max = Math.max(...points.map((point) => point.cost), 1000);
  const x = (index: number) =>
    points.length === 1 ? 500 : 56 + (index / (points.length - 1)) * 892;
  const y = (cost: number) => 174 - (cost / max) * 144;
  const path = points
    .map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point.cost)}`)
    .join(" ");
  const area = `${path} L ${x(points.length - 1)} 174 L ${x(0)} 174 Z`;
  const labels = [
    ...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]),
  ];
  return (
    <div className="usage-chart">
      <svg
        viewBox="0 0 980 220"
        role="img"
        aria-label={`Günlük kullanım grafiği. ${points.length} günde toplam ${money(points.reduce((total, point) => total + point.cost, 0))}.`}
        preserveAspectRatio="none"
      >
        {[30, 102, 174].map((line) => (
          <line
            key={line}
            x1="56"
            y1={line}
            x2="948"
            y2={line}
            className="chart-grid"
          />
        ))}
        <path d={area} className="chart-area" />
        <path d={path} className="chart-line" />
        {points.map((point, index) => (
          <circle
            key={point.day}
            cx={x(index)}
            cy={y(point.cost)}
            r="3"
            className="chart-point"
          >
            <title>
              {date(point.day)}: {money(point.cost, true)}
            </title>
          </circle>
        ))}
        {[30, 102, 174].map((line, index) => (
          <text
            key={line}
            x="46"
            y={line + 4}
            textAnchor="end"
            className="chart-label"
          >
            {index === 2
              ? "$0"
              : money(Math.round(max * (1 - index / 2)), true)}
          </text>
        ))}
        {labels.map((index) => (
          <text
            key={index}
            x={x(index)}
            y="205"
            textAnchor={
              index === 0
                ? "start"
                : index === points.length - 1
                  ? "end"
                  : "middle"
            }
            className="chart-label"
          >
            {new Intl.DateTimeFormat("tr-TR", {
              day: "numeric",
              month: "short",
              timeZone: "Europe/Istanbul",
            }).format(new Date(points[index].day))}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function UsagePage() {
  const { data } = useConsole();
  const [period, setPeriod] = useState("30");
  const [keyName, setKeyName] = useState("all");
  const [history, setHistory] = useState(false);
  const keyNames = [...new Set(data!.usage.map((record) => record.keyName))];
  const records = useMemo(() => {
    const cutoff =
      period === "all" ? 0 : Date.now() - Number(period) * 86_400_000;
    return data!.usage.filter(
      (record) =>
        Date.parse(record.createdAt) >= cutoff &&
        (keyName === "all" || record.keyName === keyName),
    );
  }, [data, period, keyName]);
  const aggregates = useMemo(() => {
    const grouped = new Map<
      string,
      {
        model: string;
        provider: string;
        requests: number;
        tokens: number;
        cost: number;
      }
    >();
    for (const record of records) {
      const item = grouped.get(record.model) ?? {
        model: record.model,
        provider: record.provider,
        requests: 0,
        tokens: 0,
        cost: 0,
      };
      item.requests++;
      item.tokens += record.inputTokens + record.outputTokens;
      item.cost += record.costMicros;
      grouped.set(record.model, item);
    }
    return [...grouped.values()].sort((a, b) => b.cost - a.cost);
  }, [records]);
  const totalCost = records.reduce(
    (total, record) => total + record.costMicros,
    0,
  );
  const totalTokens = records.reduce(
    (total, record) => total + record.inputTokens + record.outputTokens,
    0,
  );
  function exportCsv() {
    downloadCsv("canvas-kullanim.csv", [
      [
        "İstek kimliği",
        "Tarih",
        "Model",
        "Sağlayıcı",
        "Anahtar",
        "Durum",
        "Giriş token",
        "Çıkış token",
        "Tutar USD",
        "Süre ms",
      ],
      ...records.map((record) => [
        record.id,
        record.createdAt,
        record.model,
        record.provider,
        record.keyName,
        record.status,
        record.inputTokens,
        record.outputTokens,
        record.costMicros / 1_000_000,
        record.durationMs,
      ]),
    ]);
  }
  return (
    <section className="page-content wide-page">
      <PageHeading
        title="Kullanım"
        description="Model ve anahtar bazında harcamalarını izle."
      />
      <div className="filter-row usage-filters">
        <Select
          aria-label="Kullanım dönemi"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="30">Son 30 gün</option>
          <option value="7">Son 7 gün</option>
          <option value="all">Tüm zamanlar</option>
        </Select>
        <Select
          aria-label="API anahtarına göre filtrele"
          value={keyName}
          onChange={(event) => setKeyName(event.target.value)}
        >
          <option value="all">Tüm anahtarlar</option>
          {keyNames.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Select>
        <Button
          icon={<ArrowDownloadRegular />}
          disabled={records.length === 0}
          onClick={exportCsv}
        >
          Dışa aktar
        </Button>
        <span className="usage-summary">
          Bu dönem <strong>{money(totalCost)}</strong> ·{" "}
          {number(records.length)} istek
        </span>
      </div>
      <UsageChart records={records} />
      <div className="section-divider" />
      <h2 className="section-heading">Modele göre kullanım</h2>
      <div className="table-scroll">
        <Table className="data-table" aria-label="Modele göre kullanım">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell className="numeric">İstek</TableHeaderCell>
              <TableHeaderCell className="numeric">Token</TableHeaderCell>
              <TableHeaderCell className="numeric">Tutar</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregates.map((item) => (
              <TableRow key={item.model}>
                <TableCell>
                  <div className="model-cell">
                    <ProviderMark name={item.provider} />
                    <div>
                      <span className="cell-primary">
                        {data!.models.find((model) => model.id === item.model)
                          ?.name ?? item.model}
                      </span>
                      <span className="secondary-text">{item.provider}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="numeric">
                  {number(item.requests)}
                </TableCell>
                <TableCell className="numeric">{number(item.tokens)}</TableCell>
                <TableCell className="numeric">
                  {money(item.cost, true)}
                </TableCell>
              </TableRow>
            ))}
            {records.length > 0 ? (
              <TableRow className="total-row">
                <TableCell>Toplam</TableCell>
                <TableCell className="numeric">
                  {number(records.length)}
                </TableCell>
                <TableCell className="numeric">{number(totalTokens)}</TableCell>
                <TableCell className="numeric">
                  {money(totalCost, true)}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <Button
        appearance="subtle"
        className="history-toggle"
        icon={history ? <ChevronDownRegular /> : <ChevronRightRegular />}
        iconPosition="after"
        onClick={() => setHistory((value) => !value)}
        aria-expanded={history}
      >
        İstek geçmişi
      </Button>
      {history ? (
        <div className="table-scroll">
          <Table
            className="data-table request-table"
            aria-label="İstek geçmişi"
          >
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Tarih</TableHeaderCell>
                <TableHeaderCell>Model</TableHeaderCell>
                <TableHeaderCell>Anahtar</TableHeaderCell>
                <TableHeaderCell>Durum</TableHeaderCell>
                <TableHeaderCell className="numeric">Süre</TableHeaderCell>
                <TableHeaderCell className="numeric">Tutar</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{date(record.createdAt, true)}</TableCell>
                  <TableCell>{record.model}</TableCell>
                  <TableCell>{record.keyName}</TableCell>
                  <TableCell>
                    <Status
                      kind={
                        record.status === "success"
                          ? "success"
                          : record.status === "error"
                            ? "error"
                            : "warning"
                      }
                    >
                      {record.status === "success"
                        ? "Başarılı"
                        : record.status === "error"
                          ? "Hata"
                          : "Bekliyor"}
                    </Status>
                  </TableCell>
                  <TableCell className="numeric">
                    {number(record.durationMs)} ms
                  </TableCell>
                  <TableCell className="numeric">
                    {money(record.costMicros, true)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records.length === 0 ? (
            <EmptyState title="Gösterilecek istek yok" />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
