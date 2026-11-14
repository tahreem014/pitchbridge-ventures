// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  MAX_FILE_BYTES, MAX_PDF_PAGES, downloadName, fetchStampedCopy, formatBytes, inspectFile, kindLabel, listSharedDocuments,
  removeDocument, storagePath, titleFromFileName, uploadDocument, validateFile,
} from "@/lib/pitchDocuments";

const IDEA = "a0000000-0000-4000-8000-000000000012";
const ME = "11111111-1111-4111-8111-111111111111";

const m = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), del: vi.fn(), rpc: vi.fn(), invoke: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => ({ select: () => ({ single: () => m.insert(row) }) }),
      delete: () => ({ eq: (column: string, value: string) => m.del(column, value) }),
    }),
    storage: { from: (bucket: string) => ({ upload: (...a: unknown[]) => m.upload(bucket, ...a), remove: (...a: unknown[]) => m.remove(bucket, ...a) }) },
    rpc: (...a: unknown[]) => m.rpc(...a),
    functions: { invoke: (...a: unknown[]) => m.invoke(...a) },
  },
}));

const makePdf = async (pages = 1) => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([300, 300]);
  return pdf.save();
};
const pdfFile = async (pages = 1, name = "deck.pdf") => new File([await makePdf(pages)], name, { type: "application/pdf" });
const pngBytes = () => new Uint8Array(readFileSync(resolve(process.cwd(), "public/apple-touch-icon.png")));
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

beforeEach(() => {
  Object.values(m).forEach(fn => fn.mockReset());
  m.upload.mockResolvedValue({ data: {}, error: null });
  m.remove.mockResolvedValue({ data: [], error: null });
  m.del.mockResolvedValue({ error: null });
});

describe("file helpers", () => {
  it("formats sizes for people", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB"); // whole megabytes have no decimal
  });

  it("names the kinds of file", () => {
    expect(kindLabel("application/pdf")).toBe("PDF");
    expect(kindLabel("image/png")).toBe("PNG image");
    expect(kindLabel("image/jpeg")).toBe("JPEG image");
    expect(kindLabel("application/zip")).toBe("File");
  });

  it("suggests a title from the file name", () => {
    expect(titleFromFileName("Pitch_Deck-v2.pdf")).toBe("Pitch Deck v2");
    expect(titleFromFileName("financials.PNG")).toBe("financials");
  });

  it("accepts PDF, PNG and JPEG within the size limit", () => {
    expect(validateFile({ name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateFile({ name: "a.png", type: "image/png", size: MAX_FILE_BYTES })).toBeNull();
    expect(validateFile({ name: "a.jpg", type: "image/jpeg", size: 1 })).toBeNull();
  });

  it("refuses other types, empty files and files over 10 MB", () => {
    expect(validateFile({ name: "a.zip", type: "application/zip", size: 10 })).toMatch(/Only PDF, PNG and JPEG/);
    expect(validateFile({ name: "a.webp", type: "image/webp", size: 10 })).toMatch(/Only PDF, PNG and JPEG/);
    expect(validateFile({ name: "a.pdf", type: "application/pdf", size: 0 })).toMatch(/empty/);
    expect(validateFile({ name: "a.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 })).toMatch(/The limit is 10 MB per file/);
  });

  it("builds a unique path inside the idea's own folder, with a safe name", () => {
    const a = storagePath(IDEA, "My Deck (FINAL) ✓.PDF");
    const b = storagePath(IDEA, "My Deck (FINAL) ✓.PDF");
    expect(a).toMatch(new RegExp(`^${IDEA}/[0-9a-f-]{36}-my-deck-final\\.pdf$`));
    expect(a).not.toBe(b);
    const sneaky = storagePath(IDEA, "../../etc/passwd.pdf");
    expect(sneaky.startsWith(`${IDEA}/`)).toBe(true);
    expect(sneaky.slice(IDEA.length + 1)).not.toContain("/");
    expect(sneaky).not.toContain("..");
  });

  it("names the download after the document", () => {
    expect(downloadName("Pitch deck (v2)")).toBe("pitch-deck-v2-confidential.pdf");
    expect(downloadName("???")).toBe("document-confidential.pdf");
  });
});

describe("inspectFile", () => {
  it("returns the SHA-256 fingerprint of the exact bytes", async () => {
    const bytes = await makePdf(2);
    const { sha256: fingerprint } = await inspectFile(new File([bytes], "deck.pdf", { type: "application/pdf" }));
    expect(fingerprint).toBe(sha256(bytes));
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts a real PNG", async () => {
    const bytes = pngBytes();
    const { sha256: fingerprint } = await inspectFile(new File([bytes], "logo.png", { type: "image/png" }));
    expect(fingerprint).toBe(sha256(bytes));
  });

  it("rejects a file whose contents do not match its type", async () => {
    const notPdf = new File(["just some text"], "deck.pdf", { type: "application/pdf" });
    await expect(inspectFile(notPdf)).rejects.toThrow(/do not match its type/);
    const pngPretendingToBeJpeg = new File([pngBytes()], "photo.jpg", { type: "image/jpeg" });
    await expect(inspectFile(pngPretendingToBeJpeg)).rejects.toThrow(/do not match its type/);
  });

  it("rejects a damaged PDF", async () => {
    const whole = await makePdf(3);
    const truncated = new File([whole.slice(0, Math.floor(whole.length / 2))], "deck.pdf", { type: "application/pdf" });
    await expect(inspectFile(truncated)).rejects.toThrow(/password-protected or damaged/);
  });

  it("rejects a PDF with too many pages", async () => {
    await expect(inspectFile(await pdfFile(MAX_PDF_PAGES + 1))).rejects.toThrow(new RegExp(`${MAX_PDF_PAGES + 1} pages`));
  });
});

describe("uploadDocument", () => {
  const row = (over = {}) => ({
    data: { id: "doc-1", title: "deck", file_path: "p", mime_type: "application/pdf", size_bytes: 100, created_at: "2026-10-26T10:00:00Z", ...over },
    error: null,
  });

  it("uploads the file into the idea's folder, then records its fingerprint", async () => {
    m.insert.mockResolvedValue(row());
    const file = await pdfFile(1, "Pitch_Deck.pdf");
    const doc = await uploadDocument({ ideaId: IDEA, userId: ME, file, title: "" });

    const [bucket, path, , options] = m.upload.mock.calls[0];
    expect(bucket).toBe("pitch-documents");
    expect(path).toMatch(new RegExp(`^${IDEA}/`));
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });

    const inserted = m.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({ idea_id: IDEA, title: "Pitch Deck", file_path: path, mime_type: "application/pdf", size_bytes: file.size, uploaded_by: ME });
    expect(inserted.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(doc).toMatchObject({ id: "doc-1", mimeType: "application/pdf", sizeBytes: 100 });
  });

  it("uses the title the founder typed", async () => {
    m.insert.mockResolvedValue(row());
    await uploadDocument({ ideaId: IDEA, userId: ME, file: await pdfFile(), title: "  Financial model  " });
    expect(m.insert.mock.calls[0][0].title).toBe("Financial model");
  });

  it("removes the uploaded file again if the record could not be saved, and explains the limit", async () => {
    m.insert.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy for table "pitch_documents"' } });
    await expect(uploadDocument({ ideaId: IDEA, userId: ME, file: await pdfFile(), title: "Deck" })).rejects.toThrow(/at most 10 documents/);
    expect(m.remove).toHaveBeenCalledWith("pitch-documents", [m.upload.mock.calls[0][1]]);
  });

  it("saves nothing if the upload itself fails", async () => {
    m.upload.mockResolvedValue({ data: null, error: { message: "Bucket not found" } });
    await expect(uploadDocument({ ideaId: IDEA, userId: ME, file: await pdfFile(), title: "Deck" })).rejects.toThrow("Bucket not found");
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("refuses bad files before anything is sent", async () => {
    const zip = new File(["x"], "a.zip", { type: "application/zip" });
    await expect(uploadDocument({ ideaId: IDEA, userId: ME, file: zip, title: "Zip" })).rejects.toThrow(/Only PDF, PNG and JPEG/);
    const fake = new File(["not a pdf"], "a.pdf", { type: "application/pdf" });
    await expect(uploadDocument({ ideaId: IDEA, userId: ME, file: fake, title: "Fake" })).rejects.toThrow(/do not match/);
    await expect(uploadDocument({ ideaId: IDEA, userId: ME, file: await pdfFile(), title: "x".repeat(121) })).rejects.toThrow(/120 characters/);
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });
});

describe("removeDocument", () => {
  const doc = { id: "doc-1", title: "Deck", filePath: `${IDEA}/abc-deck.pdf`, mimeType: "application/pdf", sizeBytes: 10, createdAt: "2026-10-26T10:00:00Z" };

  it("deletes the record, then the file", async () => {
    await removeDocument(doc);
    expect(m.del).toHaveBeenCalledWith("id", "doc-1");
    expect(m.remove).toHaveBeenCalledWith("pitch-documents", [doc.filePath]);
  });

  it("keeps the file if the record could not be deleted", async () => {
    m.del.mockResolvedValue({ error: { message: "nope" } });
    await expect(removeDocument(doc)).rejects.toThrow("nope");
    expect(m.remove).not.toHaveBeenCalled();
  });
});

describe("listSharedDocuments", () => {
  it("maps the server's answer, which has no storage path", async () => {
    m.rpc.mockResolvedValue({ data: [{ id: "d1", title: "Deck", mime_type: "application/pdf", size_bytes: 2048, created_at: "2026-10-26T10:00:00Z" }], error: null });
    const docs = await listSharedDocuments(IDEA);
    expect(m.rpc).toHaveBeenCalledWith("list_pitch_documents", { _idea_id: IDEA });
    expect(docs).toEqual([{ id: "d1", title: "Deck", mimeType: "application/pdf", sizeBytes: 2048, createdAt: "2026-10-26T10:00:00Z" }]);
  });

  it("throws the server's reason when access is refused", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "You do not have access to this pitch" } });
    await expect(listSharedDocuments(IDEA)).rejects.toThrow("You do not have access to this pitch");
  });
});

describe("fetchStampedCopy", () => {
  it("asks the server function for the document and returns the stamped file", async () => {
    const blob = new Blob(["%PDF-stamped"], { type: "application/pdf" });
    m.invoke.mockResolvedValue({ data: blob, error: null });
    expect(await fetchStampedCopy("doc-1")).toBe(blob);
    expect(m.invoke).toHaveBeenCalledWith("pitch-document", { body: { document_id: "doc-1" } });
  });

  it("shows the reason the server gave", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "You do not have access to this document" }), { status: 403 }),
    });
    m.invoke.mockResolvedValue({ data: null, error });
    await expect(fetchStampedCopy("doc-1")).rejects.toThrow("You do not have access to this document");
  });

  it("falls back to a plain message when the server gave no reason", async () => {
    m.invoke.mockResolvedValue({ data: null, error: new Error("Failed to send a request to the Edge Function") });
    await expect(fetchStampedCopy("doc-1")).rejects.toThrow("The document could not be opened. Please try again.");
  });

  it("does not accept an answer that is not a file", async () => {
    m.invoke.mockResolvedValue({ data: { hello: "world" }, error: null });
    await expect(fetchStampedCopy("doc-1")).rejects.toThrow(/could not be prepared/);
  });
});
