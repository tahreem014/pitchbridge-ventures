// Entry point: wires the real database and storage into the handler. See handler.ts for the logic.
import { createClient } from "@supabase/supabase-js";
import { BUCKET, handle, type AuthorizeResult, type AuthorizedDocument } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function authorize(token: string, documentId: string): Promise<AuthorizeResult> {
  // Called with the caller's own token so the database sees who is asking and can log the view.
  const asCaller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await asCaller.rpc("authorize_pitch_document", { _document_id: documentId });
  if (error) {
    // An anonymous key (no signed-in user) is refused by the database with "permission denied" (42501).
    if (error.code === "42501" || /not authenticated|permission denied/i.test(error.message)) return { ok: false, status: 401, message: "Sign in to view this document" };
    if (/do not have access/i.test(error.message)) return { ok: false, status: 403, message: "You do not have access to this document" };
    return { ok: false, status: 500, message: "Could not check your access. Please try again." };
  }
  const doc = (Array.isArray(data) ? data[0] : data) as AuthorizedDocument | undefined;
  if (!doc) return { ok: false, status: 403, message: "You do not have access to this document" };
  return { ok: true, doc };
}

async function download(path: string): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

Deno.serve((req) => handle(req, { authorize, download, now: () => new Date() }));
