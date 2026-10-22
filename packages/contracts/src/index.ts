export type ModelKind =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "embedding"
  | "special";
export type PageId =
  | "models"
  | "keys"
  | "usage"
  | "billing"
  | "settings"
  | "providers"
  | "customers";
export interface Model {
  id: string;
  name: string;
  providerId: string;
  provider: string;
  kind: ModelKind;
  description: string;
  nativeId: string;
  api: string;
  endpoint: string;
  inputPrice: number | null;
  outputPrice: number | null;
  priceUnit: string;
  context: string;
  capabilities: string[];
}
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: "active" | "revoked";
}
export interface UsageRecord {
  id: string;
  model: string;
  provider: string;
  createdAt: string;
  status: "success" | "error" | "pending";
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
  durationMs: number;
  keyName: string;
}
export interface LedgerEntry {
  id: string;
  createdAt: string;
  description: string;
  type: "credit" | "usage" | "refund";
  amountMicros: number;
  status: "completed" | "pending";
}
export interface Provider {
  id: string;
  name: string;
  api: string;
  baseUrl: string;
  enabled: boolean;
  credentialConfigured: boolean;
  modelCount: number;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: "active" | "suspended";
  balanceMicros: number;
  requestCount: number;
}
export interface Session {
  uid: string;
  email: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  role: "member" | "admin";
  mode: "demo" | "firebase";
}
export interface Wallet {
  balanceMicros: number;
  reservedMicros: number;
  currency: "USD";
}
export interface Overview {
  session: Session;
  models: Model[];
  keys: ApiKey[];
  usage: UsageRecord[];
  wallet: Wallet;
  ledger: LedgerEntry[];
  providers: Provider[];
  customers: Customer[];
}
export interface CreatedKey {
  key: ApiKey;
  secret: string;
}
export const MONEY_SCALE = 1_000_000;
