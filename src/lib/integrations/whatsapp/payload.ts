/**
 * Lectura del aviso (webhook) de la WhatsApp Cloud API. Es tolerante: Meta
 * agrega campos y tipos de mensaje todo el tiempo, y un aviso mal interpretado
 * no puede hacer caer el procesamiento de los demás.
 */

export interface WaInboundMessage {
  /// Id del mensaje (wamid.…). Evita procesar dos veces el mismo aviso.
  id: string;
  /// Teléfono de quien escribe, solo dígitos (wa_id).
  from: string;
  name: string | null;
  at: Date;
  type: string;
  text: string;
}

export interface WaStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient: string | null;
  at: Date;
  errorCode: number | null;
  errorTitle: string | null;
}

export interface WaParsed {
  messages: WaInboundMessage[];
  statuses: WaStatus[];
  ignored: number;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const MEDIA_LABEL: Record<string, string> = {
  image: "una imagen",
  video: "un video",
  audio: "un audio",
  document: "un documento",
  sticker: "un sticker",
};

/// Texto que se muestra en la bandeja para cada tipo de mensaje.
/// `null` = no corresponde mostrarlo (por ejemplo, una reacción).
function textOf(message: Rec): string | null {
  const type = str(message.type) ?? "unknown";

  switch (type) {
    case "text":
      return str((message.text as Rec | undefined)?.body);
    case "button":
      return str((message.button as Rec | undefined)?.text);
    case "interactive": {
      const interactive = message.interactive as Rec | undefined;
      return (
        str((interactive?.button_reply as Rec | undefined)?.title) ??
        str((interactive?.list_reply as Rec | undefined)?.title)
      );
    }
    case "image":
    case "video":
    case "audio":
    case "document":
    case "sticker": {
      const caption = str((message[type] as Rec | undefined)?.caption);
      return `[Envió ${MEDIA_LABEL[type]}${caption ? `: ${caption}` : ". Abrilo en WhatsApp para verlo"}]`;
    }
    case "location":
      return "[Compartió una ubicación. Abrila en WhatsApp para verla]";
    case "contacts":
      return "[Compartió un contacto. Abrilo en WhatsApp para verlo]";
    case "reaction":
      return null;
    default:
      return `[Mensaje de tipo "${type}" que el sistema todavía no muestra. Abrilo en WhatsApp]`;
  }
}

const toDate = (ts: unknown): Date => {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
};

export function parseWhatsAppPayload(json: unknown): WaParsed {
  const out: WaParsed = { messages: [], statuses: [], ignored: 0 };
  if (!isRec(json) || json.object !== "whatsapp_business_account") return out;

  for (const entry of arr(json.entry)) {
    if (!isRec(entry)) continue;

    for (const change of arr(entry.changes)) {
      if (!isRec(change) || change.field !== "messages" || !isRec(change.value)) {
        out.ignored++;
        continue;
      }

      const value = change.value;
      const names = new Map<string, string>();
      for (const contact of arr(value.contacts)) {
        if (isRec(contact) && str(contact.wa_id)) {
          names.set(str(contact.wa_id)!, str((contact.profile as Rec | undefined)?.name) ?? "");
        }
      }

      for (const message of arr(value.messages)) {
        if (!isRec(message)) continue;
        const id = str(message.id);
        const from = str(message.from)?.replace(/\D/g, "");
        const text = textOf(message);

        if (!id || !from || text === null) {
          out.ignored++;
          continue;
        }

        out.messages.push({
          id,
          from,
          name: names.get(from) || null,
          at: toDate(message.timestamp),
          type: str(message.type) ?? "unknown",
          text,
        });
      }

      for (const status of arr(value.statuses)) {
        if (!isRec(status)) continue;
        const id = str(status.id);
        const state = str(status.status);

        if (!id || !state || !["sent", "delivered", "read", "failed"].includes(state)) {
          out.ignored++;
          continue;
        }

        const error = arr(status.errors).find(isRec);
        out.statuses.push({
          id,
          status: state as WaStatus["status"],
          recipient: str(status.recipient_id)?.replace(/\D/g, "") ?? null,
          at: toDate(status.timestamp),
          errorCode: error && typeof error.code === "number" ? error.code : null,
          errorTitle: error ? (str(error.title) ?? str(error.message)) : null,
        });
      }
    }
  }

  return out;
}
