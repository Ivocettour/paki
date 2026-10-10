import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice } from "@/lib/services/devices";
import {
  addDevicePhoto,
  deleteDevicePhoto,
  deleteModelImage,
  listDevicePhotos,
  setMainDevicePhoto,
  setModelImage,
  setUseModelImage,
} from "@/lib/services/device-photos";
import { getStoreDevice, listStoreDevices } from "@/lib/services/storefront";
import { storeDeviceFiltersSchema } from "@/lib/validations/storefront";
import { MAX_PHOTOS_PER_DEVICE, MAX_PHOTO_BYTES, detectImageType } from "@/lib/domain/images";
import { AppError } from "@/lib/errors";

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
  };
});

/// Cabecera mínima válida de cada formato (alcanza para la detección por firma).
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 9, 9]);

let fixtures: Fixtures;
let deviceId: string;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
  deviceId = (await createDevice(deviceInput({ modelId: fixtures.modelId }))).id;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Detección del tipo de imagen", () => {
  it("reconoce JPG, PNG y WebP por su contenido", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  it("rechaza lo que no es una imagen permitida, aunque se llame .jpg", () => {
    expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a......."))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("Fotos de un equipo", () => {
  it("guarda la foto con su tipo real y la deja como principal", async () => {
    const { id } = await addDevicePhoto(deviceId, JPEG);

    const { photos } = await listDevicePhotos(deviceId);
    expect(photos.map((p) => p.id)).toEqual([id]);

    const row = await testDb.devicePhoto.findUniqueOrThrow({ where: { id } });
    expect(row.contentType).toBe("image/jpeg");
    expect(row.sizeBytes).toBe(JPEG.length);
    expect(await testDb.auditLog.count({ where: { entityId: deviceId, action: "MODIFICAR_PRODUCTO" } })).toBe(1);
  });

  it("rechaza archivos que no son imágenes, vacíos o demasiado pesados", async () => {
    await expect(addDevicePhoto(deviceId, new TextEncoder().encode("no soy una imagen"))).rejects.toThrow(AppError);
    await expect(addDevicePhoto(deviceId, new Uint8Array())).rejects.toThrow(AppError);

    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set(JPEG);
    await expect(addDevicePhoto(deviceId, huge)).rejects.toThrow(/demasiado pesada/);
    expect(await testDb.devicePhoto.count()).toBe(0);
  });

  it("limita la cantidad de fotos por equipo", async () => {
    for (let i = 0; i < MAX_PHOTOS_PER_DEVICE; i++) await addDevicePhoto(deviceId, JPEG);
    await expect(addDevicePhoto(deviceId, JPEG)).rejects.toThrow(/hasta \d+ fotos/);
  });

  it("cambia la foto principal y la tienda usa esa", async () => {
    const first = await addDevicePhoto(deviceId, JPEG);
    const second = await addDevicePhoto(deviceId, PNG);

    await setMainDevicePhoto(second.id);
    expect((await listDevicePhotos(deviceId)).photos.map((p) => p.id)).toEqual([second.id, first.id]);

    const store = await getStoreDevice(deviceId);
    expect(store?.imageUrls).toEqual([`/api/fotos/${second.id}`, `/api/fotos/${first.id}`]);
  });

  it("al borrar la foto el equipo vuelve a mostrarse sin imágenes", async () => {
    const { id } = await addDevicePhoto(deviceId, WEBP);
    await deleteDevicePhoto(id);

    expect(await testDb.devicePhoto.count()).toBe(0);
    expect((await getStoreDevice(deviceId))?.imageUrls).toEqual([]);
  });

  it("el vendedor no puede subir ni borrar fotos", async () => {
    const { id } = await addDevicePhoto(deviceId, JPEG);

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await expect(addDevicePhoto(deviceId, JPEG)).rejects.toThrow(AppError);
    await expect(deleteDevicePhoto(id)).rejects.toThrow(AppError);
    await expect(setMainDevicePhoto(id)).rejects.toThrow(AppError);
  });
});

describe("Imagen del modelo", () => {
  it("la tienda la usa mientras el equipo no tenga fotos propias", async () => {
    const image = await setModelImage(fixtures.modelId, PNG);

    expect((await getStoreDevice(deviceId))?.imageUrls).toEqual([`/api/fotos/modelo/${image.id}`]);

    // Con una foto propia, manda la foto propia.
    const own = await addDevicePhoto(deviceId, JPEG);
    expect((await getStoreDevice(deviceId))?.imageUrls).toEqual([`/api/fotos/${own.id}`]);
  });

  it("se puede elegir mostrar el dibujo en lugar de la imagen del modelo", async () => {
    await setModelImage(fixtures.modelId, PNG);
    await setUseModelImage(deviceId, false);

    expect((await getStoreDevice(deviceId))?.imageUrls).toEqual([]);
    expect((await listDevicePhotos(deviceId)).useModelImage).toBe(false);
  });

  it("al reemplazarla cambia el id (para no servir la anterior desde la caché)", async () => {
    const first = await setModelImage(fixtures.modelId, PNG);
    const second = await setModelImage(fixtures.modelId, JPEG);

    expect(second.id).not.toBe(first.id);
    expect(await testDb.modelImage.count()).toBe(1);
  });

  it("al quitarla, los equipos vuelven al dibujo", async () => {
    await setModelImage(fixtures.modelId, PNG);
    await deleteModelImage(fixtures.modelId);
    expect((await getStoreDevice(deviceId))?.imageUrls).toEqual([]);
  });

  it("solo quien gestiona el catálogo la cambia", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await expect(setModelImage(fixtures.modelId, PNG)).rejects.toThrow(AppError);
  });

  it("los listados de la tienda traen la imagen del modelo sin cargar los bytes", async () => {
    const image = await setModelImage(fixtures.modelId, PNG);

    const page = await listStoreDevices(storeDeviceFiltersSchema.parse({}));
    expect(page.items[0].imageUrls).toEqual([`/api/fotos/modelo/${image.id}`]);
    // El objeto expuesto nunca contiene datos binarios.
    expect(JSON.stringify(page)).not.toContain("data");
  });
});
