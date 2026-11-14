// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from "pdf-lib";
import {
  MAX_PAGES,
  handle,
  stampDocument,
  type AuthorizeResult,
  type AuthorizedDocument,
  type Deps,
} from "../../supabase/functions/pitch-document/handler";

const DOC_ID = "5b0c1d2e-3f40-4a51-8b62-7c73d84e95fa";
const NOW = new Date("2026-10-26T10:15:42Z");

const viewer = {
  title: "Pitch deck",
  mime_type: "application/pdf",
  viewer_name: "Priya Nair",
  viewer_email: "priya.nair@demo.pitchbridge.test",
};

const authorizedDoc = (over: Partial<AuthorizedDocument> = {}): AuthorizedDocument => ({
  file_path: "idea-folder/secret-original.pdf",
  is_owner: false,
  ...viewer,
  ...over,
});

async function makePdf(pages: number, marker = "ORIGINAL-CONTENT"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) pdf.addPage([595, 842]).drawText(`${marker} page ${i}`, { x: 60, y: 700, size: 18, font });
  return pdf.save();
}

/** The text drawn on each page, read back out of the page's content streams. */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const contents = page.node.normalizedEntries().Contents as PDFArray;
    let text = "";
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i);
      if (!(stream instanceof PDFRawStream)) continue;
      const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      for (const m of decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) text += Buffer.from(m[1], "hex").toString("latin1") + "\n";
    }
    return text;
  });
}

const png = () => new Uint8Array(readFileSync(resolve(process.cwd(), "public/apple-touch-icon.png")));
// Smallest valid JPEG (1x1).
const jpeg = () =>
  new Uint8Array(
    Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    ),
  );

describe("stampDocument", () => {
  it("puts the viewer's name, email and time on every page and keeps the original content", async () => {
    const stamped = await stampDocument(await makePdf(3), viewer, NOW);
    const texts = await pageTexts(stamped);
    expect(texts).toHaveLength(3);
    texts.forEach((t, i) => {
      expect(t).toContain("CONFIDENTIAL - Priya Nair <priya.nair@demo.pitchbridge.test> - 2026-10-26 10:15 UTC");
      expect(t).toContain("Viewed by Priya Nair <priya.nair@demo.pitchbridge.test> on 2026-10-26 10:15 UTC");
      expect(t).toContain("Do not copy, forward or share.");
      expect(t).toContain(`ORIGINAL-CONTENT page ${i + 1}`);
    });
  });

  it("repeats the diagonal watermark many times per page so a crop cannot remove it", async () => {
    const [text] = await pageTexts(await stampDocument(await makePdf(1), viewer, NOW));
    expect(text.split("CONFIDENTIAL - Priya Nair").length - 1).toBeGreaterThanOrEqual(8);
  });

  it("records who the copy was issued to in the file's own properties", async () => {
    const out = await PDFDocument.load(await stampDocument(await makePdf(1), viewer, NOW), { updateMetadata: false });
    expect(out.getTitle()).toBe("Pitch deck");
    expect(out.getSubject()).toContain("priya.nair@demo.pitchbridge.test");
    expect(out.getProducer()).toBe("PitchBridge");
  });

  it("does not crash on a name the PDF font cannot draw", async () => {
    const stamped = await stampDocument(await makePdf(1), { ...viewer, viewer_name: "علی Khan" }, NOW);
    const [text] = await pageTexts(stamped);
    expect(text).toContain("?? Khan <priya.nair@demo.pitchbridge.test>");
  });

  it("turns a PNG into a one-page watermarked PDF", async () => {
    const stamped = await stampDocument(png(), { ...viewer, mime_type: "image/png", title: "Logo" }, NOW);
    const texts = await pageTexts(stamped);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("priya.nair@demo.pitchbridge.test");
  });

  it("turns a JPEG into a one-page watermarked PDF", async () => {
    const stamped = await stampDocument(jpeg(), { ...viewer, mime_type: "image/jpeg", title: "Photo" }, NOW);
    const texts = await pageTexts(stamped);
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("priya.nair@demo.pitchbridge.test");
  });

  it("refuses a file that is not a readable PDF", async () => {
    await expect(stampDocument(new Uint8Array([1, 2, 3, 4]), viewer, NOW)).rejects.toMatchObject({ status: 422 });
  });

  it("refuses an image that is not a readable image", async () => {
    await expect(stampDocument(new Uint8Array([1, 2, 3, 4]), { ...viewer, mime_type: "image/png" }, NOW)).rejects.toMatchObject({ status: 422 });
  });

  it("refuses file types it cannot stamp", async () => {
    await expect(stampDocument(png(), { ...viewer, mime_type: "image/webp" }, NOW)).rejects.toMatchObject({ status: 415 });
  });

  it("refuses a document with too many pages", async () => {
    await expect(stampDocument(await makePdf(MAX_PAGES + 1), viewer, NOW)).rejects.toMatchObject({ status: 413 });
  });
});

describe("handle", () => {
  const request = (init: RequestInit & { token?: string | null } = {}) => {
    const { token = "user-jwt", headers, ...rest } = init;
    return new Request("https://example.test/functions/v1/pitch-document", {
      method: "POST",
      body: JSON.stringify({ document_id: DOC_ID }),
      ...rest,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers as Record<string, string>) },
    });
  };

  const makeDeps = async (over: Partial<Deps> = {}) => {
    const original = await makePdf(2);
    const deps = {
      authorize: vi.fn(async (): Promise<AuthorizeResult> => ({ ok: true, doc: authorizedDoc() })),
      download: vi.fn(async () => original),
      now: () => NOW,
      ...over,
    };
    return deps as Deps & { authorize: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> };
  };

  it("answers the browser's preflight request", async () => {
    const res = await handle(new Request("https://example.test", { method: "OPTIONS" }), await makeDeps());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
  });

  it("only accepts POST", async () => {
    const res = await handle(new Request("https://example.test", { method: "GET" }), await makeDeps());
    expect(res.status).toBe(405);
  });

  it("rejects a call with no sign-in before touching the database or storage", async () => {
    const deps = await makeDeps();
    const res = await handle(request({ token: null }), deps);
    expect(res.status).toBe(401);
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(deps.download).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON or has no document id", async () => {
    const deps = await makeDeps();
    expect((await handle(request({ body: "not json" }), deps)).status).toBe(400);
    expect((await handle(request({ body: JSON.stringify({}) }), deps)).status).toBe(400);
    expect((await handle(request({ body: JSON.stringify({ document_id: "../../etc/passwd" }) }), deps)).status).toBe(400);
    expect(deps.authorize).not.toHaveBeenCalled();
  });

  it("passes the caller's own token and the document id to the access check", async () => {
    const deps = await makeDeps();
    await handle(request({ token: "abc.def.ghi" }), deps);
    expect(deps.authorize).toHaveBeenCalledWith("abc.def.ghi", DOC_ID);
  });

  it("never downloads the file when access is denied", async () => {
    const deps = await makeDeps({
      authorize: vi.fn(async (): Promise<AuthorizeResult> => ({ ok: false, status: 403, message: "You do not have access to this document" })),
    });
    const res = await handle(request(), deps);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "You do not have access to this document" });
    expect(deps.download).not.toHaveBeenCalled();
  });

  it("returns 404 when the stored file has gone missing", async () => {
    const deps = await makeDeps({ download: vi.fn(async () => null) });
    expect((await handle(request(), deps)).status).toBe(404);
  });

  it("returns the stamped copy, never the original", async () => {
    const deps = await makeDeps();
    const res = await handle(request(), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(deps.download).toHaveBeenCalledWith("idea-folder/secret-original.pdf");

    const body = new Uint8Array(await res.arrayBuffer());
    const texts = await pageTexts(body);
    expect(texts).toHaveLength(2);
    texts.forEach((t) => expect(t).toContain("priya.nair@demo.pitchbridge.test"));
    // the storage path never leaks to the browser
    expect(Buffer.from(body).toString("latin1")).not.toContain("secret-original");
    expect(JSON.stringify([...res.headers])).not.toContain("secret-original");
  });

  it("explains why a damaged file cannot be shown", async () => {
    const deps = await makeDeps({ download: vi.fn(async () => new Uint8Array([9, 9, 9])) });
    const res = await handle(request(), deps);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/encrypted or damaged/);
  });
});
