// Serves a restricted pitch document as a watermarked PDF.
//
// An investor never receives the original file. This function (1) asks the database whether the caller may
// open the document (approved access request AND accepted NDA), which also writes the audit-log entry,
// (2) downloads the original with the service role, (3) stamps the caller's name and email on every page and
// (4) returns only the stamped copy. The logic lives here, free of Deno globals, so tests can run it in Node.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";

export const BUCKET = "pitch-documents";
export const MAX_PAGES = 150;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface AuthorizedDocument {
  file_path: string;
  title: string;
  mime_type: string;
  viewer_name: string;
  viewer_email: string;
  is_owner: boolean;
}

export type AuthorizeResult = { ok: true; doc: AuthorizedDocument } | { ok: false; status: number; message: string };

export interface Deps {
  /** Runs the access check as the signed-in caller (their token), so auth.uid() is theirs. */
  authorize: (token: string, documentId: string) => Promise<AuthorizeResult>;
  /** Reads the original file with the service role. */
  download: (path: string) => Promise<Uint8Array | null>;
  now: () => Date;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** The standard PDF fonts only draw Latin characters; anything else would throw, so it becomes "?". */
function printable(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\s+/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out.trim();
}

const formatUtc = (d: Date) => `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** Rebuilds an image as a one-page PDF so it can carry the same watermark as a PDF. */
async function imageToPdf(bytes: Uint8Array, mime: string): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  const image = mime === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const landscape = image.width > image.height;
  const [pageW, pageH] = landscape ? [842, 595] : [595, 842];
  const margin = 28;
  const fit = image.scaleToFit(pageW - margin * 2, pageH - margin * 2);
  const page = pdf.addPage([pageW, pageH]);
  page.drawImage(image, { x: (pageW - fit.width) / 2, y: (pageH - fit.height) / 2, width: fit.width, height: fit.height });
  return pdf;
}

export async function stampDocument(
  original: Uint8Array,
  doc: Pick<AuthorizedDocument, "title" | "mime_type" | "viewer_name" | "viewer_email">,
  at: Date,
): Promise<Uint8Array> {
  let pdf: PDFDocument;
  if (doc.mime_type === "application/pdf") {
    try {
      pdf = await PDFDocument.load(original); // throws on encrypted or damaged files
    } catch {
      throw new HttpError(422, "This PDF is encrypted or damaged, so it cannot be shown. Ask the founder to upload it again.");
    }
  } else if (doc.mime_type === "image/png" || doc.mime_type === "image/jpeg") {
    try {
      pdf = await imageToPdf(original, doc.mime_type);
    } catch {
      throw new HttpError(422, "This image could not be read. Ask the founder to upload it again.");
    }
  } else {
    throw new HttpError(415, "This file type cannot be shown.");
  }
  if (pdf.getPageCount() > MAX_PAGES) throw new HttpError(413, `This document has more than ${MAX_PAGES} pages and cannot be shown.`);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const viewer = printable(font, `${doc.viewer_name} <${doc.viewer_email}>`);
  const when = formatUtc(at);
  const tile = `CONFIDENTIAL - ${viewer} - ${when}`;
  const footer = `Confidential pitch shared through PitchBridge. Viewed by ${viewer} on ${when}. ` +
    `${printable(font, doc.title)}. Do not copy, forward or share.`;
  const angle = 30;
  const rad = (angle * Math.PI) / 180;

  for (const page of pdf.getPages()) {
    const { x, y, width, height } = page.getMediaBox();

    // Tiled diagonal watermark: cropping a corner of the page cannot remove it.
    const tileSize = 10;
    const tileWidth = font.widthOfTextAtSize(tile, tileSize);
    const stepX = Math.max(tileWidth * Math.cos(rad) + 70, 170);
    const stepY = 120;
    let row = 0;
    let drawn = 0;
    for (let ty = y - tileWidth * Math.sin(rad); ty < y + height && drawn < 400; ty += stepY, row++) {
      for (let tx = x - tileWidth * Math.cos(rad) + (row % 2 ? stepX / 2 : 0); tx < x + width && drawn < 400; tx += stepX, drawn++) {
        page.drawText(tile, { x: tx, y: ty, size: tileSize, font, color: rgb(0.35, 0.35, 0.4), opacity: 0.17, rotate: degrees(angle) });
      }
    }

    // Footer line, shrunk to fit narrow pages.
    const footerSize = Math.min(7.5, (7.5 * (width - 24)) / font.widthOfTextAtSize(footer, 7.5));
    page.drawRectangle({ x, y, width, height: footerSize + 10, color: rgb(1, 1, 1), opacity: 0.8 });
    page.drawText(footer, { x: x + 12, y: y + 6, size: footerSize, font, color: rgb(0.25, 0.25, 0.3) });
  }

  pdf.setTitle(printable(font, doc.title) || "Confidential pitch document");
  pdf.setSubject(`Confidential. Copy issued to ${viewer} on ${when}`);
  pdf.setProducer("PitchBridge");
  pdf.setCreator("PitchBridge");
  return pdf.save();
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json(401, { error: "Sign in to view this document" });

  let documentId: unknown;
  try {
    documentId = ((await req.json()) as { document_id?: unknown } | null)?.document_id;
  } catch {
    return json(400, { error: "Send a JSON body with a document_id" });
  }
  if (typeof documentId !== "string" || !UUID.test(documentId)) return json(400, { error: "document_id must be a document id" });

  const access = await deps.authorize(token, documentId);
  if (!("doc" in access)) return json(access.status, { error: access.message }); // "in" narrows the same way with or without strict mode

  const original = await deps.download(access.doc.file_path);
  if (!original) return json(404, { error: "The file is missing from storage. Ask the founder to upload it again." });

  try {
    const stamped = await stampDocument(original, access.doc, deps.now());
    return new Response(stamped as unknown as BodyInit, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="confidential-pitch-document.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.message });
    return json(500, { error: "The document could not be prepared. Please try again." });
  }
}
