import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_SIZE = 512;
export const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

const ACCEPTED_TYPES = AVATAR_ACCEPT.split(",");
const EXTENSIONS: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };
const PUBLIC_PREFIX = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

// Returns a message for the user, or null when the file is acceptable.
export const validateAvatarFile = (file: Pick<File, "type" | "size">): string | null => {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please choose a PNG, JPG or WebP image.";
  if (file.size > MAX_AVATAR_INPUT_BYTES) return "That image is too large. Please choose one under 10 MB.";
  return null;
};

// Centre-crops to a square and scales down to at most 512px, so a huge photo
// becomes a small, uniform file. Never scales up.
export const resizeToSquare = async (file: Blob, size = AVATAR_SIZE): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Could not process that image.");
  return blob;
};

// Path inside the bucket for a public URL that points at our storage, otherwise null
// (for example a Google profile photo, which we must never try to delete).
export const avatarPathFromUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const at = url.indexOf(PUBLIC_PREFIX);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + PUBLIC_PREFIX.length).split("?")[0]);
  return path || null;
};

// Every upload gets a fresh file name, so the public URL changes and stale caches never show an old photo.
export const uploadAvatar = async (userId: string, blob: Blob): Promise<string> => {
  const ext = EXTENSIONS[blob.type] ?? "webp";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/webp",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
};

// Best effort: a leftover file is harmless, so failures are ignored.
export const removeAvatarFile = async (url: string | null | undefined) => {
  const path = avatarPathFromUrl(url);
  if (!path) return;
  try { await supabase.storage.from(AVATAR_BUCKET).remove([path]); } catch { /* ignore */ }
};
