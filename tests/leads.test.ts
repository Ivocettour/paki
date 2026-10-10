import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice } from "@/lib/services/devices";
import { ingestInbound } from "@/lib/services/leads/ingest";
import { sendReply } from "@/lib/services/leads/send";
import { getLeadDetail, listInbox } from "@/lib/services/leads/queries";
import {
  addNote,
  deleteNote,
  reassignLead,
  reassignPortfolio,
  snoozeLead,
  updateFollowUp,
} from "@/lib/services/leads/follow-up";
import { runDailyDigest } from "@/lib/services/leads/digest";
import { markRepliedManually } from "@/lib/services/leads/manual-reply";
import { handleWhatsAppEvents } from "@/lib/services/leads/channels";
import { parseWhatsAppPayload } from "@/lib/integrations/whatsapp/payload";
import {
  isRateLimited,
  resetRateLimit,
  submitStoreInquiry,
} from "@/lib/services/leads/public-inquiry";
import { updateFollowUpSchema } from "@/lib/validations/leads";
import { AppError } from "@/lib/errors";
import { navigationFor } from "@/lib/navigation";
import { can } from "@/lib/auth/permissions";

vi.mock("@/lib/db", async () => ({ prisma: (await import("./helpers/db")).testDb }));

vi.mock("@/lib/auth/session", async () => {
  const { errors } = await import("@/lib/errors");
  const { can } = await import("@/lib/auth/permissions");
  const { getMockedUser: current } = await import("./helpers/session");

  async function requireUser() {
    const user = current();
    if (!user) throw errors.noAutenticado();
    return user;
  }

  return {
    getCurrentUser: async () => current(),
    requireUser,
    requirePermission: async (permission: Parameters<typeof can>[1]) => {
      const user = await requireUser();
      if (!can(user.role, permission)) throw errors.sinPermisos();
      return user;
    },
    requireAdmin: async () => {
      const user = await requireUser();
      if (user.role !== "ADMINISTRADOR") throw errors.sinPermisos();
      return user;
    },
  };
});

let fixtures: Fixtures;
let sellerB: string;

interface InboundFixture {
  channel: "WEB" | "WHATSAPP";
  fullName: string;
  phone?: string;
  deviceId?: string;
  body: string;
}

const ana: InboundFixture = {
  channel: "WEB",
  fullName: "Ana Pérez",
  phone: "362 412-3456",
  body: "Hola, ¿tienen el iPhone 15?",
};

beforeEach(async () => {
  resetRateLimit();
  await resetDatabase();
  fixtures = await seedFixtures();
  // Un segundo vendedor, para repartir y para probar que no se ven entre sí.
  sellerB = (
    await testDb.user.create({
      data: {
        firstName: "Diego",
        lastName: "Torres",
        email: "diego@test.com",
        passwordHash: "hash",
        role: "VENDEDOR",
      },
    })
  ).id;
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

async function newLead(overrides: Partial<InboundFixture> = {}) {
  const result = await ingestInbound({ ...ana, ...overrides });
  if (result.status !== "ok") throw new Error("no se pudo crear la consulta");
  return result.leadId;
}

describe("Entrada de consultas", () => {
  it("crea la consulta, la asigna a un vendedor y deja el mensaje y la etapa", async () => {
    const leadId = await newLead();

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("CONSULTA");
    expect(lead.phone).toBe("+5493624123456");
    expect(lead.needsReply).toBe(true);
    expect([fixtures.sellerId, sellerB]).toContain(lead.assigneeId);

    expect(await testDb.leadMessage.count({ where: { leadId, direction: "ENTRANTE" } })).toBe(1);
    expect(await testDb.leadStageChange.count({ where: { leadId } })).toBe(1);
  });

  it("reparte las consultas nuevas entre los vendedores", async () => {
    const first = await newLead({ phone: "362 400-0001", fullName: "Uno Uno" });
    const second = await newLead({ phone: "362 400-0002", fullName: "Dos Dos" });

    const [a, b] = await Promise.all(
      [first, second].map((id) => testDb.lead.findUniqueOrThrow({ where: { id } })),
    );
    expect(a.assigneeId).not.toBe(b.assigneeId);
  });

  it("unifica a la misma persona por teléfono aunque lo escriba distinto", async () => {
    const first = await newLead({ phone: "+54 9 362 412-3456" });
    const again = await ingestInbound({
      channel: "WHATSAPP",
      fullName: "Ana P.",
      phone: "0362 15 4123456",
      email: "ana@mail.com",
      body: "¿Siguen teniendo stock?",
      externalId: "wamid.1",
    });

    expect(again).toMatchObject({ status: "ok", created: false, unifiedBy: "phone" });
    expect(await testDb.lead.count()).toBe(1);

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: first } });
    // Se completó lo que faltaba, sin pisar el nombre ya cargado.
    expect(lead.email).toBe("ana@mail.com");
    expect(lead.fullName).toBe("Ana Pérez");
    expect(await testDb.leadMessage.count({ where: { leadId: first } })).toBe(2);
  });

  it("no procesa dos veces el mismo aviso del canal", async () => {
    const input = { ...ana, channel: "WHATSAPP" as const, externalId: "wamid.dup" };
    expect((await ingestInbound(input)).status).toBe("ok");
    expect((await ingestInbound(input)).status).toBe("duplicate-event");
    expect(await testDb.leadMessage.count()).toBe(1);
  });

  it("rechaza datos inválidos sin guardar nada", async () => {
    expect((await ingestInbound({ ...ana, phone: undefined })).status).toBe("invalid");
    expect((await ingestInbound({ ...ana, phone: "123" })).status).toBe("invalid");
    expect((await ingestInbound({ ...ana, body: "" })).status).toBe("invalid");
    expect(await testDb.lead.count()).toBe(0);
  });

  it("quien estaba perdido y vuelve a escribir se reabre para hoy", async () => {
    const leadId = await newLead();
    await testDb.lead.update({
      where: { id: leadId },
      data: { stage: "PERDIDO", lostReason: "Compró en otro lado", nextContactAt: null },
    });

    await ingestInbound({ ...ana, body: "Me arrepentí, ¿sigue disponible?" });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("CONSULTA");
    expect(lead.lostReason).toBeNull();
    expect(lead.nextContactAt).not.toBeNull();
    expect(lead.needsReply).toBe(true);
  });

  it("asocia el equipo solo si existe", async () => {
    const { id: deviceId } = await createDevice(deviceInput({ modelId: fixtures.modelId }));

    const ok = await newLead({ phone: "362 400-0003", fullName: "Con Equipo" });
    await ingestInbound({ ...ana, phone: "362 400-0004", fullName: "Equipo Real", deviceId });
    await ingestInbound({ ...ana, phone: "362 400-0005", fullName: "Equipo Falso", deviceId: "inventado" });

    expect((await testDb.lead.findUniqueOrThrow({ where: { id: ok } })).deviceId).toBeNull();
    expect((await testDb.lead.findFirstOrThrow({ where: { fullName: "Equipo Real" } })).deviceId).toBe(deviceId);
    expect((await testDb.lead.findFirstOrThrow({ where: { fullName: "Equipo Falso" } })).deviceId).toBeNull();
  });
});

describe("Quién ve qué", () => {
  it("el vendedor solo ve las consultas que le asignaron; el administrador ve todas", async () => {
    const mine = await newLead({ phone: "362 400-0010", fullName: "De Sofía" });
    const theirs = await newLead({ phone: "362 400-0011", fullName: "De Diego" });
    await testDb.lead.update({ where: { id: mine }, data: { assigneeId: fixtures.sellerId } });
    await testDb.lead.update({ where: { id: theirs }, data: { assigneeId: sellerB } });

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    const asSeller = await listInbox({ show: "todas", who: "todos", page: 1 });
    expect(asSeller.items.map((i) => i.fullName)).toEqual(["De Sofía"]);

    // No puede abrir la ajena escribiendo la URL.
    await expect(getLeadDetail(theirs)).rejects.toThrow(AppError);
    await expect(getLeadDetail(mine)).resolves.toMatchObject({ fullName: "De Sofía" });

    actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
    const asAdmin = await listInbox({ show: "todas", who: "todos", page: 1 });
    expect(asAdmin.items).toHaveLength(2);
  });

  it("el vendedor no puede responder, anotar ni reprogramar una consulta ajena", async () => {
    const theirs = await newLead();
    await testDb.lead.update({ where: { id: theirs }, data: { assigneeId: sellerB } });
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(sendReply({ leadId: theirs, body: "Hola" })).rejects.toThrow(AppError);
    await expect(addNote(theirs, "nota")).rejects.toThrow(AppError);
    await expect(snoozeLead(theirs, 3)).rejects.toThrow(AppError);
  });

  it("solo el administrador reasigna", async () => {
    const leadId = await newLead();
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await expect(reassignLead(leadId, sellerB)).rejects.toThrow(AppError);

    actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
    await reassignLead(leadId, sellerB);
    expect((await testDb.lead.findUniqueOrThrow({ where: { id: leadId } })).assigneeId).toBe(sellerB);
    expect(await testDb.auditLog.count({ where: { action: "REASIGNAR_CONSULTA" } })).toBe(1);
  });

  it("pasa toda una cartera a otra persona", async () => {
    const one = await newLead({ phone: "362 400-0020", fullName: "Uno" });
    const two = await newLead({ phone: "362 400-0021", fullName: "Dos" });
    await testDb.lead.updateMany({ where: { id: { in: [one, two] } }, data: { assigneeId: fixtures.sellerId } });

    const { moved } = await reassignPortfolio(fixtures.sellerId, { userId: sellerB });
    expect(moved).toBe(2);
    expect(await testDb.lead.count({ where: { assigneeId: sellerB } })).toBe(2);
  });

  it("los permisos y el menú reflejan el rol", () => {
    expect(can("VENDEDOR", "consultas.ver_propias")).toBe(true);
    expect(can("VENDEDOR", "consultas.responder")).toBe(true);
    expect(can("VENDEDOR", "consultas.ver_todas")).toBe(false);
    expect(can("VENDEDOR", "consultas.gestionar")).toBe(false);

    const hrefs = (role: "ADMINISTRADOR" | "VENDEDOR") =>
      navigationFor(role).flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs("VENDEDOR")).toContain("/consultas");
    expect(hrefs("VENDEDOR")).not.toContain("/canales");
    expect(hrefs("ADMINISTRADOR")).toContain("/canales");
  });
});

describe("Responder", () => {
  it("a quien consultó desde la tienda le sale una plantilla, y la consulta deja de esperar", async () => {
    const leadId = await newLead();

    const result = await sendReply({ leadId, body: "Hola Ana, sí, lo tenemos." });
    expect(result).toMatchObject({ status: "sent", viaTemplate: true });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.needsReply).toBe(false);

    const out = await testDb.leadMessage.findFirstOrThrow({ where: { leadId, direction: "SALIENTE" } });
    expect(out.sentById).toBe(fixtures.adminId);
    expect(out.status).toBe("ENVIADO");
    expect(await testDb.auditLog.count({ where: { action: "ENVIAR_MENSAJE" } })).toBe(1);
  });

  it("dentro de las 24 h de su último WhatsApp se envía texto libre", async () => {
    const leadId = await newLead({ channel: "WHATSAPP" });

    const result = await sendReply({ leadId, body: "Hola Ana, sí, lo tenemos disponible en negro." });
    expect(result).toMatchObject({ status: "sent", viaTemplate: false });
  });

  it("bloquea un mensaje repetido o casi igual", async () => {
    const leadId = await newLead({ channel: "WHATSAPP" });
    const text = "Hola Ana, el equipo está disponible y lo podés pasar a ver cuando quieras.";

    expect((await sendReply({ leadId, body: text })).status).toBe("sent");
    expect(await sendReply({ leadId, body: text })).toMatchObject({ status: "blocked", kind: "exact" });
    expect(await sendReply({ leadId, body: text.replace("quieras", "quieras hoy") })).toMatchObject({
      status: "blocked",
      kind: "similar",
    });
    expect(await testDb.leadMessage.count({ where: { leadId, direction: "SALIENTE" } })).toBe(1);
  });

  it("no deja escribirle a quien no dejó teléfono", async () => {
    const result = await ingestInbound({ ...ana, phone: undefined, email: "ana@mail.com" });
    if (result.status !== "ok") throw new Error("esperaba ok");

    expect(await sendReply({ leadId: result.leadId, body: "Hola" })).toMatchObject({ status: "error" });
  });

  it("al mandar el primer precio pasa a 'Precio enviado' y reprograma el contacto", async () => {
    const leadId = await newLead({ channel: "WHATSAPP" });

    await sendReply({
      leadId,
      body: "El equipo está a $900.000, ¿lo querés ver?",
      markPriceSent: true,
      nextContactDays: 3,
    });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("PRECIO_ENVIADO");
    expect(lead.nextContactAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await testDb.leadStageChange.count({ where: { leadId, toStage: "PRECIO_ENVIADO" } })).toBe(1);
  });
});

describe("Seguimiento", () => {
  it("exige motivo para pausar o dar por perdida una consulta", () => {
    expect(updateFollowUpSchema.safeParse({ stage: "EN_PAUSA" }).success).toBe(false);
    expect(updateFollowUpSchema.safeParse({ stage: "EN_PAUSA", pauseReason: "Cobra a fin de mes" }).success).toBe(true);
    expect(updateFollowUpSchema.safeParse({ stage: "PERDIDO" }).success).toBe(false);
  });

  it("cambia la etapa, queda en el historial y en la auditoría", async () => {
    const leadId = await newLead();

    await updateFollowUp(leadId, {
      stage: "RESERVADO",
      nextContactDate: "2026-12-01",
      nextContactNote: "Viene a retirarlo",
    });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("RESERVADO");
    expect(lead.nextContactNote).toBe("Viene a retirarlo");

    const change = await testDb.leadStageChange.findFirstOrThrow({
      where: { leadId, toStage: "RESERVADO" },
    });
    expect(change.fromStage).toBe("CONSULTA");
    expect(change.userId).toBe(fixtures.adminId);
    expect(await testDb.auditLog.count({ where: { action: "MODIFICAR_SEGUIMIENTO", entityId: leadId } })).toBe(1);
  });

  it("al cerrar una consulta se borra el próximo contacto", async () => {
    const leadId = await newLead();
    await updateFollowUp(leadId, { stage: "VENDIDO", nextContactDate: "2026-12-01" });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("VENDIDO");
    expect(lead.nextContactAt).toBeNull();
  });

  it("no deja rastro si no cambió nada", async () => {
    const leadId = await newLead();
    const input = { stage: "PRECIO_ENVIADO" as const, nextContactDate: "2026-12-01" };

    await updateFollowUp(leadId, input);
    const audits = await testDb.auditLog.count();
    const changes = await testDb.leadStageChange.count({ where: { leadId } });

    // Repetir exactamente lo mismo no genera auditoría ni movimientos.
    await updateFollowUp(leadId, input);
    expect(await testDb.auditLog.count()).toBe(audits);
    expect(await testDb.leadStageChange.count({ where: { leadId } })).toBe(changes);
  });

  it("las notas internas se borran solo por su autor o por un administrador", async () => {
    const leadId = await newLead();
    await testDb.lead.update({ where: { id: leadId }, data: { assigneeId: fixtures.sellerId } });

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await addNote(leadId, "Pidió descuento");
    const note = await testDb.leadNote.findFirstOrThrow({ where: { leadId } });

    // La auditoría registra que hubo una nota, no su contenido.
    const audit = await testDb.auditLog.findFirstOrThrow({ where: { action: "NOTA_INTERNA" } });
    expect(JSON.stringify(audit.changes)).not.toContain("descuento");

    actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
    await deleteNote(note.id);
    expect(await testDb.leadNote.count()).toBe(0);
  });
});

describe("Aviso diario", () => {
  it("avisa lo que vence hoy y lo vencido, una sola vez por día", async () => {
    const leadId = await newLead();
    await testDb.lead.update({
      where: { id: leadId },
      data: { assigneeId: fixtures.sellerId, nextContactAt: new Date(Date.now() - 2 * 86_400_000) },
    });

    const first = await runDailyDigest();
    expect(first.sent).toHaveLength(1);
    expect(first.sent[0]).toMatchObject({ overdue: 1 });

    const second = await runDailyDigest();
    expect(second.sent).toHaveLength(0);
    expect(second.skipped[0].reason).toBe("ya se avisó hoy");
    expect(await testDb.staffNotification.count()).toBe(1);
  });

  it("no avisa nada si no hay nada para hoy", async () => {
    const leadId = await newLead();
    await testDb.lead.update({
      where: { id: leadId },
      data: { assigneeId: fixtures.sellerId, nextContactAt: new Date(Date.now() + 10 * 86_400_000) },
    });

    expect((await runDailyDigest()).sent).toHaveLength(0);
  });

  it("no avisa de las consultas cerradas", async () => {
    const leadId = await newLead();
    await testDb.lead.update({
      where: { id: leadId },
      data: { assigneeId: fixtures.sellerId, stage: "VENDIDO", nextContactAt: new Date(Date.now() - 86_400_000) },
    });

    expect((await runDailyDigest()).sent).toHaveLength(0);
  });
});

describe("Consulta pública desde la tienda", () => {
  const valid = { fullName: "Lucía Gómez", phone: "362 400-1111", message: "¿Lo tienen en color azul?" };

  it("crea la consulta mencionando el equipo", async () => {
    const { id: deviceId } = await createDevice(deviceInput({ modelId: fixtures.modelId }));

    const { leadId } = await submitStoreInquiry({ ...valid, deviceId }, "1.1.1.1");
    expect(leadId).not.toBeNull();

    const lead = await testDb.lead.findUniqueOrThrow({
      where: { id: leadId! },
      include: { messages: true },
    });
    expect(lead.source).toBe("WEB");
    expect(lead.deviceId).toBe(deviceId);
    expect(lead.messages[0].body).toContain("iPhone 15");
  });

  it("descarta en silencio lo que completa el campo trampa", async () => {
    const result = await submitStoreInquiry({ ...valid, website: "http://spam.test" }, "2.2.2.2");
    expect(result.leadId).toBeNull();
    expect(await testDb.lead.count()).toBe(0);
  });

  it("exige teléfono o correo y valida el formato", async () => {
    await expect(submitStoreInquiry({ ...valid, phone: undefined }, "3.3.3.3")).rejects.toThrow(AppError);
    await expect(submitStoreInquiry({ ...valid, phone: "abc" }, "3.3.3.3")).rejects.toThrow(AppError);
    await expect(submitStoreInquiry({ ...valid, message: "hi" }, "3.3.3.3")).rejects.toThrow(AppError);
  });

  it("limita las consultas seguidas de una misma dirección", async () => {
    for (let i = 0; i < 5; i++) expect(isRateLimited("4.4.4.4")).toBe(false);
    expect(isRateLimited("4.4.4.4")).toBe(true);
    // Otra dirección no se ve afectada.
    expect(isRateLimited("5.5.5.5")).toBe(false);
  });

  it("una misma persona que consulta dos veces sigue siendo una sola consulta", async () => {
    await submitStoreInquiry(valid, "6.6.6.6");
    await submitStoreInquiry({ ...valid, message: "Perdón, ¿y en negro?" }, "6.6.6.6");

    expect(await testDb.lead.count()).toBe(1);
    expect(await testDb.leadMessage.count()).toBe(2);
  });
});

describe("Webhook de WhatsApp", () => {
  const incoming = (id: string, from: string, text: string) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: from, profile: { name: "Ana Pérez" } }],
              messages: [{ id, from, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });

  it("crea la consulta y es idempotente si Meta reintenta el aviso", async () => {
    const payload = parseWhatsAppPayload(incoming("wamid.A", "5493624123456", "Hola, ¿tienen stock?"));

    const first = await handleWhatsAppEvents(payload);
    expect(first).toMatchObject({ received: 1, duplicates: 0, failed: 0 });

    const retry = await handleWhatsAppEvents(payload);
    expect(retry).toMatchObject({ received: 0, duplicates: 1 });

    expect(await testDb.lead.count()).toBe(1);
    expect(await testDb.leadMessage.count()).toBe(1);
    expect(await testDb.webhookLog.count()).toBe(2);
  });

  it("los estados de entrega solo avanzan y registran los fallos", async () => {
    const leadId = await newLead({ channel: "WHATSAPP" });
    await sendReply({ leadId, body: "Hola Ana, sí tenemos stock del equipo que consultaste." });
    const out = await testDb.leadMessage.findFirstOrThrow({ where: { leadId, direction: "SALIENTE" } });

    const status = (state: string, extra: object = {}) =>
      parseWhatsAppPayload({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ field: "messages", value: { statuses: [{ id: out.externalId, status: state, ...extra }] } }] }],
      });

    await handleWhatsAppEvents(status("read"));
    expect((await testDb.leadMessage.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("LEIDO");

    // Un aviso atrasado ("entregado") no retrocede el estado.
    await handleWhatsAppEvents(status("delivered"));
    expect((await testDb.leadMessage.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("LEIDO");

    await handleWhatsAppEvents(status("failed", { errors: [{ code: 131026, title: "No entregado" }] }));
    expect((await testDb.leadMessage.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("FALLIDO");
  });
});

describe("Respuesta enviada desde el WhatsApp propio", () => {
  it("queda registrada en la conversación y la consulta deja de esperar", async () => {
    const leadId = await newLead();
    const text = "Hola Ana, sí lo tenemos. Está a $900.000, ¿pasás a verlo?";

    await markRepliedManually({ leadId, body: text, markPriceSent: true, nextContactDays: 3 });

    const lead = await testDb.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.needsReply).toBe(false);
    expect(lead.stage).toBe("PRECIO_ENVIADO");
    expect(lead.nextContactAt!.getTime()).toBeGreaterThan(Date.now());

    const out = await testDb.leadMessage.findFirstOrThrow({ where: { leadId, direction: "SALIENTE" } });
    expect(out.body).toBe(text);
    expect(out.sentById).toBe(fixtures.adminId);
    // No se envió nada: no tiene id de mensaje de WhatsApp.
    expect(out.externalId).toBeNull();
    expect(await testDb.auditLog.count({ where: { action: "ENVIAR_MENSAJE", entityId: leadId } })).toBe(1);
  });

  it("no deja registrar dos veces el mismo texto ni un mensaje vacío", async () => {
    const leadId = await newLead();
    const text = "Hola Ana, te paso los datos del equipo que consultaste.";

    await markRepliedManually({ leadId, body: text });
    await expect(markRepliedManually({ leadId, body: text })).rejects.toThrow(/ya figura/);
    await expect(markRepliedManually({ leadId, body: "   " })).rejects.toThrow(AppError);
    expect(await testDb.leadMessage.count({ where: { leadId, direction: "SALIENTE" } })).toBe(1);
  });

  it("el vendedor solo puede registrarlo en sus propias consultas", async () => {
    const mine = await newLead({ phone: "362 400-0030", fullName: "Mía" });
    const theirs = await newLead({ phone: "362 400-0031", fullName: "Ajena" });
    await testDb.lead.update({ where: { id: mine }, data: { assigneeId: fixtures.sellerId } });
    await testDb.lead.update({ where: { id: theirs }, data: { assigneeId: sellerB } });

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await expect(markRepliedManually({ leadId: mine, body: "Hola, te respondo por acá." })).resolves.toBeUndefined();
    await expect(markRepliedManually({ leadId: theirs, body: "Hola, te respondo por acá." })).rejects.toThrow(AppError);
  });
});
