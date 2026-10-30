// The rules for a Student's photo. Photos are stored in Postgres (see `studentPhoto`).
import { InvalidInput } from "../errors";

export type Photo = { contentType: string; data: Uint8Array };

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function checkPhoto(photo: Photo): void {
  if (!(PHOTO_TYPES as readonly string[]).includes(photo.contentType)) {
    throw new InvalidInput("errors.photoType");
  }
  if (photo.data.byteLength === 0 || photo.data.byteLength > MAX_PHOTO_BYTES) {
    throw new InvalidInput("errors.photoSize");
  }
}
