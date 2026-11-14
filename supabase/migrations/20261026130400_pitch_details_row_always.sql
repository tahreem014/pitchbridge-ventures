-- A pitch can now consist of documents only. get_pitch_details used to return nothing when there was no
-- written text, which made an approved investor look like they had no access. Once access is verified it now
-- always returns the reader's row (and the confidentiality details), with empty sections when there is no text.
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
  FROM (SELECT 1) one LEFT JOIN public.idea_pitch_details d ON d.idea_id = _idea_id;
END; $$;
