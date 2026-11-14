import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DocumentsEditor } from "@/components/pitch/DocumentsEditor";

const IDEA = "a0000000-0000-4000-8000-000000000012";
const ME = "11111111-1111-4111-8111-111111111111";

const lib = vi.hoisted(() => ({ listOwnDocuments: vi.fn(), uploadDocument: vi.fn(), removeDocument: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/pitchDocuments", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/pitchDocuments")>()), ...lib }));
vi.mock("sonner", () => ({ toast }));

const doc = (over: Record<string, unknown> = {}) => ({
  id: "d1", title: "Pitch deck", filePath: `${IDEA}/x-deck.pdf`, mimeType: "application/pdf", sizeBytes: 250 * 1024, createdAt: "2026-10-20T10:00:00Z", ...over,
});
const pdf = (name = "Q3_roadmap.pdf") => new File(["%PDF-1.4"], name, { type: "application/pdf" });

const renderEditor = (props: { ideaId?: string | null; userId?: string } = {}) =>
  render(<DocumentsEditor ideaId={props.ideaId === undefined ? IDEA : props.ideaId} userId={props.userId ?? ME} />);

const choose = (file: File) => fireEvent.change(screen.getByLabelText("Document file"), { target: { files: [file] } });

beforeEach(() => {
  Object.values(lib).forEach(fn => fn.mockReset());
  toast.success.mockReset(); toast.error.mockReset();
  lib.listOwnDocuments.mockResolvedValue([]);
});

describe("supporting documents editor", () => {
  it("asks the founder to publish first when the idea does not exist yet", () => {
    renderEditor({ ideaId: null });
    expect(screen.getByText(/Publish the idea first/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Document file")).not.toBeInTheDocument();
    expect(lib.listOwnDocuments).not.toHaveBeenCalled();
  });

  it("says plainly that investors only get a stamped copy", async () => {
    renderEditor();
    expect(await screen.findByText(/never receive your original/)).toBeInTheDocument();
    expect(screen.getByText(/up to 10 MB each, at most 10 files/)).toBeInTheDocument();
  });

  it("shows an empty state, then the documents with type, size and date", async () => {
    renderEditor();
    expect(await screen.findByText("No documents yet.")).toBeInTheDocument();

    lib.listOwnDocuments.mockResolvedValue([doc(), doc({ id: "d2", title: "Logo", mimeType: "image/png", sizeBytes: 3 * 1024 * 1024 })]);
    renderEditor();
    expect(await screen.findByText("Pitch deck")).toBeInTheDocument();
    expect(screen.getByText(/PDF · 250 KB · added Oct 20, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/PNG image · 3 MB/)).toBeInTheDocument();
  });

  it("offers a retry when the documents cannot be loaded", async () => {
    lib.listOwnDocuments.mockRejectedValueOnce(new Error("network down"));
    renderEditor();
    expect(await screen.findByText(/Could not load your documents: network down/)).toBeInTheDocument();
    lib.listOwnDocuments.mockResolvedValue([doc()]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Pitch deck")).toBeInTheDocument();
  });

  it("fills the title from the file name and uploads on request", async () => {
    lib.uploadDocument.mockResolvedValue(doc({ id: "new", title: "Q3 roadmap" }));
    renderEditor();
    await screen.findByText("No documents yet.");
    const add = screen.getByRole("button", { name: "Add document" });
    expect(add).toBeDisabled();

    const file = pdf();
    choose(file);
    expect(screen.getByLabelText("Document title")).toHaveValue("Q3 roadmap");
    fireEvent.click(add);

    await waitFor(() => expect(lib.uploadDocument).toHaveBeenCalledWith({ ideaId: IDEA, userId: ME, file, title: "Q3 roadmap" }));
    expect(await screen.findByText("Q3 roadmap")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Document added");
    expect(screen.getByLabelText("Document title")).toHaveValue(""); // ready for the next one
    expect(screen.getByRole("button", { name: "Add document" })).toBeDisabled();
  });

  it("uses the title the founder types instead of the file name", async () => {
    lib.uploadDocument.mockResolvedValue(doc({ title: "Financial model" }));
    renderEditor();
    await screen.findByText("No documents yet.");
    choose(pdf());
    fireEvent.change(screen.getByLabelText("Document title"), { target: { value: "Financial model" } });
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    await waitFor(() => expect(lib.uploadDocument).toHaveBeenCalledWith(expect.objectContaining({ title: "Financial model" })));
  });

  it("uploads when Enter is pressed in the title, without saving the whole idea form", async () => {
    lib.uploadDocument.mockResolvedValue(doc());
    renderEditor();
    await screen.findByText("No documents yet.");
    choose(pdf());
    const notCancelled = fireEvent.keyDown(screen.getByLabelText("Document title"), { key: "Enter" });
    expect(notCancelled).toBe(false); // the default action (submitting the form) was prevented
    await waitFor(() => expect(lib.uploadDocument).toHaveBeenCalledTimes(1));
  });

  it("refuses a file type that is not allowed and keeps the button off", async () => {
    renderEditor();
    await screen.findByText("No documents yet.");
    choose(new File(["x"], "archive.zip", { type: "application/zip" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Only PDF, PNG and JPEG/));
    expect(screen.getByRole("button", { name: "Add document" })).toBeDisabled();
    expect(lib.uploadDocument).not.toHaveBeenCalled();
  });

  it("shows the reason when an upload fails and does not add anything", async () => {
    lib.uploadDocument.mockRejectedValue(new Error("This PDF is password-protected or damaged."));
    renderEditor();
    await screen.findByText("No documents yet.");
    choose(pdf());
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This PDF is password-protected or damaged."));
    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add document" })).toBeEnabled(); // the founder can try again
  });

  it("stops at ten documents", async () => {
    lib.listOwnDocuments.mockResolvedValue(Array.from({ length: 10 }, (_, i) => doc({ id: `d${i}`, title: `Doc ${i}` })));
    renderEditor();
    await screen.findByText("Doc 0");
    choose(pdf());
    expect(screen.getByRole("button", { name: "Add document" })).toBeDisabled();
    expect(screen.getByText(/reached the limit of 10 documents/)).toBeInTheDocument();
  });

  it("removes a document only after the founder confirms", async () => {
    lib.listOwnDocuments.mockResolvedValue([doc()]);
    lib.removeDocument.mockResolvedValue(undefined);
    renderEditor();
    await screen.findByText("Pitch deck");

    fireEvent.click(screen.getByRole("button", { name: "Remove Pitch deck" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/recorded as a new version/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(lib.removeDocument).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove Pitch deck" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove document" }));
    await waitFor(() => expect(lib.removeDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" })));
    await waitFor(() => expect(screen.queryByText("Pitch deck")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Document removed");
  });

  it("keeps the document in the list if removing it fails", async () => {
    lib.listOwnDocuments.mockResolvedValue([doc()]);
    lib.removeDocument.mockRejectedValue(new Error("permission denied"));
    renderEditor();
    await screen.findByText("Pitch deck");
    fireEvent.click(screen.getByRole("button", { name: "Remove Pitch deck" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove document" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("permission denied"));
    expect(screen.getByText("Pitch deck")).toBeInTheDocument();
  });
});
