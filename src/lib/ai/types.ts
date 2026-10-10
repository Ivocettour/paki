import type { FinancingType, LeadPriority, LeadSource, LeadStage } from "@prisma/client";

/// Equipo por el que consultó la persona, con lo que la IA puede citar.
export interface InterestDevice {
  title: string;
  condition: string;
  storage: string | null;
  color: string;
  batteryPercent: number | null;
  price: number;
  /// Falso si ya se vendió o se dio de baja: no hay que ofrecerlo.
  available: boolean;
}

/// Un equipo disponible del catálogo, para poder ofrecer alternativas.
export interface CatalogItem {
  title: string;
  condition: string;
  storage: string | null;
  price: number;
}

export interface HistoryMessage {
  direction: "IN" | "OUT";
  at: Date;
  body: string;
  by?: string | null;
}

export interface LeadContext {
  fullName: string;
  stage: LeadStage;
  source: LeadSource;
  interestNote: string | null;
  device: InterestDevice | null;
}

export interface StoreContext {
  name: string;
  address: string;
  hours: string;
  plans: Array<{ type: FinancingType; installments: number; surchargePercent: number }>;
}

export type DraftStyle = "normal" | "regenerate";

export interface DraftInput {
  lead: LeadContext;
  /// Quien firma y envía (la persona asignada).
  signerName: string;
  history: HistoryMessage[];
  store: StoreContext;
  catalog: CatalogItem[];
  style?: DraftStyle;
}

export interface Classification {
  interestNote: string | null;
  /// Qué tan urgente es responderle y por qué. Es una sugerencia: una persona la puede cambiar.
  priority?: { level: LeadPriority; reason: string };
}

export interface DraftResult {
  classification: Classification;
  draft: string;
  generatedBy: string;
}

export type RewriteStyle = "brief" | "formal";
