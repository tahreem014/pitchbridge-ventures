-- Founder analytics: real idea views, and aggregate-only stats for a founder's own ideas.

-- One row per viewer per idea per (UTC) day, so refreshing the page does not inflate the count.
-- Closed to the client on purpose: it holds who looked at what, and is only reached through the functions below.
CREATE TABLE public.idea_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, viewer_id, viewed_on)
);
ALTER TABLE public.idea_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.idea_views FROM anon, authenticated;
CREATE INDEX idx_idea_views_idea_day ON public.idea_views (idea_id, viewed_on);

-- A view only bumps views_count, so it must not look like an edit of the idea.
DROP TRIGGER IF EXISTS ideas_updated ON public.ideas;
CREATE TRIGGER ideas_updated BEFORE UPDATE ON public.ideas
FOR EACH ROW WHEN (OLD.views_count IS NOT DISTINCT FROM NEW.views_count)
EXECUTE FUNCTION public.touch_updated_at();

-- Called when someone opens an idea. Counts once per viewer per day; ignores the owner,
-- and anything that is not a public, published idea.
CREATE OR REPLACE FUNCTION public.record_idea_view(_idea_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ideas
    WHERE id = _idea_id AND status = 'published' AND visibility = 'public' AND user_id <> _uid
  ) THEN RETURN; END IF;

  INSERT INTO public.idea_views (idea_id, viewer_id) VALUES (_idea_id, _uid) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted > 0 THEN
    UPDATE public.ideas SET views_count = views_count + 1 WHERE id = _idea_id;
  END IF;
END; $$;

-- Views and saves per idea, for the caller's own ideas only. Counts only: never who saved or viewed.
CREATE OR REPLACE FUNCTION public.my_idea_stats()
RETURNS TABLE (idea_id uuid, views bigint, saves bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.views_count::bigint, (SELECT count(*) FROM public.favorites f WHERE f.idea_id = i.id)
  FROM public.ideas i
  WHERE i.user_id = auth.uid()
$$;

-- Views per day across the caller's own ideas (days with no views are simply absent).
CREATE OR REPLACE FUNCTION public.my_views_by_day(_days int DEFAULT 30)
RETURNS TABLE (day date, views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.viewed_on, count(*)
  FROM public.idea_views v
  JOIN public.ideas i ON i.id = v.idea_id
  WHERE i.user_id = auth.uid()
    AND v.viewed_on > ((now() AT TIME ZONE 'utc')::date - LEAST(GREATEST(_days, 1), 365))
  GROUP BY v.viewed_on
  ORDER BY v.viewed_on
$$;

REVOKE EXECUTE ON FUNCTION public.record_idea_view(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_idea_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_views_by_day(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_idea_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_idea_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_views_by_day(int) TO authenticated;
