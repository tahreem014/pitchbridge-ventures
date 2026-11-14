import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentViewerDialog, PitchDocuments } from "@/components/pitch/PitchDocuments";

const lib = vi.hoisted(() => ({ fetchStampedCopy: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/pitchDocuments", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/pitchDocuments")>()), ...lib }));

const deck = { id: "d1", title: "Pitch deck", mimeType: "application/pdf", sizeBytes: 250 * 1024, createdAt: "2026-10-20T10:00:00Z" };
const logo = { id: "d2", title: "Logo", mimeType: "image/png", sizeBytes: 2 * 1024 * 1024, createdAt: "2026-10-21T10:00:00Z" };

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  lib.fetchStampedCopy.mockReset();
  createObjectURL.mockReset().mockReturnValue("blob:confidential-1");
  revokeObjectURL.mockReset();
  // jsdom has no object URLs
  Object.assign(URL, { createObjectURL, revokeObjectURL });
});

describe("document list", () => {
  it("renders nothing when there are no documents", () => {
    const { container } = render(<PitchDocuments documents={[]} onView={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each document with its kind and size, and opens the one chosen", () => {
    const onView = vi.fn();
    render(<PitchDocuments documents={[deck, logo]} onView={onView} note="Each copy is stamped with your name." />);
    expect(screen.getByRole("heading", { name: "Supporting documents" })).toBeInTheDocument();
    expect(screen.getByText("Each copy is stamped with your name.")).toBeInTheDocument();
    expect(screen.getByText("PDF · 250 KB")).toBeInTheDocument();
    expect(screen.getByText("PNG image · 2 MB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Logo" }));
    expect(onView).toHaveBeenCalledWith(logo);
  });
});

describe("document viewer", () => {
  it("shows that a copy is being prepared, then the stamped copy with a download link", async () => {
    const blob = new Blob(["%PDF-stamped"], { type: "application/pdf" });
    lib.fetchStampedCopy.mockResolvedValue(blob);
    render(<DocumentViewerDialog doc={deck} onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: "Pitch deck" })).toBeInTheDocument();
    expect(screen.getByText(/name and email stamped on every page/)).toBeInTheDocument();
    expect(screen.getByText("Preparing your copy...")).toBeInTheDocument();

    const frame = await screen.findByTitle("Pitch deck (confidential copy)");
    expect(frame).toHaveAttribute("src", "blob:confidential-1");
    expect(lib.fetchStampedCopy).toHaveBeenCalledWith("d1");
    expect(createObjectURL).toHaveBeenCalledWith(blob);

    const download = screen.getByRole("link", { name: /Download this copy/ });
    expect(download).toHaveAttribute("href", "blob:confidential-1");
    expect(download).toHaveAttribute("download", "pitch-deck-confidential.pdf");
    expect(screen.getByText(/traced back to you/)).toBeInTheDocument();
  });

  it("shows the server's reason and lets the reader try again", async () => {
    lib.fetchStampedCopy.mockRejectedValueOnce(new Error("You do not have access to this document"));
    lib.fetchStampedCopy.mockResolvedValueOnce(new Blob(["%PDF"], { type: "application/pdf" }));
    render(<DocumentViewerDialog doc={deck} onClose={() => {}} />);

    expect(await screen.findByText("You do not have access to this document")).toBeInTheDocument();
    expect(screen.queryByTitle("Pitch deck (confidential copy)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTitle("Pitch deck (confidential copy)")).toBeInTheDocument();
    expect(lib.fetchStampedCopy).toHaveBeenCalledTimes(2);
  });

  it("releases the copy from memory when it is closed", async () => {
    lib.fetchStampedCopy.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    const { rerender } = render(<DocumentViewerDialog doc={deck} onClose={() => {}} />);
    await screen.findByTitle("Pitch deck (confidential copy)");
    expect(revokeObjectURL).not.toHaveBeenCalled();

    rerender(<DocumentViewerDialog doc={null} onClose={() => {}} />);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:confidential-1"));
  });

  it("does not request anything while no document is selected", () => {
    render(<DocumentViewerDialog doc={null} onClose={() => {}} />);
    expect(lib.fetchStampedCopy).not.toHaveBeenCalled();
  });

  it("asks for a fresh copy when a different document is opened", async () => {
    lib.fetchStampedCopy.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    createObjectURL.mockReturnValueOnce("blob:one").mockReturnValueOnce("blob:two");
    const { rerender } = render(<DocumentViewerDialog doc={deck} onClose={() => {}} />);
    await screen.findByTitle("Pitch deck (confidential copy)");
    rerender(<DocumentViewerDialog doc={logo} onClose={() => {}} />);
    expect(await screen.findByTitle("Logo (confidential copy)")).toHaveAttribute("src", "blob:two");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:one");
    expect(lib.fetchStampedCopy).toHaveBeenLastCalledWith("d2");
  });
});
