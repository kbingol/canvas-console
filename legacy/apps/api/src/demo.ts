import type {
  Customer,
  Model,
  Overview,
  Provider,
  Wallet,
  LedgerEntry,
  UsageRecord,
} from "@canvas-console/contracts";
import {
  ApiError,
  assertAdmin,
  assertTenant,
  digest,
  publicKey,
} from "./domain.js";
import type { Actor, Identity, Repository, StoredKey } from "./domain.js";
import { planWalletCommand } from "./wallet.js";
import type { Reservation, WalletCommand, WalletReceipt } from "./wallet.js";

// Educational provider-shaped examples; every price/context is illustrative, and no inference route exists.
const model = (value: Model): Model => ({
  ...value,
  description: `${value.description} Fiyat ve kapasite örnektir; canlı model bağlantısı yoktur.`,
});
export const demoModels: Model[] = [
  model({
    id: "demo/gemini-flash",
    name: "Gemini Flash",
    providerId: "google",
    provider: "Google",
    kind: "text",
    description: "Hızlı yanıtlar ve günlük metin görevleri.",
    nativeId: "gemini-3.8-flash",
    api: "Google Gemini",
    endpoint: "/v1beta/models/gemini-3.8-flash:generateContent",
    inputPrice: 0.3,
    outputPrice: 1.2,
    priceUnit: "1M token",
    context: "1M",
    capabilities: ["Streaming", "Tools", "JSON"],
  }),
  model({
    id: "demo/gemini-pro",
    name: "Gemini Pro",
    providerId: "google",
    provider: "Google",
    kind: "text",
    description: "Uzun bağlam ve karmaşık çok modlu görevler.",
    nativeId: "gemini-4-argon",
    api: "Google Gemini",
    endpoint: "/v1beta/models/gemini-4-argon:generateContent",
    inputPrice: 1.25,
    outputPrice: 5,
    priceUnit: "1M token",
    context: "1M",
    capabilities: ["Streaming", "Tools", "Vision"],
  }),
  model({
    id: "demo/claude-sonnet",
    name: "Claude Sonnet",
    providerId: "anthropic",
    provider: "Anthropic",
    kind: "text",
    description: "Kod, analiz ve araç kullanımı.",
    nativeId: "claude-sonnet-5-5",
    api: "Anthropic Messages",
    endpoint: "/v1/messages",
    inputPrice: 3,
    outputPrice: 15,
    priceUnit: "1M token",
    context: "200K",
    capabilities: ["Streaming", "Tools", "Vision"],
  }),
  model({
    id: "demo/gpt",
    name: "GPT",
    providerId: "openai",
    provider: "OpenAI",
    kind: "text",
    description: "Genel amaçlı metin ve yapılandırılmış çıktı.",
    nativeId: "illustrative/gpt",
    api: "OpenAI Chat Completions",
    endpoint: "/v1/chat/completions",
    inputPrice: 2,
    outputPrice: 8,
    priceUnit: "1M token",
    context: "128K",
    capabilities: ["Streaming", "Tools", "JSON"],
  }),
  model({
    id: "demo/deepseek",
    name: "DeepSeek",
    providerId: "deepseek",
    provider: "DeepSeek",
    kind: "text",
    description: "Akıl yürütme ve teknik problem çözme.",
    nativeId: "illustrative/deepseek",
    api: "OpenAI Chat Completions",
    endpoint: "/v1/chat/completions",
    inputPrice: 0.25,
    outputPrice: 1,
    priceUnit: "1M token",
    context: "128K",
    capabilities: ["Streaming", "Reasoning"],
  }),
  model({
    id: "demo/llama",
    name: "Llama",
    providerId: "groq",
    provider: "Groq",
    kind: "text",
    description: "Açık model ailesi için sağlayıcı üzerinden erişim.",
    nativeId: "illustrative/llama",
    api: "OpenAI Chat Completions",
    endpoint: "/v1/chat/completions",
    inputPrice: 0.15,
    outputPrice: 0.6,
    priceUnit: "1M token",
    context: "128K",
    capabilities: ["Streaming", "Tools"],
  }),
  model({
    id: "demo/image",
    name: "Görsel üretimi",
    providerId: "fal",
    provider: "fal",
    kind: "image",
    description: "Kuyruk üzerinden metinden görsele örnek akış.",
    nativeId: "illustrative/image-model",
    api: "fal Queue",
    endpoint: "/fal/queue/illustrative/image-model",
    inputPrice: 0.035,
    outputPrice: null,
    priceUnit: "görsel",
    context: "—",
    capabilities: ["Async", "Image input"],
  }),
  model({
    id: "demo/video",
    name: "Video üretimi",
    providerId: "fal",
    provider: "fal",
    kind: "video",
    description: "Görselden videoya asenkron iş örneği.",
    nativeId: "illustrative/video-model",
    api: "fal Queue",
    endpoint: "/fal/queue/illustrative/video-model",
    inputPrice: 0.08,
    outputPrice: null,
    priceUnit: "saniye",
    context: "—",
    capabilities: ["Async", "Webhook"],
  }),
  model({
    id: "demo/speech",
    name: "Ses üretimi",
    providerId: "replicate",
    provider: "Replicate",
    kind: "audio",
    description: "Prediction yaşam döngüsü ile konuşma üretimi.",
    nativeId: "illustrative/speech-model",
    api: "Replicate Predictions",
    endpoint: "/replicate/v1/predictions",
    inputPrice: 0.02,
    outputPrice: null,
    priceUnit: "dakika",
    context: "—",
    capabilities: ["Async", "Audio output"],
  }),
  model({
    id: "demo/embedding",
    name: "Metin embedding",
    providerId: "google",
    provider: "Google",
    kind: "embedding",
    description: "Arama ve benzerlik için vektör üretimi.",
    nativeId: "illustrative/embedding-model",
    api: "Google Gemini",
    endpoint: "/v1beta/models/illustrative-embedding:embedContent",
    inputPrice: 0.1,
    outputPrice: null,
    priceUnit: "1M token",
    context: "8K",
    capabilities: ["Embeddings"],
  }),
  model({
    id: "demo/3d",
    name: "3D model üretimi",
    providerId: "replicate",
    provider: "Replicate",
    kind: "special",
    description: "Görselden üç boyutlu dosya üretimi örneği.",
    nativeId: "illustrative/3d-model",
    api: "Replicate Predictions",
    endpoint: "/replicate/v1/predictions",
    inputPrice: 0.12,
    outputPrice: null,
    priceUnit: "istek",
    context: "—",
    capabilities: ["Async", "3D output"],
  }),
];
interface Workspace {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  status: Customer["status"];
  wallet: Wallet;
  keys: StoredKey[];
  ledger: LedgerEntry[];
  usage: UsageRecord[];
  receipts: Map<string, WalletReceipt>;
  reservations: Map<string, Reservation>;
}
export class DemoRepository implements Repository {
  private workspaces = new Map<string, Workspace>();
  private providerTemplates: Provider[] = [
    {
      id: "google",
      name: "Google",
      api: "Google Gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      enabled: true,
      credentialConfigured: false,
      modelCount: 3,
    },
    {
      id: "anthropic",
      name: "Anthropic",
      api: "Anthropic Messages",
      baseUrl: "https://api.anthropic.com/v1",
      enabled: true,
      credentialConfigured: false,
      modelCount: 1,
    },
    {
      id: "openai",
      name: "OpenAI",
      api: "OpenAI Chat Completions",
      baseUrl: "https://api.openai.com/v1",
      enabled: true,
      credentialConfigured: false,
      modelCount: 1,
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      api: "OpenAI Chat Completions",
      baseUrl: "https://api.deepseek.com",
      enabled: true,
      credentialConfigured: false,
      modelCount: 1,
    },
    {
      id: "groq",
      name: "Groq",
      api: "OpenAI Chat Completions",
      baseUrl: "https://api.groq.com/openai/v1",
      enabled: true,
      credentialConfigured: false,
      modelCount: 1,
    },
    {
      id: "fal",
      name: "fal",
      api: "fal Queue",
      baseUrl: "https://queue.fal.run",
      enabled: true,
      credentialConfigured: false,
      modelCount: 2,
    },
    {
      id: "replicate",
      name: "Replicate",
      api: "Replicate Predictions",
      baseUrl: "https://api.replicate.com/v1",
      enabled: false,
      credentialConfigured: false,
      modelCount: 2,
    },
  ];
  private providersByTenant = new Map<string, Provider[]>();
  private providers(tenantId: string): Provider[] {
    if (!this.providersByTenant.has(tenantId))
      this.providersByTenant.set(
        tenantId,
        structuredClone(this.providerTemplates),
      );
    return this.providersByTenant.get(tenantId)!;
  }
  private workspace(actor: Actor): Workspace {
    const workspace = this.workspaces.get(actor.session.workspaceId);
    if (!workspace) throw new ApiError(404, "Workspace not found.");
    assertTenant(workspace.tenantId, actor.tenantId);
    if (workspace.status !== "active")
      throw new ApiError(403, "Workspace is suspended.");
    return workspace;
  }
  private seedCustomers(tenantId: string): void {
    const samples = [
      [
        "studio-kuzey",
        "Kuzey Tasarım Stüdyosu",
        "ekip@kuzey.example",
        84_500_000,
        "active",
      ],
      [
        "atlas-dev",
        "Atlas Yazılım",
        "dev@atlas.example",
        212_000_000,
        "active",
      ],
      [
        "mavi-lab",
        "Mavi Araştırma",
        "hello@mavi.example",
        18_750_000,
        "suspended",
      ],
    ] as const;
    for (const [uid, name, email, balanceMicros, status] of samples) {
      const id = `wrk_${digest(`${tenantId}:sample:${uid}`).slice(0, 24)}`;
      if (!this.workspaces.has(id))
        this.workspaces.set(id, {
          id,
          tenantId,
          name,
          email,
          status,
          wallet: { balanceMicros, reservedMicros: 0, currency: "USD" },
          keys: [],
          ledger: [],
          usage: [],
          receipts: new Map(),
          reservations: new Map(),
        });
    }
  }
  async authenticate(identity: Identity, admin: boolean): Promise<Actor> {
    this.seedCustomers(identity.tenantId);
    const id = `wrk_${digest(`${identity.tenantId}:${identity.uid}`).slice(0, 24)}`;
    if (!this.workspaces.has(id)) {
      this.workspaces.set(id, {
        id,
        tenantId: identity.tenantId,
        name: "Kişisel çalışma alanı",
        email: identity.email,
        status: "active",
        wallet: {
          balanceMicros: 125_000_000,
          reservedMicros: 0,
          currency: "USD",
        },
        keys: [],
        ledger: [
          {
            id: "demo-opening",
            createdAt: "2026-10-01T09:00:00.000Z",
            description: "Örnek demo açılış bakiyesi — ödeme alınmadı",
            type: "credit",
            amountMicros: 125_000_000,
            status: "completed",
          },
        ],
        usage: Array.from({ length: 8 }, (_, index) => ({
          id: `usage_${index}`,
          model: demoModels[index % 3]!.name,
          provider: demoModels[index % 3]!.provider,
          createdAt: `2026-10-${String(21 - index).padStart(2, "0")}T10:30:00.000Z`,
          status: index === 3 ? "error" : "success",
          inputTokens: 1200 + index * 131,
          outputTokens: 350 + index * 29,
          costMicros: index === 3 ? 0 : 1100 + index * 300,
          durationMs: 850 + index * 117,
          keyName: "Örnek uygulama",
        })),
        receipts: new Map(),
        reservations: new Map(),
      });
    }
    const actor: Actor = {
      tenantId: identity.tenantId,
      session: {
        ...identity,
        workspaceId: id,
        workspaceName: "Kişisel çalışma alanı",
        role: admin ? "admin" : "member",
        mode: "demo",
      },
    };
    this.workspace(actor);
    return actor;
  }
  async overview(actor: Actor): Promise<Overview> {
    const w = this.workspace(actor);
    return structuredClone({
      session: actor.session,
      models: demoModels,
      keys: w.keys
        .filter(
          (k) =>
            actor.session.role === "admin" || k.ownerUid === actor.session.uid,
        )
        .map(publicKey),
      wallet: w.wallet,
      ledger: w.ledger,
      usage: w.usage,
      providers:
        actor.session.role === "admin" ? this.providers(actor.tenantId) : [],
      customers:
        actor.session.role === "admin"
          ? [...this.workspaces.values()]
              .filter((x) => x.tenantId === actor.tenantId)
              .map((x) => this.customer(x))
          : [],
    });
  }
  private customer(w: Workspace): Customer {
    return {
      id: w.id,
      name: w.name,
      email: w.email,
      createdAt: "2026-10-01T09:00:00.000Z",
      status: w.status,
      balanceMicros: w.wallet.balanceMicros,
      requestCount: w.usage.length,
    };
  }
  async createKey(actor: Actor, key: StoredKey): Promise<void> {
    this.workspace(actor).keys.push({ ...key });
  }
  async revokeKey(actor: Actor, id: string): Promise<void> {
    const key = this.workspace(actor).keys.find((x) => x.id === id);
    if (
      !key ||
      (actor.session.role !== "admin" && key.ownerUid !== actor.session.uid)
    )
      throw new ApiError(404, "API key not found.");
    key.status = "revoked";
  }
  async setProvider(
    actor: Actor,
    id: string,
    enabled: boolean,
  ): Promise<Provider> {
    assertAdmin(actor);
    this.workspace(actor);
    const provider = this.providers(actor.tenantId).find((x) => x.id === id);
    if (!provider) throw new ApiError(404, "Provider not found.");
    provider.enabled = enabled;
    return { ...provider };
  }
  async setCustomer(
    actor: Actor,
    id: string,
    status: Customer["status"],
  ): Promise<Customer> {
    assertAdmin(actor);
    this.workspace(actor);
    const w = this.workspaces.get(id);
    if (!w || w.tenantId !== actor.tenantId)
      throw new ApiError(404, "Customer not found.");
    if (id === actor.session.workspaceId && status === "suspended")
      throw new ApiError(409, "Cannot suspend the current workspace.");
    w.status = status;
    return this.customer(w);
  }
  /** Synchronous plan+commit executes without awaits, so concurrent local requests cannot overspend. */
  async walletCommand(actor: Actor, command: WalletCommand): Promise<void> {
    const w = this.workspace(actor);
    const reservation =
      "reservationId" in command
        ? w.reservations.get(command.reservationId)
        : undefined;
    const plan = planWalletCommand(
      w.wallet,
      w.receipts.get(command.idempotencyKey),
      reservation,
      command,
    );
    if (plan.replay) return;
    w.wallet = plan.wallet;
    w.receipts.set(command.idempotencyKey, plan.receipt);
    if (plan.reservation && "reservationId" in command)
      w.reservations.set(command.reservationId, plan.reservation);
    if (plan.ledger)
      w.ledger.unshift(
        command.kind === "credit"
          ? {
              ...plan.ledger,
              description: "Deneme bakiyesi; gerçek ödeme alınmadı",
            }
          : plan.ledger,
      );
  }
  async demoCredit(
    actor: Actor,
    amountMicros: number,
    idempotencyKey: string,
  ): Promise<void> {
    await this.walletCommand(actor, {
      kind: "credit",
      amountMicros,
      idempotencyKey,
    });
  }
}
