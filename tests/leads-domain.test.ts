import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizePhone } from "@/lib/domain/phone";
import { findDuplicate, normalizeMessage, similarity } from "@/lib/domain/messages";
import { buildDigest, dueInfo } from "@/lib/domain/follow-up";
import {
  decideSendMode,
  isWithinWindow,
  renderTemplate,
  toWhatsAppNumber,
} from "@/lib/integrations/whatsapp/rules";
import { signMetaBody, verifyMetaSignature, answerChallenge } from "@/lib/integrations/whatsapp/signature";
import { parseWhatsAppPayload } from "@/lib/integrations/whatsapp/payload";
import {
  TEMPLATE_CATALOG,
  buildTemplateParams,
  formatAppointmentDay,
} from "@/lib/integrations/whatsapp/catalog";
import { cleanDraftText } from "@/lib/ai/clean";
import { mockPriority } from "@/lib/ai/priority-rules";
import { mockClassifyAndDraft } from "@/lib/ai/mock";
import type { DraftInput } from "@/lib/ai/types";

describe("Teléfonos", () => {
  it.each([
    ["+54 9 362 412-3456", "+5493624123456"],
    ["0362 15 4123456", "+5493624123456"],
    ["362 4123456", "+5493624123456"],
    ["5493624123456", "+5493624123456"],
  ])("unifica %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("conserva números de otros países y rechaza basura", () => {
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it("normaliza correos", () => {
    expect(normalizeEmail("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normalizeEmail("no-es-mail")).toBeNull();
  });
});

describe("Anti-duplicados", () => {
  const previous = [
    {
      id: "1",
      body: "Hola Ana, el iPhone 15 Pro está a $1.200.000. ¿Querés pasar a verlo?",
      normalizedText: normalizeMessage("Hola Ana, el iPhone 15 Pro está a $1.200.000. ¿Querés pasar a verlo?"),
      createdAt: new Date(),
    },
  ];

  it("ignora mayúsculas, tildes y signos", () => {
    expect(normalizeMessage("¡Hola, ÁNA!")).toBe("hola ana");
  });

  it("bloquea un mensaje idéntico aunque cambien los signos", () => {
    const match = findDuplicate("hola ana el iphone 15 pro esta a 1.200.000 quieres pasar a verlo", previous);
    expect(match).not.toBeNull();
  });

  it("bloquea uno casi idéntico", () => {
    const match = findDuplicate(
      "Hola Ana, el iPhone 15 Pro está a $1.200.000. ¿Querés pasar a verlo hoy?",
      previous,
    );
    expect(match?.kind).toBe("similar");
  });

  it("deja pasar un mensaje distinto y las cortesías breves", () => {
    expect(findDuplicate("Te reservo el equipo hasta el viernes, ¿te parece bien?", previous)).toBeNull();

    const short = [{ ...previous[0], normalizedText: "perfecto gracias", body: "Perfecto, gracias" }];
    expect(findDuplicate("Perfecto, gracias", short)).toBeNull();
  });

  it("la similitud es 1 para iguales y 0 para textos sin nada en común", () => {
    expect(similarity("hola", "hola")).toBe(1);
    expect(similarity("aaaa", "zzzz")).toBe(0);
  });
});

describe("Vencimiento del próximo contacto", () => {
  // 15:00 en Buenos Aires (UTC-3).
  const now = new Date("2026-10-14T18:00:00Z");

  it("un contacto de las 9:00 de hoy es 'hoy', no vencido", () => {
    expect(dueInfo(new Date("2026-10-14T12:00:00Z"), now).status).toBe("today");
  });

  it("detecta vencidos y futuros", () => {
    expect(dueInfo(new Date("2026-10-13T13:00:00Z"), now)).toMatchObject({ status: "overdue", days: -1 });
    expect(dueInfo(new Date("2026-10-15T13:00:00Z"), now).label).toBe("Mañana");
    expect(dueInfo(null, now).status).toBe("none");
  });

  it("el aviso diario ordena lo vencido primero y no manda nada vacío", () => {
    const lead = (id: string, at: string) => ({
      id,
      fullName: `Cliente ${id}`,
      stage: "CONSULTA" as const,
      nextContactAt: new Date(at),
      nextContactNote: null,
      pauseReason: null,
      deviceName: null,
    });

    const digest = buildDigest(
      "Sofía Ramírez",
      [lead("hoy", "2026-10-14T13:00:00Z"), lead("viejo", "2026-10-10T13:00:00Z")],
      "https://x.test",
      now,
    );
    expect(digest?.overdue).toBe(1);
    expect(digest?.today).toBe(1);
    expect(digest!.body.indexOf("Cliente viejo")).toBeLessThan(digest!.body.indexOf("Cliente hoy"));

    expect(buildDigest("Sofía", [lead("futuro", "2026-10-20T13:00:00Z")], "https://x.test", now)).toBeNull();
  });
});

describe("Reglas de WhatsApp", () => {
  const now = new Date("2026-10-14T18:00:00Z");

  it("la ventana de 24 h se mide desde el último mensaje de la persona", () => {
    expect(isWithinWindow(new Date("2026-10-14T10:00:00Z"), now)).toBe(true);
    expect(isWithinWindow(new Date("2026-10-13T10:00:00Z"), now)).toBe(false);
    expect(isWithinWindow(null, now)).toBe(false);
  });

  it("decide texto, plantilla o bloqueo", () => {
    const recent = new Date("2026-10-14T10:00:00Z");
    expect(decideSendMode({ lastInboundAt: recent, now, enforceWindow: true, templateAvailable: false }).mode).toBe("text");
    expect(decideSendMode({ lastInboundAt: null, now, enforceWindow: true, templateAvailable: true }).mode).toBe("template");
    expect(decideSendMode({ lastInboundAt: null, now, enforceWindow: true, templateAvailable: false }).mode).toBe("blocked");
    expect(decideSendMode({ lastInboundAt: null, now, enforceWindow: false, templateAvailable: false }).mode).toBe("text");
  });

  it("completa las variables de la plantilla", () => {
    expect(renderTemplate("Hola {{1}}, soy {{2}}", ["Ana", "Luis"])).toBe("Hola Ana, soy Luis");
  });

  it("convierte el número al formato de la API", () => {
    expect(toWhatsAppNumber("+5493624123456")).toBe("5493624123456");
    expect(toWhatsAppNumber("+5493624123456", true)).toBe("543624123456");
  });
});

describe("Firma del webhook de Meta", () => {
  const body = JSON.stringify({ hola: "mundo" });

  it("acepta la firma correcta y rechaza cualquier otra", () => {
    const header = signMetaBody("secreto", body);
    expect(verifyMetaSignature({ appSecret: "secreto", header, rawBody: body })).toBe(true);
    expect(verifyMetaSignature({ appSecret: "otro", header, rawBody: body })).toBe(false);
    expect(verifyMetaSignature({ appSecret: "secreto", header, rawBody: body + " " })).toBe(false);
    expect(verifyMetaSignature({ appSecret: "secreto", header: null, rawBody: body })).toBe(false);
    expect(verifyMetaSignature({ appSecret: "", header, rawBody: body })).toBe(false);
  });

  it("responde el challenge solo con el token correcto", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "abc", "hub.challenge": "123" });
    expect(answerChallenge(ok, "abc")).toBe("123");
    expect(answerChallenge(ok, "otro")).toBeNull();
    expect(answerChallenge(ok, "")).toBeNull();
  });
});

describe("Lectura del aviso de WhatsApp", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: "5493624123456", profile: { name: "Ana Pérez" } }],
              messages: [
                { id: "wamid.1", from: "5493624123456", timestamp: "1760000000", type: "text", text: { body: "Hola, ¿tienen iPhone 15?" } },
                { id: "wamid.2", from: "5493624123456", type: "image", image: {} },
                { id: "wamid.3", from: "5493624123456", type: "reaction", reaction: {} },
                { from: "5493624123456", type: "text", text: { body: "sin id" } },
              ],
              statuses: [
                { id: "wamid.9", status: "delivered", recipient_id: "5493624123456", timestamp: "1760000100" },
                { id: "wamid.8", status: "failed", errors: [{ code: 131047, title: "Re-engagement" }] },
                { id: "wamid.7", status: "rara" },
              ],
            },
          },
          { field: "otra_cosa", value: {} },
        ],
      },
    ],
  };

  it("extrae mensajes y estados, y descarta lo que no sirve", () => {
    const parsed = parseWhatsAppPayload(payload);

    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[0]).toMatchObject({ id: "wamid.1", name: "Ana Pérez", text: "Hola, ¿tienen iPhone 15?" });
    expect(parsed.messages[1].text).toContain("una imagen");
    expect(parsed.statuses).toHaveLength(2);
    expect(parsed.statuses[1]).toMatchObject({ status: "failed", errorCode: 131047 });
    expect(parsed.ignored).toBeGreaterThanOrEqual(3);
  });

  it("no se rompe con basura", () => {
    expect(parseWhatsAppPayload(null).messages).toEqual([]);
    expect(parseWhatsAppPayload({ object: "otra" }).messages).toEqual([]);
    expect(parseWhatsAppPayload({ object: "whatsapp_business_account", entry: "x" }).messages).toEqual([]);
  });
});

describe("Plantillas de WhatsApp", () => {
  const cita = TEMPLATE_CATALOG.find((t) => t.key === "CITA")!;
  const tema = TEMPLATE_CATALOG.find((t) => t.key === "RETOMAR")!;
  const now = new Date("2026-10-14T18:00:00Z");

  it("completa nombre y remitente solos y pide el tema", () => {
    const missing = buildTemplateParams(tema, { contactFirstName: "Ana", senderFirstName: "Luis", values: {}, now });
    expect(missing.ok).toBe(false);

    const ok = buildTemplateParams(tema, {
      contactFirstName: "Ana",
      senderFirstName: "Luis",
      values: { tema: "el iPhone 15\n  Pro" },
      now,
    });
    expect(ok).toEqual({ ok: true, params: ["Ana", "Luis", "el iPhone 15 Pro"] });
  });

  it("valida el día y la hora de la visita", () => {
    const params = (fecha: string, hora: string) =>
      buildTemplateParams(cita, { contactFirstName: "Ana", senderFirstName: "Luis", values: { fecha, hora }, now });

    expect(params("2026-10-20", "16:30")).toEqual({ ok: true, params: ["Ana", "martes 20/10", "16:30"] });
    expect(params("2026-10-01", "16:30").ok).toBe(false);
    expect(params("2026-10-20", "25:99").ok).toBe(false);
    expect(formatAppointmentDay("2026-02-30", now)).toBeNull();
  });
});

describe("IA: respaldo simulado y limpieza", () => {
  const base: DraftInput = {
    lead: {
      fullName: "Ana Pérez",
      stage: "CONSULTA",
      source: "WEB",
      interestNote: null,
      device: {
        title: "Apple iPhone 15",
        condition: "Nuevo sellado",
        storage: "128 GB",
        color: "Negro",
        batteryPercent: null,
        price: 1_000_000,
        available: true,
      },
    },
    signerName: "Sofía Ramírez",
    history: [{ direction: "IN", at: new Date(), body: "¿Cuánto sale en cuotas?" }],
    store: { name: "Paki", address: "", hours: "", plans: [{ type: "TARJETA", installments: 6, surchargePercent: 10 }] },
    catalog: [],
  };

  it("el borrador usa el precio real y se presenta la primera vez", () => {
    const { draft } = mockClassifyAndDraft(base);
    expect(draft).toContain("Hola Ana");
    expect(draft).toContain("soy Sofía de Paki");
    expect(draft).toMatch(/1\.000\.000/);
  });

  it("no se vuelve a presentar si el local ya escribió", () => {
    const { draft } = mockClassifyAndDraft({
      ...base,
      history: [
        { direction: "OUT", at: new Date(), body: "Hola Ana" },
        { direction: "IN", at: new Date(), body: "ok" },
      ],
    });
    expect(draft).not.toContain("soy Sofía");
  });

  it("si el equipo ya no está disponible, no lo ofrece", () => {
    const { draft } = mockClassifyAndDraft({
      ...base,
      lead: { ...base.lead, device: { ...base.lead.device!, available: false } },
      catalog: [{ title: "Apple iPhone 14", condition: "Usado", storage: "128 GB", price: 700_000 }],
    });
    expect(draft).toContain("ya no está disponible");
    expect(draft).toContain("iPhone 14");
  });

  it("sugiere prioridad alta cuando pide avanzar", () => {
    expect(mockPriority({ lastMessage: "Quiero reservarlo, paso hoy", stage: "CONSULTA", waitingHours: 1 }).level).toBe("ALTA");
    expect(mockPriority({ lastMessage: "Solo estoy mirando", stage: "CONSULTA", waitingHours: 1 }).level).toBe("BAJA");
    expect(mockPriority({ lastMessage: "¿Qué colores hay?", stage: "CONSULTA", waitingHours: 1 }).level).toBe("MEDIA");
  });

  it("deja el texto de la IA listo para WhatsApp", () => {
    expect(cleanDraftText("Hola<br>Ana\\n\\nChau<p>x</p>")).not.toMatch(/<|\\n/);
    expect(cleanDraftText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});
