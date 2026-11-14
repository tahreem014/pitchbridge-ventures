-- Lets a brand-new account choose its starting role (entrepreneur / investor).
-- Needed for OAuth sign-ups (Google), which can't pass the role through signup metadata
-- the way email sign-up does. Admin can never be self-assigned, and accounts older than
-- 10 minutes are left untouched.
CREATE OR REPLACE FUNCTION public.set_signup_role(_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('entrepreneur', 'investor') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = _uid AND created_at > now() - interval '10 minutes'
  ) THEN
    RETURN;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _uid AND role IN ('entrepreneur', 'investor');
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_signup_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_signup_role(public.app_role) TO authenticated;
