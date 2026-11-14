-- Phase 2: restricted supporting documents (pitch deck, financials ...).
-- Files sit in a PRIVATE bucket that investors can never read directly. The only way an investor gets a
-- file is the pitch-document server function, which checks access, stamps their name and email on every
-- page and returns the stamped copy.

-- 1. Private bucket: 10 MB, PDF and images only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pitch-documents', 'pitch-documents', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Only the founder of an idea can touch files in the folder named after that idea. No policy exists for
-- investors on purpose, and files cannot be overwritten (every upload has a new name).
CREATE POLICY "founders read their pitch documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pitch-documents' AND EXISTS (
  SELECT 1 FROM public.ideas i WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid()));
CREATE POLICY "founders upload their pitch documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pitch-documents' AND EXISTS (
  SELECT 1 FROM public.ideas i WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid()));
CREATE POLICY "founders delete their pitch documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pitch-documents' AND EXISTS (
  SELECT 1 FROM public.ideas i WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid()));

-- 2. One row per document. The sha256 is the file's fingerprint, taken in the founder's browser before upload.
CREATE TABLE public.pitch_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pitch_documents_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT pitch_documents_mime CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  CONSTRAINT pitch_documents_size CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  CONSTRAINT pitch_documents_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT pitch_documents_own_folder CHECK (file_path LIKE idea_id::text || '/%')
);
CREATE INDEX idx_pitch_documents_idea ON public.pitch_documents (idea_id, created_at);
ALTER TABLE public.pitch_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "founders read their documents" ON public.pitch_documents FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));
CREATE POLICY "founders add documents" ON public.pitch_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid())
  AND (SELECT count(*) FROM public.pitch_documents d WHERE d.idea_id = idea_id) < 10
);
CREATE POLICY "founders remove documents" ON public.pitch_documents FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

REVOKE ALL ON public.pitch_documents FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.pitch_documents TO authenticated;

-- 3. "Has a detailed pitch" is now true when there is text OR at least one document.
CREATE OR REPLACE FUNCTION public.sync_has_detailed_pitch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _id := OLD.idea_id; ELSE _id := NEW.idea_id; END IF;
  UPDATE public.ideas
     SET has_detailed_pitch = EXISTS (SELECT 1 FROM public.idea_pitch_details WHERE idea_id = _id)
                           OR EXISTS (SELECT 1 FROM public.pitch_documents WHERE idea_id = _id)
   WHERE id = _id;
  RETURN NULL;
END; $$;
CREATE TRIGGER pitch_documents_flag AFTER INSERT OR DELETE ON public.pitch_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_has_detailed_pitch();

-- 4. Documents are part of the version history: title and fingerprint of every file at that moment.
--    (The key is left out when there are no documents, so older versions keep their fingerprints.)
CREATE OR REPLACE FUNCTION public.record_pitch_version(_idea_id uuid, _at timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _snap jsonb;
  _docs jsonb;
  _hash text;
  _prev public.pitch_versions%ROWTYPE;
  _cur_public jsonb; _cur_details jsonb; _prev_public jsonb; _prev_details jsonb;
  _changed text[];
BEGIN
  SELECT jsonb_build_object(
    'public', jsonb_build_object(
      'title', i.title, 'tagline', i.tagline, 'description', i.description, 'category', i.category,
      'stage', i.stage, 'funding_target', i.funding_target, 'equity_offered', i.equity_offered),
    'details', (SELECT jsonb_build_object(
        'business_model', d.business_model, 'target_customers', d.target_customers,
        'market_research', d.market_research, 'financial_estimates', d.financial_estimates)
      FROM public.idea_pitch_details d WHERE d.idea_id = i.id)
  ) INTO _snap FROM public.ideas i WHERE i.id = _idea_id;
  IF _snap IS NULL THEN RETURN; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('title', d.title, 'sha256', d.sha256, 'size_bytes', d.size_bytes) ORDER BY d.created_at, d.id), '[]'::jsonb)
    INTO _docs FROM public.pitch_documents d WHERE d.idea_id = _idea_id;
  IF jsonb_array_length(_docs) > 0 THEN _snap := _snap || jsonb_build_object('documents', _docs); END IF;

  _hash := encode(extensions.digest(_snap::text, 'sha256'), 'hex');
  SELECT * INTO _prev FROM public.pitch_versions WHERE idea_id = _idea_id ORDER BY version DESC LIMIT 1;
  IF FOUND AND _prev.content_hash = _hash THEN RETURN; END IF;   -- nothing really changed

  IF FOUND THEN
    _cur_public := _snap->'public';
    _prev_public := _prev.snapshot->'public';
    _cur_details := CASE WHEN jsonb_typeof(_snap->'details') = 'object' THEN _snap->'details' ELSE '{}'::jsonb END;
    _prev_details := CASE WHEN jsonb_typeof(_prev.snapshot->'details') = 'object' THEN _prev.snapshot->'details' ELSE '{}'::jsonb END;
    SELECT array_agg(k ORDER BY k) INTO _changed FROM (
      SELECT 'public.' || e.key AS k FROM jsonb_each(_cur_public) e WHERE e.value IS DISTINCT FROM (_prev_public -> e.key)
      UNION ALL
      SELECT 'details.' || e.key FROM jsonb_each(_cur_details) e WHERE e.value IS DISTINCT FROM (_prev_details -> e.key)
      UNION ALL
      SELECT 'documents' WHERE (_snap -> 'documents') IS DISTINCT FROM (_prev.snapshot -> 'documents')
    ) t;
  END IF;

  INSERT INTO public.pitch_versions (idea_id, version, snapshot, content_hash, changed_fields, created_by, created_at)
  VALUES (_idea_id, COALESCE(_prev.version, 0) + 1, _snap, _hash, _changed, auth.uid(), _at);
END; $$;

-- Deleting the text or a document is a change too, so the version trigger now covers DELETE.
CREATE OR REPLACE FUNCTION public.trg_pitch_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'ideas' THEN
    PERFORM public.record_pitch_version(NEW.id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.record_pitch_version(OLD.idea_id);
  ELSE
    PERFORM public.record_pitch_version(NEW.idea_id);
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS pitch_details_version ON public.idea_pitch_details;
CREATE TRIGGER pitch_details_version AFTER INSERT OR UPDATE OR DELETE ON public.idea_pitch_details
FOR EACH ROW EXECUTE FUNCTION public.trg_pitch_version();
CREATE TRIGGER pitch_documents_version AFTER INSERT OR DELETE ON public.pitch_documents
FOR EACH ROW EXECUTE FUNCTION public.trg_pitch_version();

-- 5. Investors see the list (names and sizes only), never the storage paths.
CREATE OR REPLACE FUNCTION public.list_pitch_documents(_idea_id uuid)
RETURNS TABLE (id uuid, title text, mime_type text, size_bytes integer, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_pitch_access(_idea_id) THEN RAISE EXCEPTION 'You do not have access to this pitch'; END IF;
  RETURN QUERY
  SELECT d.id, d.title, d.mime_type, d.size_bytes, d.created_at
  FROM public.pitch_documents d WHERE d.idea_id = _idea_id ORDER BY d.created_at, d.id;
END; $$;

-- 6. Called by the pitch-document server function with the caller's own login. Checks access, logs the
--    view (at most once per half hour per investor and document) and returns what is needed to stamp it.
CREATE OR REPLACE FUNCTION public.authorize_pitch_document(_document_id uuid)
RETURNS TABLE (file_path text, title text, mime_type text, viewer_name text, viewer_email text, is_owner boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  d public.pitch_documents%ROWTYPE;
  _owner boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO d FROM public.pitch_documents WHERE id = _document_id;
  IF NOT FOUND OR NOT public.has_pitch_access(d.idea_id) THEN RAISE EXCEPTION 'You do not have access to this document'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = d.idea_id AND i.user_id = _uid) INTO _owner;

  IF NOT _owner AND NOT EXISTS (
    SELECT 1 FROM public.pitch_access_log l
    WHERE l.idea_id = d.idea_id AND l.actor_id = _uid AND l.event = 'document_viewed'
      AND l.details ->> 'document_id' = d.id::text AND l.created_at > now() - interval '30 minutes'
  ) THEN
    INSERT INTO public.pitch_access_log (idea_id, actor_id, event, details)
    VALUES (d.idea_id, _uid, 'document_viewed', jsonb_build_object('document_id', d.id, 'title', d.title));
  END IF;

  RETURN QUERY
  SELECT d.file_path, d.title, d.mime_type,
         (SELECT p.full_name FROM public.profiles p WHERE p.id = _uid),
         (SELECT u.email::text FROM auth.users u WHERE u.id = _uid),
         _owner;
END; $$;

REVOKE EXECUTE ON FUNCTION public.list_pitch_documents(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.authorize_pitch_document(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pitch_documents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_pitch_document(uuid) TO authenticated;
