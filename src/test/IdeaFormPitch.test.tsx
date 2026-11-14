/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import IdeaForm from "@/pages/app/IdeaForm";

const ME = "11111111-1111-4111-8111-111111111111";

const db = vi.hoisted(() => ({
  idea: null as any,
  pitch: null as any,
  docs: [] as any[],
  inserted: [] as any[],
  updated: [] as any[],
  upserts: [] as any[],
  deletes: [] as any[],
  pitchError: null as any,
}));
const auth = vi.hoisted(() => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

const chain = (result: unknown): any =>
  new Proxy({}, { get: (_t, prop) => (prop === "then" ? (resolve: any) => resolve(result) : () => chain(result)) });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => table === "ideas"
      ? {
        select: () => chain({ data: db.idea, error: null }),
        insert: (payload: any) => { db.inserted.push(payload); return chain({ data: { id: "new-idea" }, error: null }); },
        update: (payload: any) => { db.updated.push(payload); return chain({ error: null }); },
      }
      : table === "pitch_documents"
      ? { select: () => chain({ data: db.docs, error: null }) }
      : {
        select: () => chain({ data: db.pitch, error: null }),
        upsert: (payload: any) => { db.upserts.push(payload); return chain({ error: db.pitchError }); },
        delete: () => { db.deletes.push(true); return chain({ error: db.pitchError }); },
      },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
vi.mock("sonner", () => ({ toast }));

const storedIdea = {
  title: "SkillSwap", tagline: "", description: "", category: "Consumer", stage: "prototype", funding_target: 60000,
  equity_offered: 10, cover_image_url: null, video_url: null, visibility: "public",
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/app/ideas/new" element={<IdeaForm />} />
      <Route path="/app/ideas/:id/edit" element={<IdeaForm />} />
      <Route path="/app/ideas" element={<div>MY IDEAS LIST</div>} />
    </Routes>
  </MemoryRouter>,
);

const save = () => fireEvent.click(screen.getByRole("button", { name: /publish pitch|save changes/i }));

beforeEach(() => {
  db.idea = null; db.pitch = null; db.docs = []; db.inserted = []; db.updated = []; db.upserts = []; db.deletes = []; db.pitchError = null;
  toast.success.mockReset(); toast.error.mockReset();
});

describe("idea form: private detailed pitch", () => {
  it("explains what is public and what is private", () => {
    renderAt("/app/ideas/new");
    expect(screen.getByText("Detailed pitch (private)")).toBeInTheDocument();
    expect(screen.getByText(/Visible to everyone\. Keep sensitive details/)).toBeInTheDocument();
    expect(screen.getByLabelText("Business model")).toBeInTheDocument();
    expect(screen.getByLabelText("Target customers")).toBeInTheDocument();
    expect(screen.getByLabelText("Market research")).toBeInTheDocument();
    expect(screen.getByLabelText("Financial estimates")).toBeInTheDocument();
  });

  it("asks a founder creating an idea to publish before adding documents", () => {
    renderAt("/app/ideas/new");
    expect(screen.getByRole("heading", { name: "Supporting documents" })).toBeInTheDocument();
    expect(screen.getByText(/Publish the idea first/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Document file")).not.toBeInTheDocument();
  });

  it("lets a founder editing an idea manage its documents", async () => {
    db.idea = storedIdea;
    db.docs = [{ id: "d1", title: "Pitch deck", file_path: "idea/x.pdf", mime_type: "application/pdf", size_bytes: 256000, created_at: "2026-10-20T10:00:00Z" }];
    renderAt("/app/ideas/idea-1/edit");
    expect(await screen.findByText("Pitch deck")).toBeInTheDocument();
    expect(screen.getByLabelText("Document file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Pitch deck" })).toBeInTheDocument();
  });

  it("saves the private pitch against the new idea, separately from the public idea", async () => {
    renderAt("/app/ideas/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My new venture" } });
    fireEvent.change(screen.getByLabelText("Business model"), { target: { value: "  Subscription  " } });
    fireEvent.change(screen.getByLabelText("Financial estimates"), { target: { value: "Break-even in month 12" } });
    save();

    expect(await screen.findByText("MY IDEAS LIST")).toBeInTheDocument();
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).not.toHaveProperty("business_model"); // never part of the public idea
    expect(db.upserts).toEqual([{
      idea_id: "new-idea", business_model: "Subscription", target_customers: null, market_research: null, financial_estimates: "Break-even in month 12",
    }]);
    expect(toast.success).toHaveBeenCalledWith("Pitch published");
  });

  it("does not create a detailed pitch when every section is empty", async () => {
    renderAt("/app/ideas/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My new venture" } });
    save();
    expect(await screen.findByText("MY IDEAS LIST")).toBeInTheDocument();
    expect(db.upserts).toEqual([]);
    expect(db.deletes).toEqual([]);
  });

  it("loads an existing detailed pitch into the form when editing", async () => {
    db.idea = storedIdea;
    db.pitch = { business_model: "Freemium", target_customers: null, market_research: "TAM 12M", financial_estimates: "" };
    renderAt("/app/ideas/abc/edit");
    await waitFor(() => expect((screen.getByLabelText("Business model") as HTMLTextAreaElement).value).toBe("Freemium"));
    expect((screen.getByLabelText("Market research") as HTMLTextAreaElement).value).toBe("TAM 12M");
    expect((screen.getByLabelText("Target customers") as HTMLTextAreaElement).value).toBe("");
  });

  it("updates the private pitch when a section changes", async () => {
    db.idea = storedIdea;
    db.pitch = { business_model: "Freemium", target_customers: null, market_research: null, financial_estimates: null };
    renderAt("/app/ideas/abc/edit");
    await waitFor(() => expect((screen.getByLabelText("Business model") as HTMLTextAreaElement).value).toBe("Freemium"));
    fireEvent.change(screen.getByLabelText("Business model"), { target: { value: "Freemium plus campus licences" } });
    save();

    expect(await screen.findByText("MY IDEAS LIST")).toBeInTheDocument();
    expect(db.updated).toHaveLength(1);
    expect(db.upserts).toEqual([{
      idea_id: "abc", business_model: "Freemium plus campus licences", target_customers: null, market_research: null, financial_estimates: null,
    }]);
    expect(toast.success).toHaveBeenCalledWith("Updated");
  });

  it("removes the private pitch when the founder clears every section", async () => {
    db.idea = storedIdea;
    db.pitch = { business_model: "Freemium", target_customers: null, market_research: null, financial_estimates: null };
    renderAt("/app/ideas/abc/edit");
    await waitFor(() => expect((screen.getByLabelText("Business model") as HTMLTextAreaElement).value).toBe("Freemium"));
    fireEvent.change(screen.getByLabelText("Business model"), { target: { value: "" } });
    save();

    expect(await screen.findByText("MY IDEAS LIST")).toBeInTheDocument();
    expect(db.deletes).toHaveLength(1);
    expect(db.upserts).toEqual([]);
  });

  it("refuses a section that is too long, and saves nothing", async () => {
    renderAt("/app/ideas/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My new venture" } });
    fireEvent.change(screen.getByLabelText("Market research"), { target: { value: "x".repeat(20001) } });
    save();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toMatch(/at most 20,000 characters/);
    expect(db.inserted).toEqual([]);
    expect(db.upserts).toEqual([]);
  });

  it("tells the founder if the idea saved but the private pitch did not", async () => {
    db.pitchError = { message: "permission denied" };
    renderAt("/app/ideas/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My new venture" } });
    fireEvent.change(screen.getByLabelText("Business model"), { target: { value: "Subscription" } });
    save();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The idea was saved, but the detailed pitch was not: permission denied"));
    expect(screen.queryByText("MY IDEAS LIST")).not.toBeInTheDocument();
  });

  it("keeps the signed-in founder as the owner of a new idea", async () => {
    renderAt("/app/ideas/new");
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My new venture" } });
    save();
    await screen.findByText("MY IDEAS LIST");
    expect(db.inserted[0].user_id).toBe(ME);
  });
});
