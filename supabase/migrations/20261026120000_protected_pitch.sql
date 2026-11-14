-- Phase 1 of idea protection: a restricted detailed pitch, access requests, an NDA record,
-- version history and an access log. Evidence and deterrence, not a guarantee of legal ownership.

-- 0. Investors may see THAT a detailed pitch exists, never what is in it.
ALTER TABLE public.ideas ADD COLUMN has_detailed_pitch boolean NOT NULL DEFAULT false;

-- 1. The restricted detailed pitch. Only the founder can read or write it directly;
--    investors reach it only through get_pitch_details(), which checks access and logs the view.
CREATE TABLE public.idea_pitch_details (
  idea_id uuid PRIMARY KEY REFERENCES public.ideas(id) ON DELETE CASCADE,
  business_model text,
  target_customers text,
  market_research text,
  financial_estimates text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idea_pitch_details_length CHECK (
    char_length(COALESCE(business_model, '')) <= 20000
    AND char_length(COALESCE(target_customers, '')) <= 20000
    AND char_length(COALESCE(market_research, '')) <= 20000
    AND char_length(COALESCE(financial_estimates, '')) <= 20000
  )
);
ALTER TABLE public.idea_pitch_details ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER idea_pitch_details_updated BEFORE UPDATE ON public.idea_pitch_details
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "owners read their pitch details" ON public.idea_pitch_details FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));
CREATE POLICY "owners add pitch details" ON public.idea_pitch_details FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));
CREATE POLICY "owners edit pitch details" ON public.idea_pitch_details FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));
CREATE POLICY "owners delete pitch details" ON public.idea_pitch_details FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_has_detailed_pitch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.ideas SET has_detailed_pitch = false WHERE id = OLD.idea_id;
  ELSE
    UPDATE public.ideas SET has_detailed_pitch = true WHERE id = NEW.idea_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER idea_pitch_details_flag AFTER INSERT OR DELETE ON public.idea_pitch_details
FOR EACH ROW EXECUTE FUNCTION public.sync_has_detailed_pitch();

-- 2. Version history: a timestamped, hashed snapshot every time the pitch really changes.
--    Nobody can edit or delete a version through the API.
CREATE TABLE public.pitch_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  changed_fields text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, version)
);
ALTER TABLE public.pitch_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read their pitch history" ON public.pitch_versions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.record_pitch_version(_idea_id uuid, _at timestamptz DEFAULT now())
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _snap jsonb;
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
    ) t;
  END IF;

  INSERT INTO public.pitch_versions (idea_id, version, snapshot, content_hash, changed_fields, created_by, created_at)
  VALUES (_idea_id, COALESCE(_prev.version, 0) + 1, _snap, _hash, _changed, auth.uid(), _at);
END; $$;

CREATE OR REPLACE FUNCTION public.trg_pitch_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'ideas' THEN
    PERFORM public.record_pitch_version(NEW.id);
  ELSE
    PERFORM public.record_pitch_version(NEW.idea_id);
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER ideas_version AFTER INSERT OR UPDATE OF title, tagline, description, category, stage, funding_target, equity_offered
ON public.ideas FOR EACH ROW EXECUTE FUNCTION public.trg_pitch_version();
CREATE TRIGGER pitch_details_version AFTER INSERT OR UPDATE ON public.idea_pitch_details
FOR EACH ROW EXECUTE FUNCTION public.trg_pitch_version();

-- Ideas that already exist get a first version dated when they were created.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, created_at FROM public.ideas LOOP
    PERFORM public.record_pitch_version(r.id, r.created_at);
  END LOOP;
END $$;

-- 3. The confidentiality (NDA) template. The exact text an investor saw is copied into their acceptance.
CREATE TABLE public.nda_templates (
  version text PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nda_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in users read the nda template" ON public.nda_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.nda_templates (version, title, body) VALUES ('nda-v1', 'Confidentiality Agreement', $nda$This agreement is between the founder who published the idea (the "Founder") and the investor asking to read its detailed pitch (the "Investor"). The Investor accepts it electronically through PitchBridge.

1. Purpose. The Investor wants to read the Founder's detailed pitch only to decide whether to invest in the idea (the "Purpose").

2. Confidential Information. This means everything in the detailed pitch and any supporting documents, including the business model, target customers, market research and financial estimates, and anything else a reasonable person would understand to be confidential.

3. The Investor's obligations. The Investor will (a) keep the Confidential Information secret; (b) use it only for the Purpose; (c) not copy, screenshot, republish or share it with anyone, except advisers who need it for the Purpose and are bound by equal duties of confidentiality; and (d) protect it with at least reasonable care.

4. Exceptions. These duties do not apply to information that is or becomes public without fault of the Investor, was already lawfully known to the Investor, is developed independently without using the Confidential Information, or must be disclosed by law (in which case the Investor will tell the Founder first where the law allows).

5. No transfer of rights. The Founder keeps all rights in the idea and the Confidential Information. Nothing here transfers ownership or gives the Investor a licence to use the idea.

6. Duration. These duties last for 2 years from the date of acceptance, and for as long as any trade secret remains a trade secret.

7. Return or deletion. On request, or if the Investor decides not to invest, the Investor will stop using the Confidential Information and delete all copies.

8. Record. By accepting, the Investor confirms they have read and agree to these terms. PitchBridge records the Investor's name and email, the idea, the exact text accepted, the date and time, and technical details such as IP address.

9. Governing law. This agreement is governed by the laws that apply where the Founder is based, unless both parties agree otherwise in writing.

10. Not legal advice. This template was written for the PitchBridge platform and has not been reviewed by a lawyer. Both parties should take independent legal advice before relying on it.$nda$);

-- 4. Access requests. One row per request, so the history is kept; at most one open (pending or approved) per investor and idea.
CREATE TYPE public.pitch_access_status AS ENUM ('pending', 'approved', 'rejected', 'revoked');

CREATE TABLE public.pitch_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.pitch_access_status NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT pitch_access_message_length CHECK (message IS NULL OR char_length(message) <= 1000)
);
CREATE UNIQUE INDEX pitch_access_one_open_request ON public.pitch_access_requests (idea_id, investor_id)
  WHERE status IN ('pending', 'approved');
CREATE INDEX idx_pitch_access_idea ON public.pitch_access_requests (idea_id, created_at DESC);
ALTER TABLE public.pitch_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investor or founder reads access requests" ON public.pitch_access_requests FOR SELECT TO authenticated
USING (investor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

-- 5. The NDA acceptance record: who, which idea, which exact text, when, from where.
CREATE TABLE public.nda_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.pitch_access_requests(id) ON DELETE CASCADE,
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nda_version text NOT NULL REFERENCES public.nda_templates(version),
  nda_text text NOT NULL,
  nda_hash text NOT NULL,
  investor_name text,
  investor_email text,
  ip_address text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nda_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "investor or founder reads nda acceptances" ON public.nda_acceptances FOR SELECT TO authenticated
USING (investor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

-- 6. The access log: requests, decisions, NDA acceptances and every time an investor opens the pitch.
CREATE TABLE public.pitch_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  request_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pitch_access_log_idea ON public.pitch_access_log (idea_id, created_at DESC);
ALTER TABLE public.pitch_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "founders read their pitch access log" ON public.pitch_access_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid()));

-- 7. Permissions: the API can read, and the founder can write their own pitch text. Everything else
--    (requests, decisions, NDA records, versions, the log) is written only by the functions below.
REVOKE ALL ON public.idea_pitch_details, public.pitch_versions, public.pitch_access_requests,
  public.nda_templates, public.nda_acceptances, public.pitch_access_log FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_pitch_details TO authenticated;
GRANT SELECT ON public.pitch_versions, public.pitch_access_requests, public.nda_templates,
  public.nda_acceptances, public.pitch_access_log TO authenticated;

-- 8. Who may read a pitch: its founder, or an investor whose request was approved AND who accepted the NDA.
--    Always answers for the caller, so it cannot be used to probe other people's access.
CREATE OR REPLACE FUNCTION public.has_pitch_access(_idea_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea_id AND i.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.pitch_access_requests r
        JOIN public.nda_acceptances n ON n.request_id = r.id
        WHERE r.idea_id = _idea_id AND r.investor_id = auth.uid() AND r.status = 'approved'
      )
$$;

-- 9. The investor asks to read the detailed pitch.
CREATE OR REPLACE FUNCTION public.request_pitch_access(_idea_id uuid, _message text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _idea public.ideas%ROWTYPE;
  _name text;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(_uid, 'investor') THEN RAISE EXCEPTION 'Switch to Investor mode to request access'; END IF;
  IF _message IS NOT NULL AND char_length(_message) > 1000 THEN RAISE EXCEPTION 'The message is too long'; END IF;

  SELECT * INTO _idea FROM public.ideas WHERE id = _idea_id AND status = 'published' AND visibility = 'public';
  IF NOT FOUND THEN RAISE EXCEPTION 'Idea not found'; END IF;
  IF _idea.user_id = _uid THEN RAISE EXCEPTION 'This is your own pitch'; END IF;
  IF NOT _idea.has_detailed_pitch THEN RAISE EXCEPTION 'This idea has no detailed pitch yet'; END IF;
  IF EXISTS (SELECT 1 FROM public.pitch_access_requests WHERE idea_id = _idea_id AND investor_id = _uid AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'You already have an open request for this pitch';
  END IF;

  INSERT INTO public.pitch_access_requests (idea_id, investor_id, message)
  VALUES (_idea_id, _uid, NULLIF(btrim(COALESCE(_message, '')), '')) RETURNING id INTO _id;

  INSERT INTO public.pitch_access_log (idea_id, actor_id, event, request_id) VALUES (_idea_id, _uid, 'access_requested', _id);

  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'An investor') INTO _name FROM public.profiles WHERE id = _uid;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_idea.user_id, 'Pitch access request', COALESCE(_name, 'An investor') || ' asked to read the detailed pitch of ' || _idea.title, '/app/access', 'access');
  RETURN _id;
END; $$;

-- 10. The founder decides: approve or reject a pending request, or revoke an approved one.
CREATE OR REPLACE FUNCTION public.decide_pitch_access(_request_id uuid, _decision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  r public.pitch_access_requests%ROWTYPE;
  _title text;
  _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT r2.* INTO r FROM public.pitch_access_requests r2
  JOIN public.ideas i ON i.id = r2.idea_id
  WHERE r2.id = _request_id AND i.user_id = _uid
  FOR UPDATE OF r2;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  SELECT title INTO _title FROM public.ideas WHERE id = r.idea_id;
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'The founder') INTO _name FROM public.profiles WHERE id = _uid;

  IF _decision = 'approve' THEN
    IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been answered'; END IF;
    UPDATE public.pitch_access_requests SET status = 'approved', decided_at = now() WHERE id = r.id;
    INSERT INTO public.pitch_access_log (idea_id, actor_id, event, request_id) VALUES (r.idea_id, _uid, 'access_approved', r.id);
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (r.investor_id, 'Pitch access approved', COALESCE(_name, 'The founder') || ' approved your request for ' || _title || '. Accept the confidentiality terms to read the pitch.', '/app/ideas/' || r.idea_id::text, 'access');
  ELSIF _decision = 'reject' THEN
    IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been answered'; END IF;
    UPDATE public.pitch_access_requests SET status = 'rejected', decided_at = now() WHERE id = r.id;
    INSERT INTO public.pitch_access_log (idea_id, actor_id, event, request_id) VALUES (r.idea_id, _uid, 'access_rejected', r.id);
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (r.investor_id, 'Pitch access declined', COALESCE(_name, 'The founder') || ' declined your request for ' || _title, '/app/access', 'access');
  ELSIF _decision = 'revoke' THEN
    IF r.status <> 'approved' THEN RAISE EXCEPTION 'Only approved access can be revoked'; END IF;
    UPDATE public.pitch_access_requests SET status = 'revoked', decided_at = now() WHERE id = r.id;
    INSERT INTO public.pitch_access_log (idea_id, actor_id, event, request_id) VALUES (r.idea_id, _uid, 'access_revoked', r.id);
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (r.investor_id, 'Pitch access withdrawn', COALESCE(_name, 'The founder') || ' withdrew your access to ' || _title, '/app/access', 'access');
  ELSE
    RAISE EXCEPTION 'Unknown decision';
  END IF;
END; $$;

-- 11. The investor accepts the confidentiality terms. The exact text, the person, the time and where
--     it came from are stored. Only after this does get_pitch_details() open up.
CREATE OR REPLACE FUNCTION public.accept_nda(_request_id uuid, _nda_version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  r public.pitch_access_requests%ROWTYPE;
  t public.nda_templates%ROWTYPE;
  _latest text;
  _title text;
  _name text;
  _email text;
  _headers json;
  _ip text;
  _ua text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO r FROM public.pitch_access_requests WHERE id = _request_id AND investor_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'approved' THEN RAISE EXCEPTION 'This request is not approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.nda_acceptances WHERE request_id = r.id) THEN RAISE EXCEPTION 'You have already accepted these terms'; END IF;

  SELECT version INTO _latest FROM public.nda_templates ORDER BY created_at DESC LIMIT 1;
  IF _nda_version IS DISTINCT FROM _latest THEN RAISE EXCEPTION 'Please review the latest confidentiality terms'; END IF;
  SELECT * INTO t FROM public.nda_templates WHERE version = _latest;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), NULL) INTO _name FROM public.profiles WHERE id = _uid;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  BEGIN
    _headers := NULLIF(current_setting('request.headers', true), '')::json;
    _ip := NULLIF(btrim(split_part(COALESCE(_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
    _ua := NULLIF(left(COALESCE(_headers ->> 'user-agent', ''), 300), '');
  EXCEPTION WHEN OTHERS THEN
    _ip := NULL; _ua := NULL;
  END;

  INSERT INTO public.nda_acceptances (request_id, idea_id, investor_id, nda_version, nda_text, nda_hash, investor_name, investor_email, ip_address, user_agent)
  VALUES (r.id, r.idea_id, _uid, t.version, t.body, encode(extensions.digest(t.body, 'sha256'), 'hex'), _name, _email, _ip, _ua);

  INSERT INTO public.pitch_access_log (idea_id, actor_id, event, request_id, details)
  VALUES (r.idea_id, _uid, 'nda_accepted', r.id, jsonb_build_object('nda_version', t.version));

  SELECT title, user_id INTO _title, _uid FROM public.ideas WHERE id = r.idea_id;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_uid, 'Confidentiality terms accepted', COALESCE(_name, 'An investor') || ' accepted your confidentiality terms and can now read the detailed pitch of ' || _title, '/app/access', 'access');
END; $$;

-- 12. The only way an investor reads the detailed pitch. Checks access, logs the view
--     (at most once per half hour per investor and idea), and returns the viewer's own name and
--     email so the app can mark the page with it.
CREATE OR REPLACE FUNCTION public.get_pitch_details(_idea_id uuid)
RETURNS TABLE (
  business_model text, target_customers text, market_research text, financial_estimates text,
  updated_at timestamptz, viewer_name text, viewer_email text, nda_accepted_at timestamptz, is_owner boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner boolean;
  _accepted timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_pitch_access(_idea_id) THEN RAISE EXCEPTION 'You do not have access to this pitch'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = _idea_id AND i.user_id = _uid) INTO _owner;

  IF NOT _owner THEN
    SELECT n.accepted_at INTO _accepted
    FROM public.pitch_access_requests r JOIN public.nda_acceptances n ON n.request_id = r.id
    WHERE r.idea_id = _idea_id AND r.investor_id = _uid AND r.status = 'approved' LIMIT 1;

    IF NOT EXISTS (
      SELECT 1 FROM public.pitch_access_log l
      WHERE l.idea_id = _idea_id AND l.actor_id = _uid AND l.event = 'pitch_viewed' AND l.created_at > now() - interval '30 minutes'
    ) THEN
      INSERT INTO public.pitch_access_log (idea_id, actor_id, event) VALUES (_idea_id, _uid, 'pitch_viewed');
    END IF;
  END IF;

  RETURN QUERY
  SELECT d.business_model, d.target_customers, d.market_research, d.financial_estimates, d.updated_at,
         (SELECT p.full_name FROM public.profiles p WHERE p.id = _uid),
         (SELECT u.email::text FROM auth.users u WHERE u.id = _uid),
         _accepted, _owner
  FROM public.idea_pitch_details d WHERE d.idea_id = _idea_id;
END; $$;

-- Internal helpers are not callable from the API; the public functions are for signed-in users only.
REVOKE EXECUTE ON FUNCTION public.record_pitch_version(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pitch_version() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_has_detailed_pitch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_pitch_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_pitch_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decide_pitch_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_nda(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_pitch_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_pitch_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_pitch_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_pitch_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_nda(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pitch_details(uuid) TO authenticated;

-- 13. Live updates for the access page.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pitch_access_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pitch_access_requests;
  END IF;
END $$;
