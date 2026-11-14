-- Phase 3: investment agreements.
-- Accepting a proposal no longer counts the money straight away. It creates a draft agreement from a template
-- (equity, loan or other). Either side can edit the terms while it is a draft; every edit makes a new version
-- and cancels earlier confirmations. When BOTH sides have confirmed the SAME version, the agreement is executed
-- and only then does the idea's funding_raised go up. All writes go through the functions below.
-- This is a template-based record for a project, not legal advice.

-- 1. The agreement, one per accepted proposal.
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entrepreneur_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  terms jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  terms_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  template_version text NOT NULL DEFAULT 'agreement-template-v1',
  parties jsonb,
  executed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreements_type CHECK (agreement_type IN ('equity', 'loan', 'other')),
  CONSTRAINT agreements_status CHECK (status IN ('draft', 'executed', 'cancelled')),
  CONSTRAINT agreements_amount_positive CHECK (amount > 0),
  CONSTRAINT agreements_hash CHECK (terms_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT agreements_executed_consistent CHECK ((status = 'executed') = (executed_at IS NOT NULL AND parties IS NOT NULL)),
  CONSTRAINT agreements_two_people CHECK (investor_id <> entrepreneur_id)
);
CREATE INDEX idx_agreements_investor ON public.agreements (investor_id, created_at DESC);
CREATE INDEX idx_agreements_entrepreneur ON public.agreements (entrepreneur_id, created_at DESC);
CREATE TRIGGER agreements_updated BEFORE UPDATE ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Who confirmed which version, with the evidence (same idea as the NDA record).
CREATE TABLE public.agreement_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party text NOT NULL,
  version integer NOT NULL,
  terms_hash text NOT NULL,
  name text,
  email text,
  ip_address text,
  user_agent text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_confirmations_party CHECK (party IN ('investor', 'entrepreneur')),
  UNIQUE (agreement_id, version, user_id)
);

-- 3. The timeline.
CREATE TABLE public.agreement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event text NOT NULL,
  version integer,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agreement_events_agreement ON public.agreement_events (agreement_id, created_at);

-- 4. Only the two parties can read; nobody writes directly.
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties read their agreements" ON public.agreements FOR SELECT TO authenticated
USING (investor_id = auth.uid() OR entrepreneur_id = auth.uid());
CREATE POLICY "parties read confirmations" ON public.agreement_confirmations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agreements a WHERE a.id = agreement_id AND (a.investor_id = auth.uid() OR a.entrepreneur_id = auth.uid())));
CREATE POLICY "parties read the timeline" ON public.agreement_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.agreements a WHERE a.id = agreement_id AND (a.investor_id = auth.uid() OR a.entrepreneur_id = auth.uid())));

REVOKE ALL ON public.agreements, public.agreement_confirmations, public.agreement_events FROM anon, authenticated;
GRANT SELECT ON public.agreements, public.agreement_confirmations, public.agreement_events TO authenticated;

-- 5. Checking the terms. `_complete` is false for saving a draft (the structure must be sound) and true
--    for confirming (everything the document needs must be filled in).
CREATE OR REPLACE FUNCTION public.validate_agreement_terms(_type text, _amount numeric, _terms jsonb, _complete boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _text text; _num numeric; _item jsonb; _total numeric := 0; _count integer; _date date;
BEGIN
  IF _type IS NULL OR _type NOT IN ('equity', 'loan', 'other') THEN RAISE EXCEPTION 'Choose the type of agreement'; END IF;
  IF _terms IS NULL OR jsonb_typeof(_terms) <> 'object' THEN RAISE EXCEPTION 'The terms are not valid'; END IF;

  _text := btrim(COALESCE(_terms ->> 'governing_law', ''));
  IF char_length(_text) > 120 THEN RAISE EXCEPTION 'The governing law can have at most 120 characters'; END IF;
  IF _complete AND char_length(_text) < 3 THEN RAISE EXCEPTION 'Say which law governs the agreement'; END IF;

  _text := btrim(COALESCE(_terms ->> 'founder_responsibilities', ''));
  IF char_length(_text) > 2000 THEN RAISE EXCEPTION 'The founder''s responsibilities are too long'; END IF;
  IF _complete AND char_length(_text) < 10 THEN RAISE EXCEPTION 'Describe the founder''s responsibilities'; END IF;

  _text := btrim(COALESCE(_terms ->> 'investor_responsibilities', ''));
  IF char_length(_text) > 2000 THEN RAISE EXCEPTION 'The investor''s responsibilities are too long'; END IF;
  IF _complete AND char_length(_text) < 10 THEN RAISE EXCEPTION 'Describe the investor''s responsibilities'; END IF;

  _text := btrim(COALESCE(_terms ->> 'additional_terms', ''));
  IF char_length(_text) > 3000 THEN RAISE EXCEPTION 'The additional terms are too long'; END IF;

  IF _type = 'equity' THEN
    IF jsonb_typeof(_terms -> 'equity_percent') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter the equity percentage'; END IF;
    _num := (_terms ->> 'equity_percent')::numeric;
    IF _num <= 0 OR _num > 100 THEN RAISE EXCEPTION 'Equity must be more than 0 and at most 100 percent'; END IF;
  ELSIF _type = 'loan' THEN
    IF jsonb_typeof(_terms -> 'interest_rate') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter the yearly interest rate (0 for none)'; END IF;
    _num := (_terms ->> 'interest_rate')::numeric;
    IF _num < 0 OR _num > 100 THEN RAISE EXCEPTION 'The interest rate must be between 0 and 100 percent'; END IF;
    IF jsonb_typeof(_terms -> 'term_months') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Enter the length of the loan in months'; END IF;
    _num := (_terms ->> 'term_months')::numeric;
    IF _num <> trunc(_num) OR _num < 1 OR _num > 120 THEN RAISE EXCEPTION 'The loan must last between 1 and 120 whole months'; END IF;
    IF (_terms ->> 'repayment') IS NULL OR (_terms ->> 'repayment') NOT IN ('monthly', 'quarterly', 'at_maturity') THEN
      RAISE EXCEPTION 'Choose how the loan is repaid';
    END IF;
  ELSE
    _text := btrim(COALESCE(_terms ->> 'arrangement_title', ''));
    IF char_length(_text) > 80 THEN RAISE EXCEPTION 'The arrangement title can have at most 80 characters'; END IF;
    IF _complete AND char_length(_text) < 3 THEN RAISE EXCEPTION 'Give the arrangement a title'; END IF;
    _text := btrim(COALESCE(_terms ->> 'arrangement_description', ''));
    IF char_length(_text) > 3000 THEN RAISE EXCEPTION 'The arrangement description is too long'; END IF;
    IF _complete AND char_length(_text) < 10 THEN RAISE EXCEPTION 'Describe the arrangement'; END IF;
  END IF;

  IF jsonb_typeof(_terms -> 'schedule') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Add at least one payment to the schedule'; END IF;
  _count := jsonb_array_length(_terms -> 'schedule');
  IF _count < 1 OR _count > 12 THEN RAISE EXCEPTION 'The payment schedule needs between 1 and 12 payments'; END IF;
  FOR _item IN SELECT value FROM jsonb_array_elements(_terms -> 'schedule') LOOP
    IF jsonb_typeof(_item) <> 'object' THEN RAISE EXCEPTION 'The payment schedule is not valid'; END IF;
    IF jsonb_typeof(_item -> 'amount') IS DISTINCT FROM 'number' OR (_item ->> 'amount')::numeric <= 0 THEN
      RAISE EXCEPTION 'Every payment needs an amount above zero';
    END IF;
    IF jsonb_typeof(_item -> 'due_date') IS DISTINCT FROM 'string' OR (_item ->> 'due_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Every payment needs a due date';
    END IF;
    BEGIN
      _date := (_item ->> 'due_date')::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'One of the due dates is not a real date';
    END;
    IF char_length(COALESCE(_item ->> 'note', '')) > 120 THEN RAISE EXCEPTION 'A payment note can have at most 120 characters'; END IF;
    _total := _total + (_item ->> 'amount')::numeric;
  END LOOP;
  IF abs(_total - _amount) > 0.005 THEN
    RAISE EXCEPTION 'The payments add up to % but the agreed amount is %', to_char(_total, 'FM999,999,999,990.00'), to_char(_amount, 'FM999,999,999,990.00');
  END IF;
END; $$;

-- Keeps only the fields the template uses, trimmed and with numbers in one form, so equal terms are equal.
CREATE OR REPLACE FUNCTION public.normalize_agreement_terms(_type text, _terms jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _out jsonb;
BEGIN
  _out := jsonb_build_object(
    'governing_law', btrim(COALESCE(_terms ->> 'governing_law', '')),
    'founder_responsibilities', btrim(COALESCE(_terms ->> 'founder_responsibilities', '')),
    'investor_responsibilities', btrim(COALESCE(_terms ->> 'investor_responsibilities', '')),
    'additional_terms', btrim(COALESCE(_terms ->> 'additional_terms', '')),
    'schedule', COALESCE((
      SELECT jsonb_agg(
        CASE WHEN NULLIF(btrim(COALESCE(s.value ->> 'note', '')), '') IS NULL
          THEN jsonb_build_object('due_date', s.value ->> 'due_date', 'amount', round((s.value ->> 'amount')::numeric, 2))
          ELSE jsonb_build_object('due_date', s.value ->> 'due_date', 'amount', round((s.value ->> 'amount')::numeric, 2), 'note', btrim(s.value ->> 'note'))
        END ORDER BY s.ordinality)
      FROM jsonb_array_elements(_terms -> 'schedule') WITH ORDINALITY AS s(value, ordinality)
    ), '[]'::jsonb)
  );
  IF _type = 'equity' THEN
    _out := _out || jsonb_build_object('equity_percent', round((_terms ->> 'equity_percent')::numeric, 2));
  ELSIF _type = 'loan' THEN
    _out := _out || jsonb_build_object(
      'interest_rate', round((_terms ->> 'interest_rate')::numeric, 2),
      'term_months', trunc((_terms ->> 'term_months')::numeric)::integer,
      'repayment', _terms ->> 'repayment');
  ELSE
    _out := _out || jsonb_build_object(
      'arrangement_title', btrim(COALESCE(_terms ->> 'arrangement_title', '')),
      'arrangement_description', btrim(COALESCE(_terms ->> 'arrangement_description', '')));
  END IF;
  RETURN _out;
END; $$;

-- The fingerprint of one version of the agreement: who, what, how much and every term.
CREATE OR REPLACE FUNCTION public.agreement_hash(
  _template text, _proposal_id uuid, _idea_id uuid, _investor uuid, _entrepreneur uuid,
  _type text, _amount numeric, _terms jsonb, _version integer
) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(extensions.digest(jsonb_build_object(
    'template', _template, 'proposal', _proposal_id, 'idea', _idea_id, 'investor', _investor, 'entrepreneur', _entrepreneur,
    'type', _type, 'amount', _amount, 'terms', _terms, 'version', _version)::text, 'sha256'), 'hex')
$$;

-- 6. Draft agreement for an accepted proposal. Called only by respond_to_proposal().
--    The terms start from what was accepted; governing law and (for "other") the description are left empty
--    on purpose, so nobody can confirm without filling them in.
CREATE OR REPLACE FUNCTION public.create_agreement_for_proposal(_proposal_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.proposals%ROWTYPE;
  _type text;
  _terms jsonb;
  _id uuid;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND OR p.status <> 'accepted' THEN RAISE EXCEPTION 'Only an accepted proposal can have an agreement'; END IF;

  SELECT id INTO _id FROM public.agreements WHERE proposal_id = p.id;
  IF FOUND THEN RETURN _id; END IF;

  _type := CASE WHEN p.equity IS NOT NULL THEN 'equity' ELSE 'other' END;
  _terms := jsonb_build_object(
    'governing_law', '',
    'founder_responsibilities', 'Use the funds only for the purposes described in the pitch, keep the investor informed with regular progress updates, and keep accurate financial records.',
    'investor_responsibilities', 'Provide the funds on the agreed schedule and keep all confidential information shared under the confidentiality terms private.',
    'additional_terms', '',
    'schedule', jsonb_build_array(jsonb_build_object('due_date', to_char(current_date + 14, 'YYYY-MM-DD'), 'amount', p.amount, 'note', 'Full amount'))
  ) || CASE WHEN _type = 'equity'
      THEN jsonb_build_object('equity_percent', p.equity)
      ELSE jsonb_build_object('arrangement_title', 'Investment arrangement', 'arrangement_description', '') END;
  PERFORM public.validate_agreement_terms(_type, p.amount, _terms, false);
  _terms := public.normalize_agreement_terms(_type, _terms);

  _id := gen_random_uuid();
  INSERT INTO public.agreements (id, proposal_id, idea_id, investor_id, entrepreneur_id, agreement_type, amount, terms, version, terms_hash)
  VALUES (_id, p.id, p.idea_id, p.investor_id, p.entrepreneur_id, _type, p.amount, _terms, 1,
          public.agreement_hash('agreement-template-v1', p.id, p.idea_id, p.investor_id, p.entrepreneur_id, _type, p.amount, _terms, 1));
  INSERT INTO public.agreement_events (agreement_id, actor_id, event, version, details)
  VALUES (_id, auth.uid(), 'created', 1, jsonb_build_object('amount', p.amount, 'type', _type));
  RETURN _id;
END; $$;

-- 7. Either party edits the terms while the agreement is a draft. A real change is a new version, which means
--    earlier confirmations no longer apply and the other party is told.
CREATE OR REPLACE FUNCTION public.save_agreement_terms(_agreement_id uuid, _type text, _terms jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  a public.agreements%ROWTYPE;
  _clean jsonb;
  _changed text[];
  _other uuid;
  _actor text;
  _idea text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO a FROM public.agreements WHERE id = _agreement_id AND (investor_id = _uid OR entrepreneur_id = _uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agreement not found'; END IF;
  IF a.status <> 'draft' THEN RAISE EXCEPTION 'This agreement can no longer be changed'; END IF;

  PERFORM public.validate_agreement_terms(_type, a.amount, _terms, false);
  _clean := public.normalize_agreement_terms(_type, _terms);
  IF _type = a.agreement_type AND _clean = a.terms THEN RETURN a.version; END IF;

  SELECT array_agg(k ORDER BY k) INTO _changed FROM (
    SELECT x.key AS k FROM (SELECT jsonb_object_keys(_clean) AS key UNION SELECT jsonb_object_keys(a.terms)) x
    WHERE (_clean -> x.key) IS DISTINCT FROM (a.terms -> x.key)
    UNION ALL SELECT 'agreement_type' WHERE _type <> a.agreement_type
  ) t;

  UPDATE public.agreements
     SET agreement_type = _type, terms = _clean, version = a.version + 1,
         terms_hash = public.agreement_hash(a.template_version, a.proposal_id, a.idea_id, a.investor_id, a.entrepreneur_id, _type, a.amount, _clean, a.version + 1)
   WHERE id = a.id;
  INSERT INTO public.agreement_events (agreement_id, actor_id, event, version, details)
  VALUES (a.id, _uid, 'terms_updated', a.version + 1, jsonb_build_object('changed', to_jsonb(COALESCE(_changed, ARRAY[]::text[]))));

  _other := CASE WHEN a.investor_id = _uid THEN a.entrepreneur_id ELSE a.investor_id END;
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'The other party') INTO _actor FROM public.profiles WHERE id = _uid;
  SELECT title INTO _idea FROM public.ideas WHERE id = a.idea_id;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_other, 'Agreement terms changed', COALESCE(_actor, 'The other party') || ' changed the agreement for ' || COALESCE(_idea, 'your deal') || '. Review version ' || (a.version + 1) || ' before confirming.',
          '/app/agreements/' || a.id, 'agreement');
  RETURN a.version + 1;
END; $$;

-- 8. A party confirms the version they have read. When both have confirmed the same version it is executed
--    and the money starts to count as raised.
CREATE OR REPLACE FUNCTION public.confirm_agreement(_agreement_id uuid, _version integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  a public.agreements%ROWTYPE;
  _party text;
  _name text;
  _email text;
  _headers json;
  _ip text;
  _ua text;
  _idea text;
  _other uuid;
  _inv public.agreement_confirmations%ROWTYPE;
  _ent public.agreement_confirmations%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO a FROM public.agreements WHERE id = _agreement_id AND (investor_id = _uid OR entrepreneur_id = _uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agreement not found'; END IF;
  IF a.status <> 'draft' THEN RAISE EXCEPTION 'This agreement is not open for confirmation'; END IF;
  IF _version IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'The terms changed. Please review the latest version before confirming'; END IF;
  PERFORM public.validate_agreement_terms(a.agreement_type, a.amount, a.terms, true);

  _party := CASE WHEN a.investor_id = _uid THEN 'investor' ELSE 'entrepreneur' END;
  IF EXISTS (SELECT 1 FROM public.agreement_confirmations c WHERE c.agreement_id = a.id AND c.version = a.version AND c.user_id = _uid) THEN
    RAISE EXCEPTION 'You have already confirmed this version';
  END IF;

  SELECT NULLIF(btrim(full_name), '') INTO _name FROM public.profiles WHERE id = _uid;
  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  BEGIN
    _headers := NULLIF(current_setting('request.headers', true), '')::json;
    _ip := NULLIF(btrim(split_part(COALESCE(_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
    _ua := NULLIF(left(COALESCE(_headers ->> 'user-agent', ''), 300), '');
  EXCEPTION WHEN OTHERS THEN
    _ip := NULL; _ua := NULL;
  END;

  INSERT INTO public.agreement_confirmations (agreement_id, user_id, party, version, terms_hash, name, email, ip_address, user_agent)
  VALUES (a.id, _uid, _party, a.version, a.terms_hash, _name, _email, _ip, _ua);
  INSERT INTO public.agreement_events (agreement_id, actor_id, event, version, details)
  VALUES (a.id, _uid, 'confirmed', a.version, jsonb_build_object('party', _party));

  SELECT title INTO _idea FROM public.ideas WHERE id = a.idea_id;
  _idea := COALESCE(_idea, 'your deal');

  SELECT * INTO _inv FROM public.agreement_confirmations WHERE agreement_id = a.id AND version = a.version AND party = 'investor';
  SELECT * INTO _ent FROM public.agreement_confirmations WHERE agreement_id = a.id AND version = a.version AND party = 'entrepreneur';

  IF _inv.id IS NOT NULL AND _ent.id IS NOT NULL THEN
    UPDATE public.agreements
       SET status = 'executed', executed_at = now(),
           parties = jsonb_build_object(
             'investor', jsonb_build_object('id', a.investor_id, 'name', _inv.name, 'email', _inv.email),
             'entrepreneur', jsonb_build_object('id', a.entrepreneur_id, 'name', _ent.name, 'email', _ent.email))
     WHERE id = a.id;
    UPDATE public.ideas SET funding_raised = funding_raised + a.amount WHERE id = a.idea_id;
    INSERT INTO public.agreement_events (agreement_id, actor_id, event, version, details)
    VALUES (a.id, _uid, 'executed', a.version, jsonb_build_object('amount', a.amount));
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES
      (a.investor_id, 'Investment agreement signed', 'Both of you confirmed the agreement for ' || _idea || '. $' || to_char(round(a.amount), 'FM999,999,999,990') || ' now counts as raised.', '/app/agreements/' || a.id, 'agreement'),
      (a.entrepreneur_id, 'Investment agreement signed', 'Both of you confirmed the agreement for ' || _idea || '. $' || to_char(round(a.amount), 'FM999,999,999,990') || ' now counts as raised.', '/app/agreements/' || a.id, 'agreement');
    RETURN 'executed';
  END IF;

  _other := CASE WHEN a.investor_id = _uid THEN a.entrepreneur_id ELSE a.investor_id END;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_other, 'Agreement waiting for you', COALESCE(_name, 'The other party') || ' confirmed the agreement for ' || _idea || '. Your confirmation is needed.',
          '/app/agreements/' || a.id, 'agreement');
  RETURN 'draft';
END; $$;

-- 9. Either party can walk away while it is still a draft. The proposal is then marked withdrawn, so the
--    money never counts and a new proposal has to be made.
CREATE OR REPLACE FUNCTION public.cancel_agreement(_agreement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  a public.agreements%ROWTYPE;
  _actor text;
  _idea text;
  _other uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO a FROM public.agreements WHERE id = _agreement_id AND (investor_id = _uid OR entrepreneur_id = _uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agreement not found'; END IF;
  IF a.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft agreement can be cancelled'; END IF;

  UPDATE public.agreements SET status = 'cancelled', cancelled_at = now() WHERE id = a.id;
  UPDATE public.proposals SET status = 'withdrawn', responded_at = now() WHERE id = a.proposal_id;
  INSERT INTO public.agreement_events (agreement_id, actor_id, event, version) VALUES (a.id, _uid, 'cancelled', a.version);

  _other := CASE WHEN a.investor_id = _uid THEN a.entrepreneur_id ELSE a.investor_id END;
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'The other party') INTO _actor FROM public.profiles WHERE id = _uid;
  SELECT title INTO _idea FROM public.ideas WHERE id = a.idea_id;
  INSERT INTO public.notifications (user_id, title, body, link, type)
  VALUES (_other, 'Agreement cancelled', COALESCE(_actor, 'The other party') || ' cancelled the agreement for ' || COALESCE(_idea, 'your deal') || '.', '/app/agreements/' || a.id, 'agreement');
END; $$;

-- 10. Accepting a proposal now creates the agreement and no longer counts the money by itself.
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
  _agreement uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

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
    _agreement := public.create_agreement_for_proposal(p.id);
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.investor_id, 'Proposal accepted', _actor || ' accepted your proposal for ' || _idea || '. Review and confirm the investment agreement.', '/app/agreements/' || _agreement, 'agreement');

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
    _agreement := public.create_agreement_for_proposal(p.id);
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.entrepreneur_id, 'Counter-offer accepted', _actor || ' accepted your counter-offer on ' || _idea || '. Review and confirm the investment agreement.', '/app/agreements/' || _agreement, 'agreement');

  ELSIF _action = 'withdraw' THEN
    UPDATE public.proposals SET status = 'withdrawn', responded_at = now() WHERE id = p.id;
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (p.entrepreneur_id, 'Proposal withdrawn', _actor || ' withdrew their proposal for ' || _idea, '/app/proposals', 'proposal');
  END IF;
END; $$;

-- 11. Permissions: internal helpers are not callable from the API; the three actions are for signed-in users.
REVOKE EXECUTE ON FUNCTION public.validate_agreement_terms(text, numeric, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_agreement_terms(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.agreement_hash(text, uuid, uuid, uuid, uuid, text, numeric, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_agreement_for_proposal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_agreement_terms(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_agreement(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_agreement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_agreement_terms(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_agreement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_agreement(uuid) TO authenticated;

-- 12. Live updates for the Agreements pages.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agreements;
  END IF;
END $$;
