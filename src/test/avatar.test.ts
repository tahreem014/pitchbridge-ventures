import { describe, it, expect, vi, beforeEach } from "vitest";

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${path}` } })),
  from: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: (bucket: string) => { storage.from(bucket); return storage; } } },
}));

import { avatarPathFromUrl, removeAvatarFile, uploadAvatar, validateAvatarFile } from "@/lib/avatar";

beforeEach(() => {
  storage.upload.mockReset().mockResolvedValue({ error: null });
  storage.remove.mockReset().mockResolvedValue({ error: null });
  storage.from.mockReset();
});

describe("validateAvatarFile", () => {
  it("accepts PNG, JPEG and WebP", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validateAvatarFile({ type, size: 1000 })).toBeNull();
    }
  });

  it("rejects other file types, including SVG and GIF", () => {
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", "text/html", ""]) {
      expect(validateAvatarFile({ type, size: 1000 })).toMatch(/PNG, JPG or WebP/);
    }
  });

  it("rejects files over 10 MB but allows exactly 10 MB", () => {
    expect(validateAvatarFile({ type: "image/png", size: 10 * 1024 * 1024 })).toBeNull();
    expect(validateAvatarFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toMatch(/too large/);
  });
});

describe("avatarPathFromUrl", () => {
  it("extracts the storage path from our public URLs", () => {
    expect(avatarPathFromUrl("https://x.supabase.co/storage/v1/object/public/avatars/abc/123.webp")).toBe("abc/123.webp");
    expect(avatarPathFromUrl("https://x.supabase.co/storage/v1/object/public/avatars/abc/123.webp?t=1")).toBe("abc/123.webp");
  });

  it("returns null for pictures we do not own, such as Google photos", () => {
    expect(avatarPathFromUrl("https://lh3.googleusercontent.com/a/photo=s96-c")).toBeNull();
    expect(avatarPathFromUrl("https://i.pravatar.cc/150?img=12")).toBeNull();
    expect(avatarPathFromUrl(null)).toBeNull();
    expect(avatarPathFromUrl("")).toBeNull();
  });
});

describe("uploadAvatar", () => {
  it("stores the file in the user's own folder and returns its public URL", async () => {
    const url = await uploadAvatar("user-1", new Blob(["x"], { type: "image/webp" }));
    expect(storage.from).toHaveBeenCalledWith("avatars");
    const [path, , options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/\d+\.webp$/);
    expect(options).toMatchObject({ contentType: "image/webp" });
    expect(url).toBe(`https://x.supabase.co/storage/v1/object/public/avatars/${path}`);
  });

  it("uses a different file name each time, so caches never show an old photo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    await uploadAvatar("user-1", new Blob(["a"], { type: "image/webp" }));
    vi.setSystemTime(2000);
    await uploadAvatar("user-1", new Blob(["b"], { type: "image/webp" }));
    vi.useRealTimers();
    expect(storage.upload.mock.calls[0][0]).not.toBe(storage.upload.mock.calls[1][0]);
  });

  it("falls back to PNG naming when the browser could not produce WebP", async () => {
    await uploadAvatar("user-1", new Blob(["x"], { type: "image/png" }));
    expect(storage.upload.mock.calls[0][0]).toMatch(/\.png$/);
  });

  it("throws when the upload is rejected", async () => {
    storage.upload.mockResolvedValue({ error: { message: "mime type not allowed" } });
    await expect(uploadAvatar("user-1", new Blob(["x"], { type: "image/webp" }))).rejects.toMatchObject({ message: "mime type not allowed" });
  });
});

describe("removeAvatarFile", () => {
  it("deletes a file that lives in our bucket", async () => {
    await removeAvatarFile("https://x.supabase.co/storage/v1/object/public/avatars/user-1/1.webp");
    expect(storage.remove).toHaveBeenCalledWith(["user-1/1.webp"]);
  });

  it("never touches pictures hosted elsewhere", async () => {
    await removeAvatarFile("https://lh3.googleusercontent.com/a/photo");
    await removeAvatarFile(null);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("ignores delete failures", async () => {
    storage.remove.mockRejectedValue(new Error("network"));
    await expect(removeAvatarFile("https://x.supabase.co/storage/v1/object/public/avatars/user-1/1.webp")).resolves.toBeUndefined();
  });
});
