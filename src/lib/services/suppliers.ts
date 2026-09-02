import { Prisma, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { toNumber } from "@/lib/serialize";
import { diffFields, recordAudit } from "./audit";
import type { SupplierFilters, SupplierInput } from "@/lib/validations/supplier";

const AUDITED_FIELDS = ["name", "cuit", "phone", "email", "address", "notes"] as const;

function translateUniqueNameError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("name")
  ) {
    throw errors.conflicto("Ya existe un proveedor con ese nombre.");
  }
  throw error;
}

export async function listSuppliers(filters: SupplierFilters) {
  await requirePermission("proveedores.ver");

  const where: Prisma.SupplierWhereInput = filters.search
    ? {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { cuit: { contains: filters.search } },
          { email: { contains: filters.search, mode: "insensitive" } },
        ],
      }
    : {};

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cuit: true,
      phone: true,
      email: true,
      address: true,
      _count: { select: { purchases: true } },
    },
  });

  // El total comprado considera solo las compras efectivamente confirmadas.
  const totals = await prisma.purchase.groupBy({
    by: ["supplierId"],
    where: { status: PurchaseStatus.CONFIRMADA },
    _sum: { total: true },
  });

  const totalBySupplier = new Map(
    totals.map((row) => [row.supplierId, toNumber(row._sum.total)]),
  );

  return suppliers.map((supplier) => ({
    ...supplier,
    purchaseCount: supplier._count.purchases,
    totalPurchased: totalBySupplier.get(supplier.id) ?? 0,
  }));
}

export async function createSupplier(input: SupplierInput): Promise<{ id: string }> {
  const user = await requirePermission("proveedores.gestionar");

  try {
    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          name: input.name,
          cuit: input.cuit ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "CREAR_PROVEEDOR",
        entity: "Supplier",
        entityId: supplier.id,
        changes: { nombre: { anterior: null, nuevo: input.name } },
      });

      return supplier;
    });
  } catch (error) {
    translateUniqueNameError(error);
  }
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<void> {
  const user = await requirePermission("proveedores.gestionar");

  const current = await prisma.supplier.findUnique({
    where: { id },
    select: { name: true, cuit: true, phone: true, email: true, address: true, notes: true },
  });

  if (!current) throw errors.noEncontrado("el proveedor");

  const changes = diffFields(
    current,
    {
      name: input.name,
      cuit: input.cuit ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    },
    AUDITED_FIELDS,
  );

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: {
          name: input.name,
          cuit: input.cuit ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_PROVEEDOR",
        entity: "Supplier",
        entityId: id,
        changes,
      });
    });
  } catch (error) {
    translateUniqueNameError(error);
  }
}

/// Proveedores disponibles para el formulario de compra.
export async function getSupplierOptions() {
  await requirePermission("compras.ver");

  return prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
