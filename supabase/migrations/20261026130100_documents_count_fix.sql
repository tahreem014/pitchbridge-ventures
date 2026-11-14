-- The "at most 10 documents per idea" rule read its own table from inside the policy, which Postgres
-- rejects as infinite recursion. A small helper that bypasses row-level security does the counting.
CREATE OR REPLACE FUNCTION public.pitch_document_count(_idea_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.pitch_documents WHERE idea_id = _idea_id
$$;
REVOKE EXECUTE ON FUNCTION public.pitch_document_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pitch_document_count(uuid) TO authenticated;

DROP POLICY IF EXISTS "founders add documents" ON public.pitch_documents;
CREATE POLICY "founders add documents" ON public.pitch_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid())
  AND public.pitch_document_count(idea_id) < 10
);
