import type {
  AccessoryCategory,
  AuditAction,
  DeviceCondition,
  DeviceType,
  FinancingType,
  InstallmentStatus,
  InventoryStatus,
  PaymentMethod,
  PurchaseStatus,
  SaleStatus,
  StockMovementType,
  UserRole,
  UserStatus,
} from "@prisma/client";

/// Capacidades de almacenamiento ofrecidas en los formularios.
/// Se guardan en GB; agregar un valor acá no requiere migración.
export const STORAGE_OPTIONS_GB = [32, 64, 128, 256, 512, 1024, 2048] as const;

/// Devuelve "—" cuando el equipo no tiene almacenamiento propio (un parlante,
/// por ejemplo).
export function formatStorage(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return "—";
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  NUEVO_SELLADO: "Nuevo sellado",
  NUEVO_SIN_SELLAR: "Nuevo sin sellar",
  USADO: "Usado",
};

/// Explicación breve de cada estado, para formularios y para la tienda.
export const DEVICE_CONDITION_DESCRIPTIONS: Record<DeviceCondition, string> = {
  NUEVO_SELLADO: "Sin uso y en su caja original cerrada.",
  NUEVO_SIN_SELLAR: "Sin uso, pero con la caja o el film abierto.",
  USADO: "Con uso previo. Se informa el estado de la batería.",
};

/// Un equipo nuevo, sellado o no, no tiene uso previo.
export function isNewCondition(condition: DeviceCondition): boolean {
  return condition !== "USADO";
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  CELULAR: "Celular",
  TABLET: "Tablet",
  RELOJ: "Reloj",
  PARLANTE: "Parlante",
  CAMARA: "Cámara",
  OTRO: "Otro",
};

/// Qué campos aplican a cada tipo de equipo.
/// Un parlante no tiene IMEI ni almacenamiento; una cámara no reporta batería.
export const DEVICE_TYPE_FIELDS: Record<
  DeviceType,
  { imei: boolean; storage: boolean; battery: boolean }
> = {
  CELULAR: { imei: true, storage: true, battery: true },
  TABLET: { imei: false, storage: true, battery: true },
  RELOJ: { imei: false, storage: false, battery: true },
  PARLANTE: { imei: false, storage: false, battery: false },
  CAMARA: { imei: false, storage: false, battery: false },
  OTRO: { imei: false, storage: false, battery: false },
};

export const ACCESSORY_CATEGORY_LABELS: Record<AccessoryCategory, string> = {
  FUNDA: "Funda",
  TEMPLADO: "Vidrio templado",
  PROTECTOR: "Protector",
  CARGADOR: "Cargador",
  CABLE: "Cable",
  AURICULARES: "Auriculares",
  SOPORTE: "Soporte",
  BATERIA_EXTERNA: "Batería externa",
  OTRO: "Otro",
};

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  DISPONIBLE: "Disponible",
  VENDIDO: "Vendido",
  RESERVADO: "Reservado",
  INACTIVO: "Inactivo",
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  INGRESO: "Ingreso",
  VENTA: "Venta",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
  DEVOLUCION: "Devolución",
  BAJA: "Baja",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  OTRO: "Otro",
};

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETADA: "Completada",
  ANULADA: "Anulada",
};

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  BORRADOR: "Borrador",
  CONFIRMADA: "Confirmada",
  ANULADA: "Anulada",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRADOR: "Administrador",
  VENDEDOR: "Vendedor",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: "Inicio de sesión",
  CREAR_PRODUCTO: "Creación de producto",
  MODIFICAR_PRODUCTO: "Modificación de producto",
  MODIFICAR_PRECIO: "Modificación de precio",
  BAJA_PRODUCTO: "Baja de producto",
  INGRESO_STOCK: "Ingreso de stock",
  AJUSTE_STOCK: "Ajuste de stock",
  REGISTRAR_VENTA: "Registro de venta",
  ANULAR_VENTA: "Anulación de venta",
  CREAR_USUARIO: "Creación de usuario",
  MODIFICAR_USUARIO: "Modificación de usuario",
  DESACTIVAR_USUARIO: "Desactivación de usuario",
  CREAR_CLIENTE: "Creación de cliente",
  MODIFICAR_CLIENTE: "Modificación de cliente",
  CREAR_COMPRA: "Creación de compra",
  CONFIRMAR_COMPRA: "Confirmación de compra",
  REGISTRAR_PAGO_CUOTA: "Cobro de cuota",
  ANULAR_PAGO_CUOTA: "Anulación de cobro de cuota",
  ANULAR_COMPRA: "Anulación de compra",
  CREAR_PROVEEDOR: "Creación de proveedor",
  MODIFICAR_PROVEEDOR: "Modificación de proveedor",
  CREAR_ACCESORIO: "Creación de accesorio",
  MODIFICAR_ACCESORIO: "Modificación de accesorio",
  BAJA_ACCESORIO: "Baja de accesorio",
  MODIFICAR_CONFIGURACION: "Cambio en el catálogo",
};

export const FINANCING_TYPE_LABELS: Record<FinancingType, string> = {
  CONTADO: "Contado",
  TARJETA: "Cuotas con tarjeta",
  FINANCIACION_LOCAL: "Financiación del local",
};

export const FINANCING_TYPE_HINTS: Record<FinancingType, string> = {
  CONTADO: "Se cobra el total en el momento.",
  TARJETA: "El banco liquida el total al local. El cliente no queda debiendo.",
  FINANCIACION_LOCAL: "El cliente le queda debiendo al local. Genera cuotas a cobrar.",
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  ANULADA: "Anulada",
};

/// El estado "vencida" se deriva de la fecha, no se almacena.
export type InstallmentDisplayStatus = InstallmentStatus | "VENCIDA";

export const INSTALLMENT_DISPLAY_LABELS: Record<InstallmentDisplayStatus, string> = {
  ...INSTALLMENT_STATUS_LABELS,
  VENCIDA: "Vencida",
};

export const PAGE_SIZE = 20;
