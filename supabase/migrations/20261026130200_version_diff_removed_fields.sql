-- The list of changed fields only looked at keys that still exist in the new snapshot, so deleting the
-- confidential text produced a version with no changed fields. Compare the keys of both snapshots instead.
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
      SELECT 'public.' || x.key AS k
        FROM (SELECT jsonb_object_keys(_cur_public) AS key UNION SELECT jsonb_object_keys(_prev_public)) x
       WHERE (_cur_public -> x.key) IS DISTINCT FROM (_prev_public -> x.key)
      UNION ALL
      SELECT 'details.' || x.key
        FROM (SELECT jsonb_object_keys(_cur_details) AS key UNION SELECT jsonb_object_keys(_prev_details)) x
       WHERE (_cur_details -> x.key) IS DISTINCT FROM (_prev_details -> x.key)
      UNION ALL
      SELECT 'documents' WHERE (_snap -> 'documents') IS DISTINCT FROM (_prev.snapshot -> 'documents')
    ) t;
  END IF;

  INSERT INTO public.pitch_versions (idea_id, version, snapshot, content_hash, changed_fields, created_by, created_at)
  VALUES (_idea_id, COALESCE(_prev.version, 0) + 1, _snap, _hash, _changed, auth.uid(), _at);
END; $$;
