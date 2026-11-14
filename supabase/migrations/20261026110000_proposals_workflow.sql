-- Proposals workflow: negotiation fields, locked-down writes, one checked way to respond, notifications.

-- 1. A founder can counter with new terms; keep them next to the original offer.
--    (When a counter is accepted, amount/equity become the agreed terms.)
ALTER TABLE public.proposals
  ADD COLUMN counter_amount numeric(14,2),
  ADD COLUMN counter_equity numeric(5,2),
  ADD COLUMN counter_message text,
  ADD COLUMN responded_at timestamptz,
  ADD CONSTRAINT proposals_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT proposals_equity_valid CHECK (equity IS NULL OR (equity > 0 AND equity <= 100)),
  ADD CONSTRAINT proposals_message_length CHECK (message IS NULL OR char_length(message) <= 1000),
  ADD CONSTRAINT proposals_counter_valid CHECK (
    (counter_amount IS NULL OR counter_amount > 0)
    AND (counter_equity IS NULL OR (counter_equity > 0 AND counter_equity <= 100))
    AND (counter_message IS NULL OR char_length(counter_message) <= 1000)
  );

-- 2. Nobody edits a proposal directly any more (an investor could have marked their own proposal
--    "accepted"). Reading and creating stay; every change goes through respond_to_proposal().
REVOKE ALL ON public.proposals FROM anon, authenticated;
GRANT SELECT, INSERT ON public.proposals TO authenticated;
DROP POLICY IF EXISTS "involved parties update proposals" ON public.proposals;

-- A new proposal must start as plain "pending", be addressed to the idea's real owner,
-- and be for an idea the investor can actually see.
DROP POLICY IF EXISTS "investors create proposals" ON public.proposals;
CREATE POLICY "investors create proposals" ON public.proposals FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = investor_id
  AND public.has_role(auth.uid(), 'investor')
  AND status = 'pending'
  AND counter_amount IS NULL AND counter_equity IS NULL AND counter_message IS NULL AND responded_at IS NULL
  AND EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = entrepreneur_id)
);

-- 3. Tell the founder when a proposal arrives.
CREATE OR REPLACE FUNCTION public.notify_new_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _investor text; _idea text;
BEGIN
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'An investor') INTO _investor FROM public.profiles WHERE id = NEW.investor_id;
  SELECT title INTO _idea FROM public.ideas WHERE id = NEW.idea_id;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (
    NEW.entrepreneur_id,
    'New proposal on ' || COALESCE(_idea, 'your idea'),
    COALESCE(_investor, 'An investor') || ' offered $' || to_char(round(NEW.amount), 'FM999,999,999,990'),
    '/app/proposals', 'proposal'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER proposals_notify AFTER INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_new_proposal();

REVOKE EXECUTE ON FUNCTION public.notify_new_proposal() FROM PUBLIC, anon, authenticated;

-- 4. The one way to change a proposal.
--    Founder:  accept | decline | counter      (only while it is pending)
--    Investor: withdraw (pending or countered) | accept_counter (only when countered)
--    Accepting adds the money to the idea's funding_raised.
CREATE OR REPLACE FUNCTION public.respond_to_proposal(
  _proposal_id uuid,
  _action text,
  _amount numeric DEFAULT NULL,
  _equity numeric DEFAULT NULL,
  _message text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  p public.proposals%ROWTYPE;
  _idea text;
  _actor text;
  _final numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Locks the row, so two quick clicks cannot both succeed. Strangers just see "not found".
  SELECT * INTO p FROM public.proposals
  WHERE id = _proposal_id AND (investor_id = _uid OR entrepreneur_id = _uid)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;

  SELECT title INTO _idea FROM public.ideas WHERE id = p.idea_id;
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'Someone') INTO _actor FROM public.profiles WHERE id = _uid;
  _idea := COALESCE(_idea, 'an idea');
  _actor := COALESCE(_actor, 'Someone');

  IF _action IN ('accept', 'decline', 'counter') THEN
    IF p.entrepreneur_id <> _uid THEN RAISE EXCEPTION 'Only the founder can do that'; END IF;
    IF p.status <> 'pending' THEN RAISE EXCEPTION 'This proposal can no longer be changed'; END IF;
  ELSIF _action = 'accept_counter' THEN
    IF p.investor_id <> _uid THEN RAISE EXCEPTION 'Only the investor can do that'; END IF;
    IF p.status <> 'countered' THEN RAISE EXCEPTION 'There is no counter-offer to accept'; END IF;
  ELSIF _action = 'withdraw' THEN
    IF p.investor_id <> _uid THEN RAISE EXCEPTION 'Only the investor can do that'; END IF;
    IF p.status NOT IN ('pending', 'countered') THEN RAISE EXCEPTION 'This proposal can no longer be changed'; END IF;
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;

  IF _action = 'accept' THEN
    UPDATE public.proposals SET status = 'accepted', responded_at = now() WHERE id = p.id;
    UPDATE public.ideas SET funding_raised = funding_raised + p.amount WHERE id = p.idea_id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.investor_id, 'Proposal accepted', _actor || ' accepted your proposal for ' || _idea, '/app/proposals', 'proposal');

  ELSIF _action = 'decline' THEN
    UPDATE public.proposals SET status = 'rejected', responded_at = now() WHERE id = p.id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.investor_id, 'Proposal declined', _actor || ' declined your proposal for ' || _idea, '/app/proposals', 'proposal');

  ELSIF _action = 'counter' THEN
    IF _amount IS NULL OR _amount <= 0 OR _amount >= 1000000000000 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
    IF _equity IS NOT NULL AND (_equity <= 0 OR _equity > 100) THEN RAISE EXCEPTION 'Equity must be between 0 and 100'; END IF;
    IF _message IS NOT NULL AND char_length(_message) > 1000 THEN RAISE EXCEPTION 'The note is too long'; END IF;
    UPDATE public.proposals
       SET status = 'countered', counter_amount = _amount, counter_equity = _equity,
           counter_message = NULLIF(btrim(COALESCE(_message, '')), ''), responded_at = now()
     WHERE id = p.id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.investor_id, 'Counter-offer on ' || _idea,
            _actor || ' countered with $' || to_char(round(_amount), 'FM999,999,999,990'), '/app/proposals', 'proposal');

  ELSIF _action = 'accept_counter' THEN
    _final := COALESCE(p.counter_amount, p.amount);
    UPDATE public.proposals
       SET status = 'accepted', amount = _final, equity = COALESCE(p.counter_equity, p.equity), responded_at = now()
     WHERE id = p.id;
    UPDATE public.ideas SET funding_raised = funding_raised + _final WHERE id = p.idea_id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.entrepreneur_id, 'Counter-offer accepted', _actor || ' accepted your counter-offer on ' || _idea, '/app/proposals', 'proposal');

  ELSIF _action = 'withdraw' THEN
    UPDATE public.proposals SET status = 'withdrawn', responded_at = now() WHERE id = p.id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.entrepreneur_id, 'Proposal withdrawn', _actor || ' withdrew their proposal for ' || _idea, '/app/proposals', 'proposal');
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.respond_to_proposal(uuid, text, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_proposal(uuid, text, numeric, numeric, text) TO authenticated;

-- 5. Live updates for the Proposals page.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'proposals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
  END IF;
END $$;
