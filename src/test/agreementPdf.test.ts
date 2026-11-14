// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildAgreementPdf, pdfFileName } from "@/lib/agreementPdf";
import { DISCLAIMER, TEMPLATE_VERSION, buildClauses } from "@/lib/agreementText";
import { HASH, draftAgreement, makeAgreement } from "./agreementFixtures";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const NOW = new Date("2026-10-27T08:30:00Z");

/** Everything drawn on each page, read back out of the content streams (lines joined with spaces). */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.getPages().map(page => {
    const contents = page.node.normalizedEntries().Contents as PDFArray;
    const parts: string[] = [];
    for (let i = 0; i < contents.size(); i++) {
      const stream = contents.lookup(i);
      if (!(stream instanceof PDFRawStream)) continue;
      const decoded = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      for (const m of decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) parts.push(Buffer.from(m[1], "hex").toString("latin1"));
    }
    return parts.join(" ").replace(/\s+/g, " ");
  });
}
const allText = async (bytes: Uint8Array) => (await pageTexts(bytes)).join(" ");

describe("agreement PDF", () => {
  it("is a real PDF with the producer and a descriptive title", async () => {
    const bytes = await buildAgreementPdf(makeAgreement(), NOW);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getTitle()).toBe("Investment agreement - SkillSwap (version 3)");
    expect(pdf.getSubject()).toBe("Equity investment between Priya Nair and Tahrem Khan");
    expect(pdf.getProducer()).toBe("PitchBridge");
    expect(pdf.getCreationDate()?.toISOString()).toBe(NOW.toISOString());
  });

  it("shows a signed equity agreement in full", async () => {
    const text = await allText(await buildAgreementPdf(makeAgreement(), NOW));
    expect(text).toContain("INVESTMENT AGREEMENT");
    expect(text).toContain("Equity investment");
    expect(text).toContain("SIGNED. Both parties confirmed version 3 on 2026-10-26 10:00 UTC.");
    // parties and the project
    expect(text).toContain("Priya Nair (priya.nair@demo.pitchbridge.test)");
    expect(text).toContain("Tahrem Khan (tahrem014@gmail.com)");
    expect(text).toContain('about the project "SkillSwap"');
    // the money and the equity it buys
    expect(text).toContain("The Investor will invest $40,000.00 in the Project.");
    expect(text).toContain("9% of the equity");
    expect(text).toContain("values the Project at $444,444.44");
    // the schedule, with its total
    expect(text).toContain("Dec 1, 2026");
    expect(text).toContain("$25,000.00");
    expect(text).toContain("First tranche");
    expect(text).toContain("Feb 1, 2027");
    expect(text).toContain("Total");
    // responsibilities, law, confirmations, fingerprint, disclaimer
    expect(text).toContain("report to the investor every quarter");
    expect(text).toContain("governed by Laws of Pakistan");
    expect(text).toContain("Version 3, 2026-10-26 09:00 UTC");
    expect(text).toContain("Version 3, 2026-10-26 10:00 UTC");
    expect(text).toContain(`Fingerprint of this version: ${HASH}`);
    expect(text).toContain("has not been reviewed by a lawyer");
    expect(text).toContain("Template-based document. Not legal advice.");
  });

  it("does not mark a signed agreement as a draft", async () => {
    const text = await allText(await buildAgreementPdf(makeAgreement(), NOW));
    expect(text).not.toContain("DRAFT");
    expect(text).not.toContain("CANCELLED");
  });

  it("marks a draft clearly on every page and shows who has not confirmed", async () => {
    const draft = draftAgreement({ confirmations: [{ ...makeAgreement().confirmations[1], version: 2 }] });
    const pages = await pageTexts(await buildAgreementPdf(draft, NOW));
    const text = pages.join(" ");
    expect(text).toContain("DRAFT. Version 2 has not been confirmed by both parties and is not in effect.");
    expect(text).toContain("Version 2, 2026-10-26 10:00 UTC");          // the investor confirmed version 2
    expect(text).toContain("Not yet confirmed for version 2");          // the founder has not
    pages.forEach(page => expect(page).toMatch(/\bDRAFT\b/));           // the watermark is on every page
  });

  it("marks a cancelled agreement", async () => {
    const text = await allText(await buildAgreementPdf(makeAgreement({ status: "cancelled", executedAt: null, cancelledAt: "2026-10-27T00:00:00Z" }), NOW));
    expect(text).toContain("CANCELLED. This agreement was cancelled and is not in effect.");
  });

  it("writes a loan in the loan's own words", async () => {
    const loan = makeAgreement({ type: "loan", terms: { ...makeAgreement().terms, equity_percent: undefined, interest_rate: 8, term_months: 24, repayment: "quarterly" } });
    const text = await allText(await buildAgreementPdf(loan, NOW));
    expect(text).toContain("Loan");
    expect(text).toContain("The Investor will lend $40,000.00 to the Founder.");
    expect(text).toContain("carries interest at 8% per year and runs for 24 months");
    expect(text).toContain("repaid in quarterly instalments");
    expect(text).not.toContain("of the equity");
  });

  it("writes a loan with no interest, and a one-month loan, correctly", async () => {
    const loan = makeAgreement({ type: "loan", terms: { ...makeAgreement().terms, interest_rate: 0, term_months: 1, repayment: "at_maturity" } });
    const text = await allText(await buildAgreementPdf(loan, NOW));
    expect(text).toContain("carries no interest and runs for 1 month.");
    expect(text).toContain("in one payment at the end of the loan");
  });

  it("writes an other arrangement from the founder's and investor's own description", async () => {
    const other = makeAgreement({ type: "other", terms: { ...makeAgreement().terms, equity_percent: undefined, arrangement_title: "Revenue share", arrangement_description: "5% of monthly revenue for 24 months" } });
    const text = await allText(await buildAgreementPdf(other, NOW));
    expect(text).toContain("Other arrangement");
    expect(text).toContain("Revenue share");
    expect(text).toContain("5% of monthly revenue for 24 months");
  });

  it("marks anything not filled in yet, instead of printing nothing", async () => {
    const empty = draftAgreement({ terms: { ...makeAgreement().terms, governing_law: "", founder_responsibilities: "" } });
    const text = await allText(await buildAgreementPdf(empty, NOW));
    expect(text).toContain("governed by [to be completed]");
    expect(text).toContain("[to be completed]");
  });

  it("includes additional terms only when there are some", async () => {
    expect(await allText(await buildAgreementPdf(makeAgreement(), NOW))).not.toContain("Additional terms");
    const text = await allText(await buildAgreementPdf(makeAgreement({ terms: { ...makeAgreement().terms, additional_terms: "The founder will give one board seat.\n\nA second paragraph." } }), NOW));
    expect(text).toContain("Additional terms");
    expect(text).toContain("one board seat");
    expect(text).toContain("A second paragraph.");
  });

  it("runs onto more pages when the text is long, with a footer and page count on each", async () => {
    const long = "The Founder will report progress in detail. ".repeat(180);
    const pages = await pageTexts(await buildAgreementPdf(makeAgreement({ terms: { ...makeAgreement().terms, founder_responsibilities: long } }), NOW));
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page, i) => {
      expect(page).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(page).toContain("PitchBridge · Agreement c3f2a1b0 · version 3 · generated 2026-10-27 08:30 UTC".replace("·", "·"));
    });
  });

  it("does not fail on a name the PDF font cannot draw", async () => {
    const a = makeAgreement({ investor: { ...makeAgreement().investor, name: "علی Khan" } });
    const text = await allText(await buildAgreementPdf(a, NOW));
    expect(text).toContain("?? Khan");
  });

  it("copes with a very long unbroken word without losing it", async () => {
    const word = "x".repeat(300);
    const text = await allText(await buildAgreementPdf(makeAgreement({ terms: { ...makeAgreement().terms, additional_terms: word } }), NOW));
    expect(text.replace(/\s+/g, "")).toContain(word);
  });

  it("names the file after the project, the version and the status", () => {
    expect(pdfFileName(makeAgreement())).toBe("investment-agreement-skillswap-v3.pdf");
    expect(pdfFileName(draftAgreement())).toBe("investment-agreement-skillswap-v2-draft.pdf");
    expect(pdfFileName(makeAgreement({ status: "cancelled" }))).toBe("investment-agreement-skillswap-v3-cancelled.pdf");
    expect(pdfFileName(makeAgreement({ ideaTitle: null }))).toBe("investment-agreement-agreement-v3.pdf");
  });
});

describe("agreement wording", () => {
  it("numbers nothing itself and always ends with how the agreement is confirmed", () => {
    const clauses = buildClauses(makeAgreement());
    expect(clauses.map(c => c.heading)).toEqual([
      "Parties and project", "The investment (equity investment)", "Payment schedule", "Responsibilities of the Founder",
      "Responsibilities of the Investor", "Confidentiality", "Term and ending the agreement", "Disputes", "Governing law", "Confirming this agreement",
    ]);
    expect(clauses[2].table?.foot).toEqual(["", "Total", "$40,000.00", ""]);
    expect(clauses.at(-1)?.paragraphs.at(-1)).toBe(`Fingerprint of this version: ${HASH}`);
    expect(TEMPLATE_VERSION).toBe("agreement-template-v1");
    expect(DISCLAIMER).toMatch(/not been reviewed by a lawyer/);
  });

  it("leaves the email out when the other party has not confirmed yet", () => {
    const a = draftAgreement({ founder: { ...makeAgreement().founder, email: null } });
    expect(buildClauses(a)[0].paragraphs[0]).toContain('and Tahrem Khan, the "Founder"');
    expect(buildClauses(a)[0].paragraphs[0]).not.toContain("tahrem014@gmail.com");
  });
});
