import { Prisma, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { toNumber } from "@/lib/serialize";
import { diffFields, recordAudit } from "./audit";
import type { CustomerFilters, CustomerInput } from "@/lib/validations/customer";

const AUDITED_FIELDS = ["firstName", "lastName", "dni", "phone", "email", "notes"] as const;

function translateUniqueDniError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("dni")
  ) {
    throw errors.conflicto("Ya existe un cliente registrado con ese DNI.");
  }
  throw error;
}

export async function listCustomers(filters: CustomerFilters) {
  await requirePermission("clientes.ver");

  const where: Prisma.CustomerWhereInput = filters.search
    ? {
        OR: [
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { dni: { contains: filters.search } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dni: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { sales: true } },
      },
    }),
  ]);

  return {
    items: rows.map((customer) => ({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      dni: customer.dni,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
      saleCount: customer._count.sales,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/// Historial de compras del cliente.
export async function getCustomerDetail(id: string) {
  await requirePermission("clientes.ver");

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dni: true,
      phone: true,
      email: true,
      notes: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
      sales: {
        orderBy: { saleDate: "desc" },
        select: {
          id: true,
          saleNumber: true,
          saleDate: true,
          total: true,
          status: true,
          financingType: true,
          seller: { select: { firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!customer) throw errors.noEncontrado("el cliente");

  const completed = customer.sales.filter((sale) => sale.status === SaleStatus.COMPLETADA);

  return {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    fullName: `${customer.firstName} ${customer.lastName}`,
    dni: customer.dni,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    createdAt: customer.createdAt,
    createdByName: `${customer.createdBy.firstName} ${customer.createdBy.lastName}`,
    totalPurchased: completed.reduce((sum, sale) => sum + toNumber(sale.total), 0),
    purchaseCount: completed.length,
    sales: customer.sales.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      total: toNumber(sale.total),
      status: sale.status,
      financingType: sale.financingType,
      sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
      itemCount: sale._count.items,
    })),
  };
}

export async function createCustomer(input: CustomerInput): Promise<{ id: string }> {
  const user = await requirePermission("clientes.crear");

  try {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          dni: input.dni ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
          createdById: user.id,
        },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "CREAR_CLIENTE",
        entity: "Customer",
        entityId: customer.id,
      });

      return customer;
    });
  } catch (error) {
    translateUniqueDniError(error);
  }
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<void> {
  const user = await requirePermission("clientes.editar");

  const current = await prisma.customer.findUnique({
    where: { id },
    select: {
      firstName: true,
      lastName: true,
      dni: true,
      phone: true,
      email: true,
      notes: true,
    },
  });

  if (!current) throw errors.noEncontrado("el cliente");

  const changes = diffFields(
    current,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      dni: input.dni ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      notes: input.notes ?? null,
    },
    AUDITED_FIELDS,
  );

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          dni: input.dni ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          notes: input.notes ?? null,
        },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CLIENTE",
        entity: "Customer",
        entityId: id,
        changes,
      });
    });
  } catch (error) {
    translateUniqueDniError(error);
  }
}

/// Búsqueda para el selector de clientes al registrar una venta.
export async function searchCustomers(term: string, limit = 10) {
  await requirePermission("clientes.ver");

  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  return prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: trimmed, mode: "insensitive" } },
        { lastName: { contains: trimmed, mode: "insensitive" } },
        { dni: { contains: trimmed } },
      ],
    },
    take: limit,
    orderBy: [{ lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, dni: true, phone: true },
  });
}
