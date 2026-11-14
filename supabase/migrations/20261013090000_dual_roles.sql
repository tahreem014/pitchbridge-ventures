-- One person can be both an entrepreneur and an investor.

-- Lets a signed-in user enable the other role for themselves. Admin can never be self-assigned.
CREATE OR REPLACE FUNCTION public.add_my_role(_role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _role NOT IN ('entrepreneur', 'investor') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), _role) ON CONFLICT DO NOTHING;
END; $$;

REVOKE EXECUTE ON FUNCTION public.add_my_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_my_role(public.app_role) TO authenticated;

-- Acting as an investor / entrepreneur now requires actually holding that role.
DROP POLICY IF EXISTS "owners insert ideas" ON public.ideas;
CREATE POLICY "owners insert ideas" ON public.ideas FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (public.has_role(auth.uid(), 'entrepreneur') OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "investors create proposals" ON public.proposals;
CREATE POLICY "investors create proposals" ON public.proposals FOR INSERT
WITH CHECK (auth.uid() = investor_id AND public.has_role(auth.uid(), 'investor'));

-- With both roles possible on one account, a proposal from someone to themselves must be impossible.
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_not_self CHECK (investor_id <> entrepreneur_id);
