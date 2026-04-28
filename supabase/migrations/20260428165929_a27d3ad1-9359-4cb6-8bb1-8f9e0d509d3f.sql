
-- Set search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Lock down SECURITY DEFINER functions (only triggers / server use them)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Tighten notifications insert: only the recipient can insert their own row from the client.
-- (Server-side service role bypasses RLS for system inserts.)
DROP POLICY IF EXISTS "system inserts notifications" ON public.notifications;
CREATE POLICY "users insert own notifications" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() = user_id);
