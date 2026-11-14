-- The upload-limit policy needs signed-in users to be able to run this helper, but nobody should be able to
-- ask how many documents someone else's idea has. Only the idea's owner gets the real count.
CREATE OR REPLACE FUNCTION public.pitch_document_count(_idea_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea_id AND i.user_id = auth.uid())
    THEN (SELECT count(*)::integer FROM public.pitch_documents WHERE idea_id = _idea_id)
    ELSE 0
  END
$$;
