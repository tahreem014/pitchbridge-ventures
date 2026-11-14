import { supabase } from "@/integrations/supabase/client";

export const DOCUMENT_BUCKET = "pitch-documents";
export const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS = 10;
export const MAX_PDF_PAGES = 150;

// What an investor sees: no storage path, because they can never read the file itself.
export interface PitchDocument { id: string; title: string; mimeType: string; sizeBytes: number; createdAt: string }
// What the founder sees: also the path of their own original, so they can remove it.
export interface OwnDocument extends PitchDocument { filePath: string }

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / 1024 / 1024;
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`; // "10 MB", not "10.0 MB"
};

export const kindLabel = (mimeType: string) =>
  mimeType === "application/pdf" ? "PDF" : mimeType === "image/png" ? "PNG image" : mimeType === "image/jpeg" ? "JPEG image" : "File";

export const titleFromFileName = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

// Checks that can be made from the file's name, type and size alone (the contents are checked in inspectFile).
export const validateFile = (file: { name: string; type: string; size: number }): string | null => {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, PNG and JPEG files can be added.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) return `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)} per file.`;
  return null;
};

// A path that is unique per upload (files are never overwritten) and starts with the idea's id, which is
// what the storage policies use to decide who may touch it.
export const storagePath = (ideaId: string, fileName: string) => {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "document";
  return `${ideaId}/${crypto.randomUUID()}-${base}${ext ? `.${ext}` : ""}`;
};

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

const matchesType = (bytes: Uint8Array, mimeType: string) =>
  mimeType === "application/pdf" ? startsWith(bytes, [0x25, 0x50, 0x44, 0x46])        // %PDF
  : mimeType === "image/png" ? startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])
  : mimeType === "image/jpeg" ? startsWith(bytes, [0xff, 0xd8, 0xff])
  : false;

const toHex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");

// Reads the file once: confirms the contents really are what the name says, rejects PDFs the viewer could not
// stamp (locked, damaged or very long), and returns the fingerprint that is stored with the document.
export async function inspectFile(file: Blob & { type: string }): Promise<{ sha256: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesType(bytes, file.type)) throw new Error("The contents of this file do not match its type. Choose a real PDF, PNG or JPEG.");

  if (file.type === "application/pdf") {
    const { PDFDocument } = await import("pdf-lib");
    let pages: number;
    try {
      pages = (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
    } catch {
      throw new Error("This PDF is password-protected or damaged. Remove the password or export it again, then retry.");
    }
    if (pages > MAX_PDF_PAGES) throw new Error(`This PDF has ${pages} pages. Documents can have at most ${MAX_PDF_PAGES} pages.`);
  }

  return { sha256: toHex(await crypto.subtle.digest("SHA-256", bytes)) };
}

const friendlyDatabaseError = (message: string) =>
  /row-level security/i.test(message) ? `The document could not be added. An idea can have at most ${MAX_DOCUMENTS} documents.` : message;

const toOwn = (row: { id: string; title: string; file_path: string; mime_type: string; size_bytes: number; created_at: string }): OwnDocument => ({
  id: row.id, title: row.title, filePath: row.file_path, mimeType: row.mime_type, sizeBytes: row.size_bytes, createdAt: row.created_at,
});

const COLUMNS = "id, title, file_path, mime_type, size_bytes, created_at";

export async function listOwnDocuments(ideaId: string): Promise<OwnDocument[]> {
  const { data, error } = await supabase.from("pitch_documents").select(COLUMNS).eq("idea_id", ideaId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toOwn);
}

// The only list an investor can get: titles and sizes, after the server has checked access.
export async function listSharedDocuments(ideaId: string): Promise<PitchDocument[]> {
  const { data, error } = await supabase.rpc("list_pitch_documents", { _idea_id: ideaId });
  if (error) throw new Error(error.message);
  return (data ?? []).map(d => ({ id: d.id, title: d.title, mimeType: d.mime_type, sizeBytes: d.size_bytes, createdAt: d.created_at }));
}

export async function uploadDocument(input: { ideaId: string; userId: string; file: File; title: string }): Promise<OwnDocument> {
  const { ideaId, userId, file } = input;
  const problem = validateFile(file);
  if (problem) throw new Error(problem);
  const title = input.title.trim() || titleFromFileName(file.name);
  if (!title) throw new Error("Give the document a title.");
  if (title.length > 120) throw new Error("The title can have at most 120 characters.");

  const { sha256 } = await inspectFile(file);
  const path = storagePath(ideaId, file.name);

  const uploaded = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "0" });
  if (uploaded.error) throw new Error(uploaded.error.message);

  const { data, error } = await supabase.from("pitch_documents")
    .insert({ idea_id: ideaId, title, file_path: path, mime_type: file.type, size_bytes: file.size, sha256, uploaded_by: userId })
    .select(COLUMNS).single();
  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]); // do not leave a file nobody can see
    throw new Error(friendlyDatabaseError(error.message));
  }
  return toOwn(data);
}

export async function removeDocument(doc: OwnDocument): Promise<void> {
  const { error } = await supabase.from("pitch_documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(DOCUMENT_BUCKET).remove([doc.filePath]); // the record is already gone; a leftover file is only visible to its owner
}

const messageFromFailure = async (error: unknown) => {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.json();
      if (typeof body?.error === "string") return body.error as string;
    } catch { /* fall through */ }
  }
  return "The document could not be opened. Please try again.";
};

// Asks the server for a copy of the document stamped with the signed-in person's name and email. The original is never sent.
export async function fetchStampedCopy(documentId: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("pitch-document", { body: { document_id: documentId } });
  if (error) throw new Error(await messageFromFailure(error));
  if (!(data instanceof Blob)) throw new Error("The document could not be prepared. Please try again.");
  return data;
}

export const downloadName = (title: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document"}-confidential.pdf`;
