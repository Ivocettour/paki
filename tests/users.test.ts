import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { testDb, resetDatabase, seedFixtures, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import {
  changeOwnPassword,
  createUser,
  listUsers,
  resetUserPassword,
  setUserStatus,
  updateUser,
} from "@/lib/services/users";

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

const newUser = {
  firstName: "Nuevo",
  lastName: "Usuario",
  email: "nuevo@local.com",
  role: UserRole.VENDEDOR,
  password: "Segura123",
  confirmPassword: "Segura123",
};

const noFilters = {};

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Alta de usuarios", () => {
  it("crea el usuario con la contraseña hasheada y lo audita", async () => {
    const { id } = await createUser(newUser);

    const user = await testDb.user.findUniqueOrThrow({ where: { id } });
    expect(user.email).toBe("nuevo@local.com");
    expect(user.status).toBe(UserStatus.ACTIVO);

    // La contraseña nunca se guarda en texto plano.
    expect(user.passwordHash).not.toBe("Segura123");
    expect(await bcrypt.compare("Segura123", user.passwordHash)).toBe(true);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: id, action: "CREAR_USUARIO" },
    });
    expect(audit.userId).toBe(fixtures.adminId);
    // La auditoría no debe filtrar la contraseña, ni siquiera hasheada.
    expect(JSON.stringify(audit.changes)).not.toContain("Segura123");
    expect(JSON.stringify(audit.changes)).not.toContain(user.passwordHash);
  });

  it("rechaza un email repetido con un mensaje del dominio", async () => {
    await createUser(newUser);

    await expect(createUser(newUser)).rejects.toThrow(/Ya existe un usuario/);
    expect(await testDb.user.count()).toBe(3);
  });

  it("un vendedor no puede crear usuarios", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(createUser(newUser)).rejects.toThrow(/No tenés permisos/);
    expect(await testDb.user.count()).toBe(2);
  });
});

describe("Protección contra quedarse sin administradores", () => {
  /*
   * Nota sobre esta guarda.
   *
   * Hoy el permiso `usuarios.desactivar` lo tienen únicamente los
   * administradores activos. Por eso, si el objetivo es el único administrador
   * activo, quien ejecuta la acción solo puede ser él mismo, y lo frena la
   * regla de "no podés desactivar tu propia cuenta".
   *
   * El conteo de administradores restantes es defensa en profundidad: cubre el
   * día en que otro rol reciba este permiso. Para verificarlo hay que forzar
   * el escenario, con un actor que tenga el permiso sin ser administrador
   * activo en la base.
   */
  it("no permite desactivar al único administrador activo", async () => {
    const otro = await createUser(newUser); // VENDEDOR en la base
    actAs({ id: otro.id, role: "ADMINISTRADOR" }); // con permiso, no administrador real

    await expect(setUserStatus(fixtures.adminId, UserStatus.INACTIVO)).rejects.toThrow(
      /único administrador activo/,
    );

    const stillActive = await testDb.user.findUniqueOrThrow({
      where: { id: fixtures.adminId },
    });
    expect(stillActive.status).toBe(UserStatus.ACTIVO);
  });

  it("el sistema nunca queda sin administradores por la vía alcanzable", async () => {
    // Con un solo administrador, la única forma de dejar el sistema sin
    // administración sería que se desactivara a sí mismo. Está bloqueado.
    expect((await listUsers(noFilters)).activeAdmins).toBe(1);

    await expect(setUserStatus(fixtures.adminId, UserStatus.INACTIVO)).rejects.toThrow(
      /tu propia cuenta/,
    );

    expect((await listUsers(noFilters)).activeAdmins).toBe(1);
  });

  it("no permite quitarle el rol al único administrador activo", async () => {
    const vendedor = await createUser(newUser);
    actAs({ id: vendedor.id, role: "ADMINISTRADOR" });

    await expect(
      updateUser(fixtures.adminId, {
        firstName: "Ada",
        lastName: "Admin",
        email: "admin@test.com",
        role: UserRole.VENDEDOR,
      }),
    ).rejects.toThrow(/único administrador activo/);
  });

  it("nadie puede desactivar su propia cuenta", async () => {
    await expect(setUserStatus(fixtures.adminId, UserStatus.INACTIVO)).rejects.toThrow(
      /tu propia cuenta/,
    );
  });

  it("nadie puede quitarse a sí mismo el rol de administrador", async () => {
    // Existe otro administrador, así que la regla que aplica es la de no
    // degradarse a uno mismo.
    await createUser({ ...newUser, email: "admin2@local.com", role: UserRole.ADMINISTRADOR });

    await expect(
      updateUser(fixtures.adminId, {
        firstName: "Ada",
        lastName: "Admin",
        email: "admin@test.com",
        role: UserRole.VENDEDOR,
      }),
    ).rejects.toThrow(/a vos mismo/);
  });

  it("permite degradar a un administrador cuando queda otro activo", async () => {
    const otro = await createUser({
      ...newUser,
      email: "admin2@local.com",
      role: UserRole.ADMINISTRADOR,
    });

    await updateUser(otro.id, {
      firstName: "Nuevo",
      lastName: "Usuario",
      email: "admin2@local.com",
      role: UserRole.VENDEDOR,
    });

    const updated = await testDb.user.findUniqueOrThrow({ where: { id: otro.id } });
    expect(updated.role).toBe(UserRole.VENDEDOR);
  });
});

describe("Desactivación y reactivación", () => {
  it("desactivar conserva el historial de operaciones", async () => {
    const vendedor = await createUser(newUser);

    // Se le atribuye una operación previa.
    const brand = await testDb.brand.findFirstOrThrow();
    const model = await testDb.deviceModel.findFirstOrThrow({ where: { brandId: brand.id } });
    const device = await testDb.device.create({
      data: {
        modelId: model.id,
        color: "Negro",
        storageGb: 128,
        condition: "NUEVO_SELLADO",
        imei: "350001000000018",
        salePrice: 500_000,
        createdById: vendedor.id,
      },
    });

    await setUserStatus(vendedor.id, UserStatus.INACTIVO);

    // El usuario sigue existiendo y el equipo sigue atribuido a él.
    const stored = await testDb.user.findUniqueOrThrow({ where: { id: vendedor.id } });
    expect(stored.status).toBe(UserStatus.INACTIVO);

    const storedDevice = await testDb.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(storedDevice.createdById).toBe(vendedor.id);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: vendedor.id, action: "DESACTIVAR_USUARIO" },
    });
    expect(audit.changes).toMatchObject({
      estado: { anterior: "ACTIVO", nuevo: "INACTIVO" },
    });
  });

  it("se puede reactivar a un usuario desactivado", async () => {
    const vendedor = await createUser(newUser);
    await setUserStatus(vendedor.id, UserStatus.INACTIVO);
    await setUserStatus(vendedor.id, UserStatus.ACTIVO);

    const stored = await testDb.user.findUniqueOrThrow({ where: { id: vendedor.id } });
    expect(stored.status).toBe(UserStatus.ACTIVO);
  });

  it("no se puede desactivar dos veces", async () => {
    const vendedor = await createUser(newUser);
    await setUserStatus(vendedor.id, UserStatus.INACTIVO);

    await expect(setUserStatus(vendedor.id, UserStatus.INACTIVO)).rejects.toThrow(
      /ya está desactivado/,
    );
  });

  it("un vendedor no puede desactivar usuarios", async () => {
    const vendedor = await createUser(newUser);
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(setUserStatus(vendedor.id, UserStatus.INACTIVO)).rejects.toThrow(
      /No tenés permisos/,
    );
  });
});

describe("Contraseñas", () => {
  it("el administrador restablece la contraseña de otro usuario", async () => {
    const vendedor = await createUser(newUser);

    await resetUserPassword(vendedor.id, {
      password: "OtraClave456",
      confirmPassword: "OtraClave456",
    });

    const stored = await testDb.user.findUniqueOrThrow({ where: { id: vendedor.id } });
    expect(await bcrypt.compare("OtraClave456", stored.passwordHash)).toBe(true);
    // La anterior deja de servir.
    expect(await bcrypt.compare("Segura123", stored.passwordHash)).toBe(false);
  });

  it("el usuario cambia su propia contraseña verificando la actual", async () => {
    const vendedor = await createUser(newUser);
    actAs({ id: vendedor.id, role: "VENDEDOR" });

    await changeOwnPassword({
      currentPassword: "Segura123",
      password: "NuevaClave789",
      confirmPassword: "NuevaClave789",
    });

    const stored = await testDb.user.findUniqueOrThrow({ where: { id: vendedor.id } });
    expect(await bcrypt.compare("NuevaClave789", stored.passwordHash)).toBe(true);
  });

  it("rechaza el cambio si la contraseña actual es incorrecta", async () => {
    const vendedor = await createUser(newUser);
    actAs({ id: vendedor.id, role: "VENDEDOR" });

    await expect(
      changeOwnPassword({
        currentPassword: "EstaNoEs123",
        password: "NuevaClave789",
        confirmPassword: "NuevaClave789",
      }),
    ).rejects.toThrow(/contraseña actual no es correcta/);

    const stored = await testDb.user.findUniqueOrThrow({ where: { id: vendedor.id } });
    expect(await bcrypt.compare("Segura123", stored.passwordHash)).toBe(true);
  });
});

describe("Listado de usuarios", () => {
  it("informa cuántos administradores activos quedan", async () => {
    const result = await listUsers(noFilters);
    expect(result.activeAdmins).toBe(1);

    await createUser({ ...newUser, email: "admin2@local.com", role: UserRole.ADMINISTRADOR });

    expect((await listUsers(noFilters)).activeAdmins).toBe(2);
  });

  it("marca cuál es la propia cuenta", async () => {
    const result = await listUsers(noFilters);
    const self = result.items.find((item) => item.isSelf);

    expect(self?.id).toBe(fixtures.adminId);
  });

  it("un vendedor no puede listar usuarios", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(listUsers(noFilters)).rejects.toThrow(/No tenés permisos/);
  });
});
