"use server";

import { revalidatePath } from "next/cache";
import {
  deleteDevicePhoto,
  deleteModelImage,
  setMainDevicePhoto,
  setUseModelImage,
} from "@/lib/services/device-photos";
import { runAction, type ActionResult } from "./types";

/// Las fotos se ven en la ficha del equipo y en la tienda.
function revalidatePhotos(deviceId: string) {
  revalidatePath(`/inventario/${deviceId}`);
  revalidatePath("/tienda", "layout");
}

export async function deletePhotoAction(photoId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const { deviceId } = await deleteDevicePhoto(photoId);
    revalidatePhotos(deviceId);
  });
}

export async function setMainPhotoAction(photoId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const { deviceId } = await setMainDevicePhoto(photoId);
    revalidatePhotos(deviceId);
  });
}

export async function setUseModelImageAction(deviceId: string, value: boolean): Promise<ActionResult<void>> {
  return runAction(async () => {
    await setUseModelImage(deviceId, value);
    revalidatePhotos(deviceId);
  });
}

export async function deleteModelImageAction(modelId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await deleteModelImage(modelId);
    revalidatePath("/configuracion");
    revalidatePath("/tienda", "layout");
  });
}
