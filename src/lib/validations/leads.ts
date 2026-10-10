import { z } from "zod";
import { LeadPriority, LeadSource, LeadStage } from "@prisma/client";
import { normalizeEmail, normalizePhone } from "@/lib/domain/phone";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/// Formulario público de la tienda: consulta por un equipo.
export const storeInquirySchema = z
  .object({
    deviceId: z.string().trim().max(40).optional(),
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Ingresá tu nombre." })
      .max(120, { error: "El nombre es demasiado largo." }),
    phone: optionalText(40),
    email: optionalText(160),
    message: z
      .string()
      .trim()
      .min(5, { error: "Escribí tu consulta (mínimo 5 caracteres)." })
      .max(1000, { error: "Máximo 1000 caracteres." }),
    /// Campo trampa: las personas no lo ven ni lo completan, los programas sí.
    website: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Dejanos un teléfono o un correo para poder responderte.",
      });
      return;
    }
    if (data.phone && !normalizePhone(data.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "El teléfono no parece válido." });
    }
    if (data.email && !normalizeEmail(data.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "El correo no parece válido." });
    }
  });

export type StoreInquiryInput = z.input<typeof storeInquirySchema>;

export const sendReplySchema = z.object({
  leadId: z.string().min(1),
  body: z.string().max(4000, { error: "El mensaje es demasiado largo." }).default(""),
  draftId: z.string().nullish(),
  markPriceSent: z.boolean().optional(),
  nextContactDays: z.number().int().min(1).max(365).optional(),
  template: z
    .object({ key: z.string().min(1), values: z.record(z.string(), z.string()) })
    .optional(),
});

export const incomingSchema = z.object({
  leadId: z.string().min(1).optional(),
  phone: z.string().trim().max(40).optional(),
  fullName: z.string().trim().max(120).optional(),
  body: z
    .string()
    .trim()
    .min(1, { error: "Pegá o escribí el mensaje que te mandaron." })
    .max(4000, { error: "El mensaje es demasiado largo." }),
});

export const manualReplySchema = z.object({
  leadId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, { error: "Pegá o escribí lo que le mandaste." })
    .max(4000, { error: "El mensaje es demasiado largo." }),
  draftId: z.string().nullish(),
  markPriceSent: z.boolean().optional(),
  nextContactDays: z.number().int().min(1).max(365).optional(),
});

export const updateFollowUpSchema = z
  .object({
    stage: z.enum(LeadStage, { error: "Elegí una etapa." }),
    /// Fecha (aaaa-mm-dd) del próximo contacto; vacío = sin fecha.
    nextContactDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Fecha inválida." })
      .nullish(),
    nextContactNote: optionalText(200),
    pauseReason: optionalText(300),
    lostReason: optionalText(300),
    manualPriority: z.enum(LeadPriority).nullish(),
    interestNote: optionalText(200),
  })
  .superRefine((data, ctx) => {
    if (data.stage === LeadStage.EN_PAUSA && !data.pauseReason) {
      ctx.addIssue({
        code: "custom",
        path: ["pauseReason"],
        message: "Indicá el motivo de la pausa.",
      });
    }
    if (data.stage === LeadStage.PERDIDO && !data.lostReason) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: "Indicá por qué se perdió.",
      });
    }
  });

export type UpdateFollowUpInput = z.input<typeof updateFollowUpSchema>;

export const noteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { error: "Escribí la nota." })
    .max(2000, { error: "Máximo 2000 caracteres." }),
});

export const manualLeadSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Ingresá el nombre." })
      .max(120, { error: "El nombre es demasiado largo." }),
    phone: optionalText(40),
    email: optionalText(160),
    interestNote: optionalText(200),
    note: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Hace falta un teléfono o un correo.",
      });
      return;
    }
    if (data.phone && !normalizePhone(data.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "El teléfono no parece válido." });
    }
    if (data.email && !normalizeEmail(data.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "El correo no parece válido." });
    }
  });

export type ManualLeadInput = z.input<typeof manualLeadSchema>;

export const inboxFiltersSchema = z.object({
  show: z.enum(["sin_responder", "todas"]).default("sin_responder"),
  who: z.enum(["todos", "mias", "sin_asignar"]).default("todos"),
  page: z.coerce.number().int().positive().max(500).default(1),
});

export const boardFiltersSchema = z.object({
  assignee: z.string().max(40).optional(),
  source: z.enum(LeadSource).optional(),
});

export const simulatorSchema = z.object({
  channel: z.enum(["WEB", "WHATSAPP"]),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40),
  body: z.string().trim().min(1).max(4000),
});
