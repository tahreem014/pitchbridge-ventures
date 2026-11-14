/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Profile from "@/pages/app/Profile";

const ME = "11111111-1111-4111-8111-111111111111";
const OLD_URL = `https://x.supabase.co/storage/v1/object/public/avatars/${ME}/old.webp`;

const db = vi.hoisted(() => ({
  profile: null as any,
  updates: [] as any[],
  updateError: null as any,
  uploadError: null as any,
  uploads: [] as { path: string; type: string }[],
  removed: [] as string[][],
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const chain = (result: unknown): any =>
  new Proxy({}, { get: (_t, prop) => (prop === "then" ? (resolve: any) => resolve(result) : () => chain(result)) });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => chain({ data: db.profile }),
      update: (payload: any) => { db.updates.push(payload); return chain({ error: db.updateError }); },
    }),
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => { db.uploads.push({ path, type: blob.type }); return { error: db.uploadError }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${path}` } }),
        remove: async (paths: string[]) => { db.removed.push(paths); return { error: null }; },
      }),
    },
  },
}));
// One stable object, like the real provider: a new object per render would re-trigger the page's data load forever.
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111", email: "me@example.com" }, role: "entrepreneur" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));
// jsdom has no canvas, so the crop/resize step is replaced; everything around it is real.
vi.mock("@/lib/avatar", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/avatar")>()),
  resizeToSquare: vi.fn(async () => new Blob(["resized"], { type: "image/webp" })),
}));

const baseProfile = { id: ME, full_name: "Tahreem Nisa", headline: "", bio: "", company: "", website: "", location: "", avatar_url: null };
const imageFile = (name = "me.png", type = "image/png") => new File(["pixels"], name, { type });
const choose = (file: File) => fireEvent.change(screen.getByLabelText("Upload profile photo"), { target: { files: [file] } });

beforeEach(() => {
  db.profile = { ...baseProfile };
  db.updates = [];
  db.updateError = null;
  db.uploadError = null;
  db.uploads = [];
  db.removed = [];
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("Profile photo", () => {
  it("offers to upload a photo when there is none", async () => {
    render(<Profile />);
    expect(await screen.findByRole("button", { name: /upload photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("offers to change or remove an existing photo", async () => {
    db.profile = { ...baseProfile, avatar_url: OLD_URL };
    render(<Profile />);
    expect(await screen.findByRole("button", { name: /change photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
  });

  it("uploads into the user's folder and saves the URL on the profile", async () => {
    render(<Profile />);
    await screen.findByRole("button", { name: /upload photo/i });
    choose(imageFile());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Profile photo updated"));
    expect(db.uploads).toHaveLength(1);
    expect(db.uploads[0].path).toMatch(new RegExp(`^${ME}/\\d+\\.webp$`));
    expect(db.updates).toEqual([{ avatar_url: `https://x.supabase.co/storage/v1/object/public/avatars/${db.uploads[0].path}` }]);
    expect(await screen.findByRole("button", { name: /change photo/i })).toBeInTheDocument();
  });

  it("deletes the previous photo after replacing it", async () => {
    db.profile = { ...baseProfile, avatar_url: OLD_URL };
    render(<Profile />);
    await screen.findByRole("button", { name: /change photo/i });
    choose(imageFile());

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(db.removed).toEqual([[`${ME}/old.webp`]]);
  });

  it("does not try to delete a Google photo it does not own", async () => {
    db.profile = { ...baseProfile, avatar_url: "https://lh3.googleusercontent.com/a/photo" };
    render(<Profile />);
    await screen.findByRole("button", { name: /change photo/i });
    choose(imageFile());

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(db.removed).toEqual([]);
  });

  it("rejects the wrong file type without uploading", async () => {
    render(<Profile />);
    await screen.findByRole("button", { name: /upload photo/i });
    choose(imageFile("logo.svg", "image/svg+xml"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toMatch(/PNG, JPG or WebP/);
    expect(db.uploads).toHaveLength(0);
    expect(db.updates).toHaveLength(0);
  });

  it("rolls back the uploaded file if saving the profile fails", async () => {
    db.updateError = { message: "permission denied" };
    render(<Profile />);
    await screen.findByRole("button", { name: /upload photo/i });
    choose(imageFile());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("permission denied"));
    expect(db.uploads).toHaveLength(1);
    expect(db.removed).toEqual([[db.uploads[0].path]]);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows the upload error to the user", async () => {
    db.uploadError = { message: "mime type image/png is not supported" };
    render(<Profile />);
    await screen.findByRole("button", { name: /upload photo/i });
    choose(imageFile());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("mime type image/png is not supported"));
    expect(db.updates).toHaveLength(0);
  });

  it("removes the photo: clears the profile and deletes the file", async () => {
    db.profile = { ...baseProfile, avatar_url: OLD_URL };
    render(<Profile />);
    fireEvent.click(await screen.findByRole("button", { name: /remove/i }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Profile photo removed"));
    expect(db.updates).toEqual([{ avatar_url: null }]);
    expect(db.removed).toEqual([[`${ME}/old.webp`]]);
    expect(await screen.findByRole("button", { name: /upload photo/i })).toBeInTheDocument();
  });

  it("leaves the photo alone when the normal Save button is used", async () => {
    db.profile = { ...baseProfile, avatar_url: OLD_URL };
    render(<Profile />);
    await screen.findByRole("button", { name: /change photo/i });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0]).not.toHaveProperty("avatar_url");
  });
});
