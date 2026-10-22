import { useEffect, useState, type ReactNode } from "react";
import { Button, OverlayDrawer, Spinner } from "@fluentui/react-components";
import {
  CheckmarkRegular,
  CopyRegular,
  DismissRegular,
  SparkleRegular,
  BotRegular,
  CloudRegular,
} from "@fluentui/react-icons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
export function money(micros: number, precise = false) {
  return precise && Math.abs(micros) > 0 && Math.abs(micros) < 10_000
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 5,
      }).format(micros / 1_000_000)
    : currencyFormatter.format(micros / 1_000_000);
}
export function price(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4,
      }).format(value);
}
export function date(value: string, withTime = false) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
export function number(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function ProviderMark({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const Icon = lower.includes("google")
    ? SparkleRegular
    : lower.includes("anthropic") || lower.includes("openai")
      ? BotRegular
      : CloudRegular;
  return (
    <span className="provider-mark" aria-hidden="true">
      <Icon />
    </span>
  );
}
export function Status({
  kind,
  children,
}: {
  kind: "success" | "warning" | "muted" | "error";
  children: ReactNode;
}) {
  return (
    <span className={`status status-${kind}`}>
      <span className="status-dot" />
      {children}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
export function InlineError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="inline-error">
      {message}
    </p>
  ) : null;
}
export function BusyLabel({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return busy ? (
    <span className="busy-label">
      <Spinner size="tiny" />
      İşleniyor…
    </span>
  ) : (
    children
  );
}
export function CopyButton({
  value,
  label = "Kopyala",
  appearance = "subtle",
}: {
  value: string;
  label?: string;
  appearance?: "subtle" | "secondary";
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("done");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }
  return (
    <span className="copy-action">
      <Button
        appearance={appearance}
        icon={state === "done" ? <CheckmarkRegular /> : <CopyRegular />}
        aria-label={state === "done" ? "Kopyalandı" : label}
        title={state === "done" ? "Kopyalandı" : label}
        onClick={() => void copy()}
      />
      {state === "error" ? (
        <span role="alert" className="copy-error">
          Kopyalanamadı; metni seçin.
        </span>
      ) : null}
    </span>
  );
}
export function DetailPanel({
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const [overlay, setOverlay] = useState(
    () => window.matchMedia("(max-width: 1190px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1190px)");
    const update = () => setOverlay(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const content = (
    <>
      <div className="detail-header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <div className="detail-subtitle">{subtitle}</div> : null}
        </div>
        <Button
          appearance="subtle"
          icon={<DismissRegular />}
          aria-label="Ayrıntıları kapat"
          onClick={onClose}
        />
      </div>
      <div className="detail-body">{children}</div>
      {footer ? <div className="detail-footer">{footer}</div> : null}
    </>
  );
  return overlay ? (
    <OverlayDrawer
      open
      position="end"
      className="detail-panel mobile-detail-panel"
      backdrop={{ className: "mobile-detail-backdrop" }}
      aria-label={`${title} ayrıntıları`}
      onOpenChange={(_, state) => {
        if (!state.open) onClose();
      }}
    >
      {content}
    </OverlayDrawer>
  ) : (
    <aside className="detail-panel" aria-label={`${title} ayrıntıları`}>
      {content}
    </aside>
  );
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const quote = (value: string | number) => {
    const safe =
      typeof value === "string" && /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : String(value);
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(quote).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
