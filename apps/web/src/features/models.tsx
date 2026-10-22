import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Select,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from "@fluentui/react-components";
import { CodeRegular, KeyRegular, SearchRegular } from "@fluentui/react-icons";
import type { Model, ModelKind, PageId } from "@canvas-console/contracts";
import { useConsole } from "../lib/console-context";
import {
  CopyButton,
  DetailPanel,
  EmptyState,
  PageHeading,
  price,
  ProviderMark,
} from "../components/console-ui";

const kinds: { value: ModelKind | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "text", label: "Metin" },
  { value: "image", label: "Görsel" },
  { value: "audio", label: "Ses" },
  { value: "video", label: "Video" },
  { value: "embedding", label: "Embedding" },
  { value: "special", label: "Diğer" },
];

function apiExample(model: Model) {
  const base = (import.meta.env.VITE_API_URL || window.location.origin).replace(
    /\/$/,
    "",
  );
  const endpoint = new URL(model.endpoint, `${base}/`).toString();
  const api = `${model.api} ${model.endpoint}`.toLowerCase();
  let payload: Record<string, unknown>;
  if (api.includes("embedcontent")) {
    payload = {
      model: `models/${model.nativeId}`,
      content: { parts: [{ text: "Örnek bir metin." }] },
    };
  } else if (api.includes("fal") || api.includes("/queue/")) {
    payload =
      model.kind === "video"
        ? {
            prompt: "Gün doğumunda sakin bir kıyı.",
            image_url: "<INPUT_IMAGE_URL>",
          }
        : { prompt: "Sade bir mimari çizim." };
  } else if (api.includes("replicate") || api.includes("/predictions")) {
    payload = {
      version: model.nativeId,
      input:
        model.kind === "special"
          ? { image: "<INPUT_IMAGE_URL>" }
          : { text: "Merhaba, Canvas Console." },
    };
  } else if (api.includes("generatecontent") || api.includes("gemini")) {
    payload = {
      contents: [
        {
          parts: [
            {
              text:
                model.kind === "image"
                  ? "Sade bir mimari çizim oluştur."
                  : "Merhaba, kısa bir tanıtım yaz.",
            },
          ],
        },
      ],
      generationConfig:
        model.kind === "image"
          ? { responseModalities: ["TEXT", "IMAGE"] }
          : { temperature: 0.7, maxOutputTokens: 1024 },
    };
  } else if (api.includes("anthropic") || api.includes("/messages")) {
    payload = {
      model: model.nativeId,
      max_tokens: 1024,
      messages: [{ role: "user", content: "Merhaba, kısa bir tanıtım yaz." }],
    };
  } else if (api.includes("predictlongrunning") || model.kind === "video") {
    payload = {
      instances: [{ prompt: "Gün doğumunda sakin bir kıyı." }],
      parameters: { sampleCount: 1 },
    };
  } else if (api.includes(":predict") || api.includes("imagen")) {
    payload = {
      instances: [{ prompt: "Sade bir mimari çizim." }],
      parameters: { sampleCount: 1 },
    };
  } else if (api.includes("/images")) {
    payload = {
      model: model.nativeId,
      prompt: "Sade bir mimari çizim.",
      size: "1024x1024",
    };
  } else if (api.includes("/audio/speech")) {
    payload = {
      model: model.nativeId,
      input: "Merhaba, Canvas Console.",
      voice: "alloy",
    };
  } else if (model.kind === "embedding") {
    payload = { model: model.nativeId, input: "Örnek bir metin." };
  } else {
    payload = {
      model: model.nativeId,
      messages: [{ role: "user", content: "Merhaba, kısa bir tanıtım yaz." }],
      temperature: 0.7,
      stream: true,
    };
  }
  return `POST ${endpoint}\nAuthorization: Bearer <CANVAS_API_KEY>\nContent-Type: application/json\n\n${JSON.stringify(payload, null, 2)}`;
}

export function ModelsPage({ navigate }: { navigate: (page: PageId) => void }) {
  const { data } = useConsole();
  const models = data!.models;
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [kind, setKind] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.matchMedia("(min-width: 1191px)").matches
      ? (models[0]?.id ?? null)
      : null,
  );
  const [showExample, setShowExample] = useState(false);
  const providers = useMemo(
    () => [...new Set(models.map((model) => model.provider))],
    [models],
  );
  const filtered = useMemo(
    () =>
      models.filter(
        (model) =>
          (kind === "all" || model.kind === kind) &&
          (provider === "all" || model.provider === provider) &&
          `${model.name} ${model.id} ${model.provider}`
            .toLocaleLowerCase("tr")
            .includes(query.toLocaleLowerCase("tr")),
      ),
    [models, kind, provider, query],
  );
  useEffect(() => {
    if (selectedId && !filtered.some((model) => model.id === selectedId))
      setSelectedId(null);
  }, [filtered, selectedId]);
  const selected = models.find((model) => model.id === selectedId);
  const open = (id: string) => {
    setSelectedId(id);
    setShowExample(false);
  };
  return (
    <div className={`feature-layout ${selected ? "with-detail" : ""}`}>
      <section className="page-content model-page">
        <PageHeading
          title="Modeller"
          description="Model seç ve API bağlantısını hazırla."
        />
        <div className="filter-row model-filters">
          <Input
            className="search-input"
            contentBefore={<SearchRegular />}
            placeholder="Model ara"
            aria-label="Model ara"
            value={query}
            onChange={(_, state) => setQuery(state.value)}
          />
          <Select
            value={provider}
            aria-label="Sağlayıcıya göre filtrele"
            onChange={(event) => setProvider(event.target.value)}
          >
            <option value="all">Tüm sağlayıcılar</option>
            {providers.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
        </div>
        <TabList
          selectedValue={kind}
          onTabSelect={(_, state) => setKind(String(state.value))}
          className="model-tabs"
        >
          {kinds.map((item) => (
            <Tab key={item.value} value={item.value}>
              {item.label}
            </Tab>
          ))}
        </TabList>
        <div className="table-scroll">
          <Table aria-label="Model kataloğu" className="data-table model-table">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Model</TableHeaderCell>
                <TableHeaderCell>Sağlayıcı</TableHeaderCell>
                <TableHeaderCell className="numeric">Giriş</TableHeaderCell>
                <TableHeaderCell className="numeric">Çıkış</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((model) => (
                <TableRow
                  key={model.id}
                  className={selectedId === model.id ? "selected-row" : ""}
                  onClick={() => open(model.id)}
                >
                  <TableCell>
                    <div className="model-cell">
                      <ProviderMark name={model.provider} />
                      <div>
                        <button
                          className="row-title"
                          onClick={() => open(model.id)}
                        >
                          {model.name}
                        </button>
                        <span className="secondary-text model-id">
                          {model.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{model.provider}</TableCell>
                  <TableCell className="numeric">
                    {price(model.inputPrice)}
                  </TableCell>
                  <TableCell className="numeric">
                    {price(model.outputPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="Model bulunamadı"
            description="Farklı bir ad arayın veya filtreleri temizleyin."
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setProvider("all");
                  setKind("all");
                }}
              >
                Filtreleri temizle
              </Button>
            }
          />
        ) : (
          <p className="table-footnote">
            {filtered.length} model · Fiyat birimi ve model özellikleri
            ayrıntılarda gösterilir.
          </p>
        )}
      </section>
      {selected ? (
        <DetailPanel
          title={selected.name}
          subtitle={`${selected.provider} · ${kinds.find((item) => item.value === selected.kind)?.label ?? selected.kind}`}
          onClose={() => setSelectedId(null)}
        >
          <p className="model-description">{selected.description}</p>
          <div className="detail-section">
            <label className="field-label">Model kimliği</label>
            <div className="copy-field">
              <code>{selected.id}</code>
              <CopyButton value={selected.id} label="Model kimliğini kopyala" />
            </div>
            <label className="field-label">API</label>
            <div className="read-field">{selected.api}</div>
          </div>
          <div className="detail-actions">
            <Button
              appearance="primary"
              icon={<KeyRegular />}
              onClick={() => navigate("keys")}
            >
              Bağlantıyı hazırla
            </Button>
            <Button
              icon={<CodeRegular />}
              onClick={() => setShowExample((value) => !value)}
            >
              {showExample ? "Ayrıntılar" : "API örneği"}
            </Button>
          </div>
          {showExample ? (
            <div className="code-section">
              <div className="section-title-row">
                <h3>Native API isteği</h3>
                <CopyButton
                  value={apiExample(selected)}
                  label="API örneğini kopyala"
                />
              </div>
              <p className="secondary-text">
                Sağlayıcının istek biçimi ve model parametreleri korunur.
              </p>
              <pre tabIndex={0}>
                <code>{apiExample(selected)}</code>
              </pre>
              <p className="table-footnote">
                Bu istek taslağı gösterim amaçlıdır. Model çağrısı endpoint'leri
                henüz etkin değil.
              </p>
            </div>
          ) : (
            <>
              <div className="detail-section">
                <h3>Model özellikleri</h3>
                <dl className="detail-list">
                  <div>
                    <dt>Bağlam</dt>
                    <dd>{selected.context}</dd>
                  </div>
                  <div>
                    <dt>Giriş</dt>
                    <dd>{price(selected.inputPrice)}</dd>
                  </div>
                  <div>
                    <dt>Çıkış</dt>
                    <dd>{price(selected.outputPrice)}</dd>
                  </div>
                </dl>
                <p className="table-footnote">{selected.priceUnit}</p>
                <div className="capabilities">
                  {selected.capabilities.map((capability) => (
                    <Badge key={capability} appearance="outline" color="subtle">
                      {capability}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="detail-section">
                <label className="field-label">Native model kimliği</label>
                <div className="copy-field">
                  <code>{selected.nativeId}</code>
                  <CopyButton
                    value={selected.nativeId}
                    label="Native model kimliğini kopyala"
                  />
                </div>
                <label className="field-label">Endpoint</label>
                <div className="endpoint-field">
                  <code>{selected.endpoint}</code>
                  <CopyButton
                    value={selected.endpoint}
                    label="Endpoint kopyala"
                  />
                </div>
              </div>
            </>
          )}
        </DetailPanel>
      ) : null}
    </div>
  );
}
