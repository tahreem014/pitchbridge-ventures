import type { PDFFont, PDFPage } from "pdf-lib";
import { AgreementItem, STATUS_LABELS, TYPE_LABELS, confirmedNow } from "@/lib/agreements";
import { DISCLAIMER, buildClauses } from "@/lib/agreementText";

export const pdfFileName = (a: Pick<AgreementItem, "ideaTitle" | "version" | "status">) => {
  const slug = (a.ideaTitle ?? "agreement").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "agreement";
  return `investment-agreement-${slug}-v${a.version}${a.status === "executed" ? "" : `-${a.status}`}.pdf`;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const FOOTER_SPACE = 70;

const utc = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

// The standard PDF fonts only draw Latin characters. Anything else (for example a name in another script) would
// make drawing fail, so it is shown as "?" rather than losing the whole document.
const printable = (font: PDFFont, value: string) => {
  let out = "";
  for (const ch of value.replace(/[\t\r]+/g, " ")) {
    if (ch === "\n") { out += ch; continue; }
    try { font.encodeText(ch); out += ch; } catch { out += "?"; }
  }
  return out;
};

// Builds the agreement as a PDF in the browser: the same wording as the preview, a status banner, the parties'
// confirmations, and a footer on every page. A draft is marked DRAFT across every page.
export async function buildAgreementPdf(a: AgreementItem, now: Date = new Date()): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const contentWidth = A4.width - MARGIN * 2;
  const ink = rgb(0.1, 0.11, 0.15);
  const muted = rgb(0.38, 0.4, 0.46);
  const line = rgb(0.82, 0.84, 0.88);

  const pages: PDFPage[] = [];
  let page = pdf.addPage([A4.width, A4.height]);
  pages.push(page);
  let y = A4.height - MARGIN;

  const ensure = (height: number) => {
    if (y - height < FOOTER_SPACE) {
      page = pdf.addPage([A4.width, A4.height]);
      pages.push(page);
      y = A4.height - MARGIN;
    }
  };

  // Splits text into lines that fit the width. A word longer than a line (such as the fingerprint) is cut.
  const wrap = (value: string, font: PDFFont, size: number, width: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of printable(font, value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(" ")) {
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          if (current) { lines.push(current); current = ""; }
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        const candidate = current ? `${current} ${rest}` : rest;
        if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
        else { lines.push(current); current = rest; }
      }
      lines.push(current);
    }
    return lines;
  };

  const text = (value: string, opts: { font?: PDFFont; size?: number; gap?: number; indent?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const { font = regular, size = 10, gap = 6, indent = 0, color = ink } = opts;
    const lineHeight = size * 1.45;
    for (const row of wrap(value, font, size, contentWidth - indent)) {
      ensure(lineHeight);
      page.drawText(row, { x: MARGIN + indent, y: y - size, size, font, color });
      y -= lineHeight;
    }
    y -= gap;
  };

  const heading = (value: string) => {
    ensure(44);
    y -= 8;
    page.drawText(printable(bold, value), { x: MARGIN, y: y - 12, size: 12, font: bold, color: ink });
    y -= 22;
  };

  const table = (head: string[], rows: string[][], widths: number[], foot?: string[]) => {
    const size = 9.5;
    const lineHeight = size * 1.4;
    const colX: number[] = [];
    let columnStart = MARGIN;
    for (const w of widths) { colX.push(columnStart); columnStart += w; }
    const drawRow = (cells: string[], font: PDFFont, rule: boolean) => {
      const wrapped = cells.map((cell, i) => wrap(cell, font, size, widths[i] - 8));
      const height = Math.max(...wrapped.map(w => w.length)) * lineHeight + 6;
      ensure(height + 2);
      wrapped.forEach((cellLines, i) => cellLines.forEach((row, n) => page.drawText(row, { x: colX[i] + 2, y: y - size - 3 - n * lineHeight, size, font, color: ink })));
      y -= height;
      if (rule) page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + contentWidth, y }, thickness: 0.5, color: line });
    };
    drawRow(head, bold, true);
    rows.forEach(row => drawRow(row, regular, true));
    if (foot) drawRow(foot, bold, false);
    y -= 8;
  };

  // ----- title and status -----
  page.drawText("INVESTMENT AGREEMENT", { x: MARGIN, y: y - 20, size: 20, font: bold, color: ink });
  y -= 30;
  text(`${TYPE_LABELS[a.type]} · ${printable(regular, a.ideaTitle ?? "Project")}`, { size: 11, color: muted, gap: 10 });

  const executed = a.status === "executed";
  const banner = executed
    ? `SIGNED. Both parties confirmed version ${a.version}${a.executedAt ? ` on ${utc(a.executedAt)}` : ""}.`
    : a.status === "cancelled"
      ? "CANCELLED. This agreement was cancelled and is not in effect."
      : `DRAFT. Version ${a.version} has not been confirmed by both parties and is not in effect.`;
  const bannerLines = wrap(banner, bold, 10, contentWidth - 20);
  const bannerHeight = bannerLines.length * 14 + 14;
  ensure(bannerHeight + 10);
  page.drawRectangle({
    x: MARGIN, y: y - bannerHeight, width: contentWidth, height: bannerHeight,
    color: executed ? rgb(0.9, 0.97, 0.92) : rgb(1, 0.95, 0.86), borderColor: executed ? rgb(0.45, 0.7, 0.5) : rgb(0.85, 0.6, 0.25), borderWidth: 0.8,
  });
  bannerLines.forEach((row, i) => page.drawText(row, { x: MARGIN + 10, y: y - 17 - i * 14, size: 10, font: bold, color: ink }));
  y -= bannerHeight + 14;

  // ----- key facts -----
  table(
    ["Item", "Details"],
    [
      ["Agreement", a.id],
      ["Project", a.ideaTitle ?? "Not available"],
      ["Investor", a.investor.email ? `${a.investor.name} (${a.investor.email})` : a.investor.name],
      ["Founder", a.founder.email ? `${a.founder.name} (${a.founder.email})` : a.founder.name],
      ["Status", STATUS_LABELS[a.status]],
      ["Version and template", `Version ${a.version}, ${a.templateVersion}`],
    ],
    [120, contentWidth - 120],
  );

  // ----- the clauses -----
  buildClauses(a).forEach((clause, i) => {
    heading(`${i + 1}. ${clause.heading}`);
    clause.paragraphs.forEach(p => text(p));
    if (clause.table) {
      const w = [34, 120, 110, contentWidth - 264];
      table(clause.table.head, clause.table.rows, w, clause.table.foot);
    }
  });

  // ----- who confirmed -----
  heading("Confirmations");
  const confirmed = confirmedNow(a);
  const row = (label: string, party: typeof a.investor, c: (typeof confirmed)["investor"]) => [
    label,
    printable(regular, c?.name ?? party.name),
    printable(regular, c?.email ?? party.email ?? ""),
    c ? `Version ${c.version}, ${utc(c.confirmedAt)}` : `Not yet confirmed for version ${a.version}`,
  ];
  table(["Party", "Name", "Email", "Confirmation"], [row("Investor", a.investor, confirmed.investor), row("Founder", a.founder, confirmed.entrepreneur)], [58, 100, 150, contentWidth - 308]);

  // ----- disclaimer -----
  ensure(70);
  const disclaimerLines = wrap(DISCLAIMER, regular, 8.5, contentWidth - 20);
  const boxHeight = disclaimerLines.length * 12 + 16;
  ensure(boxHeight);
  page.drawRectangle({ x: MARGIN, y: y - boxHeight, width: contentWidth, height: boxHeight, borderColor: line, borderWidth: 0.8, color: rgb(0.97, 0.97, 0.98) });
  disclaimerLines.forEach((rowText, i) => page.drawText(rowText, { x: MARGIN + 10, y: y - 14 - i * 12, size: 8.5, font: regular, color: muted }));
  y -= boxHeight;

  // ----- footer and watermark on every page -----
  const mark = executed ? null : a.status === "cancelled" ? "CANCELLED" : "DRAFT";
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 50 }, end: { x: MARGIN + contentWidth, y: 50 }, thickness: 0.5, color: line });
    p.drawText(`PitchBridge · Agreement ${a.id.slice(0, 8)} · version ${a.version} · generated ${utc(now.toISOString())}`, { x: MARGIN, y: 36, size: 8, font: regular, color: muted });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 8), y: 36, size: 8, font: regular, color: muted });
    p.drawText("Template-based document. Not legal advice.", { x: MARGIN, y: 25, size: 8, font: regular, color: muted });
    if (mark) {
      p.drawText(mark, { x: 120, y: 250, size: mark === "DRAFT" ? 130 : 90, font: bold, color: rgb(0.55, 0.55, 0.6), opacity: 0.14, rotate: degrees(45) });
    }
  });

  pdf.setTitle(`Investment agreement - ${printable(regular, a.ideaTitle ?? "Project")} (version ${a.version})`);
  pdf.setSubject(`${TYPE_LABELS[a.type]} between ${printable(regular, a.investor.name)} and ${printable(regular, a.founder.name)}`);
  pdf.setProducer("PitchBridge");
  pdf.setCreator("PitchBridge");
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  return pdf.save();
}
