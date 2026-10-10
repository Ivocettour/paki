"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { generateDraft } from "@/lib/services/leads/draft";
import { submitStoreInquiry } from "@/lib/services/leads/public-inquiry";
import { runAction, type ActionResult } from "./types";

/// Consulta desde la tienda. Pública: no exige sesión.
export async function submitStoreInquiryAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    const h = await headers();
    // Detrás del proveedor, la dirección real viene en x-forwarded-for.
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconocida";

    const { leadId } = await submitStoreInquiry(input, ip);

    // El borrador se prepara después de responderle al cliente: no tiene por qué esperar.
    if (leadId) {
      after(async () => {
        try {
          await generateDraft(leadId);
        } catch (error) {
          console.error("[consulta] No se pudo preparar el borrador:", error);
        }
      });
    }
  });
}
