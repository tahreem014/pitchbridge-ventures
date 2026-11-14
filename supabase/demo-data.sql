-- PitchBridge demo data (NOT a migration - run manually, e.g. in the Supabase SQL editor).
--
-- Creates 6 fake users (4 founders, 2 investors; @demo.pitchbridge.test, banned from signing in;
-- the one login that was enabled afterwards is documented in demo-accounts.md),
-- 10 public ideas plus a draft and a private one (to check row-level security hides them),
-- and, for the first real user in the project: 2 sample ideas, favorites, proposals,
-- messages and notifications. Safe to re-run.
--
-- Remove everything again:
--   DELETE FROM public.ideas WHERE id::text LIKE 'a0000000-%';
--   DELETE FROM public.notifications WHERE id::text LIKE 'e0000000-%';
--   DELETE FROM auth.users WHERE email LIKE '%@demo.pitchbridge.test';

-- 1. Demo users. The handle_new_user trigger creates their profile + role.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, banned_until
)
SELECT
  '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', d.full_name, 'role', d.user_role, 'avatar_url', d.avatar_url),
  now(), now(), '', '', '', '', '2999-12-31'
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'amara.okafor@demo.pitchbridge.test',   'Amara Okafor',    'entrepreneur', 'https://i.pravatar.cc/150?img=47'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'daniel.reyes@demo.pitchbridge.test',   'Daniel Reyes',    'entrepreneur', 'https://i.pravatar.cc/150?img=12'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'sana.malik@demo.pitchbridge.test',     'Sana Malik',      'entrepreneur', 'https://i.pravatar.cc/150?img=32'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'lukas.brandt@demo.pitchbridge.test',   'Lukas Brandt',    'entrepreneur', 'https://i.pravatar.cc/150?img=15'),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'priya.nair@demo.pitchbridge.test',     'Priya Nair',      'investor',     'https://i.pravatar.cc/150?img=45'),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'marcus.holloway@demo.pitchbridge.test','Marcus Holloway', 'investor',     'https://i.pravatar.cc/150?img=33')
) AS d(id, email, full_name, user_role, avatar_url)
ON CONFLICT (id) DO NOTHING;

-- 2. Fill in the rest of their profiles
UPDATE public.profiles p SET
  headline = d.headline, bio = d.bio, company = d.company, website = d.website, location = d.location
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'Founder & CEO at Lumora Health', 'Former nurse turned product builder, creating tools for under-resourced clinics.', 'Lumora Health', 'https://lumora.example', 'Lagos, Nigeria'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'Serial founder in fintech and consumer', 'Three startups, one exit. Obsessed with making money admin disappear.', 'LedgerLeaf', 'https://ledgerleaf.example', 'Austin, USA'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'Climate engineer and marketplace builder', 'Electrical engineer building software for renewable energy and local commerce.', 'GridSage', 'https://gridsage.example', 'Lahore, Pakistan'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'Ex-big-tech engineer building SaaS and deep tech', 'Ten years of infrastructure work, now building tools for revenue teams.', 'StackPulse', 'https://stackpulse.example', 'Berlin, Germany'),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'Partner at Horizon Angels', 'Early-stage investor in health, climate and fintech. Cheque size $25K-$150K.', 'Horizon Angels', 'https://horizonangels.example', 'Singapore'),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'Angel investor and former operator', 'Invests in SaaS and marketplaces. Happy to open doors for founders I back.', 'Holloway Ventures', 'https://holloway.example', 'London, UK')
) AS d(id, headline, bio, company, website, location)
WHERE p.id = d.id;

-- 3. Ideas. 'a0000000-...-01' .. '-11' belong to the demo founders.
INSERT INTO public.ideas (
  id, user_id, title, tagline, description, category, stage,
  funding_target, funding_raised, equity_offered, cover_image_url, video_url,
  status, visibility, views_count, created_at
) VALUES
('a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Lumora Health',
 'AI triage assistant that helps rural clinics prioritise patients in minutes.',
 'Rural clinics often run with one nurse and no triage protocol. Lumora Health is a lightweight mobile app that guides front-line staff through a structured symptom check and flags the patients who need a doctor first.

We have piloted with 6 clinics and cut average waiting time for urgent cases by 38%. Funds will go to clinical validation, an offline mode and onboarding 40 more clinics.',
 'HealthTech', 'mvp', 250000, 90000, 8.00, 'https://picsum.photos/seed/lumora/1200/675', 'https://example.com/lumora-pitch',
 'published', 'public', 1842, now() - interval '2 days'),

('a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'LedgerLeaf',
 'Bookkeeping on autopilot for freelancers and one-person studios.',
 'LedgerLeaf connects to your bank, categorises every transaction, chases unpaid invoices and prepares your tax summary each quarter. No spreadsheets, no accountant for the basics.

2,300 paying freelancers, $38K MRR and 4% monthly churn. The round extends us into the UK and Canada.',
 'FinTech', 'early_revenue', 500000, 310000, 10.00, 'https://picsum.photos/seed/ledgerleaf/1200/675', NULL,
 'published', 'public', 3120, now() - interval '4 days'),

('a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'GridSage',
 'Predictive maintenance that keeps solar farms producing.',
 'Underperforming panels and failing inverters quietly cost solar operators up to 8% of yearly output. GridSage reads data operators already collect and predicts faults weeks before they cause downtime.

Working prototype validated against 14 months of data from a 20 MW farm. Seeking funding for a three-site paid pilot.',
 'ClimateTech', 'prototype', 400000, 60000, 12.00, 'https://picsum.photos/seed/gridsage/1200/675', NULL,
 'published', 'public', 960, now() - interval '6 days'),

('a0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'StackPulse',
 'Product analytics built for B2B SaaS revenue teams.',
 'Most analytics tools tell you what users clicked. StackPulse tells you which accounts are about to expand, stall or churn, and pushes that straight into the CRM.

$1.9M ARR, 140 customers and net revenue retention of 118%. Raising a growth round to open a US sales team.',
 'SaaS', 'scaling', 2000000, 1450000, 5.00, 'https://picsum.photos/seed/stackpulse/1200/675', 'https://example.com/stackpulse-demo',
 'published', 'public', 5410, now() - interval '9 days'),

('a0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003', 'CraftCircle',
 'A marketplace for verified local artisans and their customers.',
 'Handmade goods are hard to trust and harder to find. CraftCircle verifies every maker in person, handles shipping and gives buyers a story behind each piece.

Prototype live with 45 makers in two cities. Funding covers verification operations and a mobile app.',
 'Marketplace', 'prototype', 150000, 22000, 15.00, 'https://picsum.photos/seed/craftcircle/1200/675', NULL,
 'published', 'public', 640, now() - interval '11 days'),

('a0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002', 'Verdant Bites',
 'Weekly meal boxes made from rescued, imperfect produce.',
 'Farms discard up to a third of their crop for looking odd. Verdant Bites buys that produce at a discount, turns it into ready-to-cook meal boxes and delivers weekly.

Still at idea stage with a signed supply letter from two farms and 300 people on the waiting list.',
 'Consumer', 'idea', 80000, 5000, 20.00, 'https://picsum.photos/seed/verdant/1200/675', NULL,
 'published', 'public', 410, now() - interval '13 days'),

('a0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000004', 'QuantumLoom',
 'Error-mitigation software for early-generation quantum hardware.',
 'Todays quantum chips are noisy. QuantumLoom is a compiler layer that reduces error rates without waiting for fault-tolerant hardware, so useful algorithms run sooner.

Seeking seed funding to hire two researchers and build a first benchmark against three hardware vendors.',
 'DeepTech', 'idea', 1200000, 0, 7.00, 'https://picsum.photos/seed/quantumloom/1200/675', NULL,
 'published', 'public', 275, now() - interval '15 days'),

('a0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000001', 'ChainNotary',
 'On-chain document notarisation for small businesses.',
 'Notarising contracts is slow and expensive. ChainNotary timestamps and signs documents on a public chain, giving small businesses a tamper-proof record in under a minute.

MVP live with 180 businesses and 9,000 documents notarised. Next: legal recognition in three jurisdictions.',
 'Web3', 'mvp', 300000, 120000, 9.00, 'https://picsum.photos/seed/chainnotary/1200/675', NULL,
 'published', 'public', 1130, now() - interval '18 days'),

('a0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000002', 'PromptPilot',
 'Version control and automated testing for LLM prompts.',
 'Teams shipping AI features edit prompts in production and hope nothing breaks. PromptPilot versions every prompt, runs regression tests against saved examples and flags quality drops before release.

MVP used by 35 teams. Raising to build team workspaces and CI integrations.',
 'AI / ML', 'mvp', 600000, 180000, 8.00, 'https://picsum.photos/seed/promptpilot/1200/675', NULL,
 'published', 'public', 2260, now() - interval '1 day'),

-- Hidden on purpose: a draft and a private idea must NOT show up for other users.
('a0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000002', 'Untitled FinTech Draft',
 'Work in progress.', 'Draft notes only.',
 'FinTech', 'idea', 100000, 0, NULL, NULL, NULL,
 'draft', 'public', 0, now() - interval '1 day'),

('a0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000004', 'StealthCo',
 'Private idea, visible only to its owner.', 'Not for public listing.',
 'DeepTech', 'prototype', 900000, 0, 6.00, NULL, NULL,
 'published', 'private', 3, now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- 4. Activity between demo users
INSERT INTO public.favorites (id, user_id, idea_id) VALUES
('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001'),
('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004'),
('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000009'),
('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000002'),
('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003'),
('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000008')
ON CONFLICT DO NOTHING;

INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, created_at) VALUES
('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000001',
 75000, 6.00, 'Impressive pilot results. We would like to lead this round.', 'accepted', now() - interval '5 days'),
('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000002',
 100000, 7.00, 'Interested, but I would want a board observer seat.', 'rejected', now() - interval '7 days'),
('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000001',
 50000, 5.00, 'Keen to learn more about the legal roadmap.', 'pending', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.reports (id, reporter_id, target_type, target_id, reason, details, status) VALUES
('90000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000006', 'idea', 'a0000000-0000-4000-8000-000000000006',
 'Misleading claims', 'Waiting-list numbers look unverified.', 'open')
ON CONFLICT (id) DO NOTHING;

-- 5. Data for the first real (non-demo) user, so their pages are populated too
DO $do$
DECLARE me uuid;
BEGIN
  SELECT id INTO me FROM auth.users
  WHERE email NOT LIKE '%@demo.pitchbridge.test' ORDER BY created_at LIMIT 1;

  IF me IS NULL THEN
    RAISE NOTICE 'No real user yet - skipping personal demo data. Sign in once, then re-run this script.';
    RETURN;
  END IF;

  INSERT INTO public.ideas (
    id, user_id, title, tagline, description, category, stage,
    funding_target, funding_raised, equity_offered, cover_image_url,
    status, visibility, views_count, created_at
  ) VALUES
  ('a0000000-0000-4000-8000-000000000012', me, 'SkillSwap (sample)',
   'Peer-to-peer skill exchange for university students.',
   'SkillSwap lets students trade an hour of what they know for an hour of what they want to learn: coding for guitar, statistics for Spanish. No money changes hands.

This is a sample idea created by the demo-data script so you can try editing, saving and sending proposals.',
   'Consumer', 'prototype', 60000, 8000, 10.00, 'https://picsum.photos/seed/skillswap/1200/675',
   'published', 'public', 0, now() - interval '12 hours'),
  ('a0000000-0000-4000-8000-000000000013', me, 'My Draft Pitch (sample)',
   'A draft only you can see.', 'Use this one to test editing and deleting.',
   'SaaS', 'idea', 100000, 0, NULL, NULL,
   'draft', 'private', 0, now() - interval '2 hours')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.favorites (id, user_id, idea_id) VALUES
  ('f0000000-0000-4000-8000-000000000007', me, 'a0000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000008', me, 'a0000000-0000-4000-8000-000000000003'),
  ('f0000000-0000-4000-8000-000000000009', me, 'a0000000-0000-4000-8000-000000000008'),
  ('f0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000012'),
  ('f0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000012')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, created_at) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', me,
   40000, 8.00, 'Love the concept. Can we talk about terms this week?', 'pending', now() - interval '6 hours'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000006', me,
   25000, 5.00, 'Interested at a lower valuation.', 'countered', now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.messages (id, sender_id, recipient_id, content, read_at, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', me,
   'Hi! I came across SkillSwap on Discover and loved the idea.', NULL, now() - interval '5 hours'),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', me,
   'Do you have a deck I can look at before Thursday?', NULL, now() - interval '4 hours'),
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000006', me,
   'Congratulations on the traction so far. What does your runway look like?', NULL, now() - interval '20 hours'),
  ('c0000000-0000-4000-8000-000000000004', me, 'd0000000-0000-4000-8000-000000000005',
   'Thanks Priya! I will send the deck this evening.', now() - interval '3 hours', now() - interval '3 hours')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notifications (id, user_id, title, body, link, type, read_at, created_at) VALUES
  ('e0000000-0000-4000-8000-000000000001', me, 'New proposal on SkillSwap',
   'Priya Nair offered $40,000 for 8% equity.', '/app/ideas/a0000000-0000-4000-8000-000000000012', 'proposal', NULL, now() - interval '6 hours'),
  ('e0000000-0000-4000-8000-000000000002', me, 'New proposal on SkillSwap',
   'Marcus Holloway offered $25,000 for 5% equity.', '/app/ideas/a0000000-0000-4000-8000-000000000012', 'proposal', now() - interval '20 hours', now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000003', me, 'Your idea was saved',
   'Two investors saved SkillSwap to their collections.', '/app/ideas/a0000000-0000-4000-8000-000000000012', 'favorite', NULL, now() - interval '8 hours'),
  ('e0000000-0000-4000-8000-000000000004', me, 'Welcome to PitchBridge',
   'Complete your profile to get noticed by investors.', '/app/profile', 'system', now() - interval '2 days', now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;
END
$do$;

-- 6. More investors and a full set of proposals for the Proposals page (added later).
--    Elena, Kwame and Sofia are investors who cannot sign in. The proposals cover every state:
--    pending, countered, accepted, rejected and withdrawn, on both the founder and the investor side.
--    (The "new proposal" notification trigger is switched off while seeding, so history does not
--    arrive as unread notifications, and switched back on at the end.)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, banned_until
)
SELECT
  '00000000-0000-0000-0000-000000000000', d.id, 'authenticated', 'authenticated', d.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', d.full_name, 'role', 'investor', 'avatar_url', d.avatar_url),
  now(), now(), '', '', '', '', '2999-12-31'
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'elena.petrova@demo.pitchbridge.test', 'Elena Petrova', 'https://i.pravatar.cc/150?img=44'),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'kwame.mensah@demo.pitchbridge.test',  'Kwame Mensah',  'https://i.pravatar.cc/150?img=52'),
  ('d0000000-0000-4000-8000-000000000009'::uuid, 'sofia.alvarez@demo.pitchbridge.test', 'Sofia Alvarez',  'https://i.pravatar.cc/150?img=26')
) AS d(id, email, full_name, avatar_url)
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles p SET headline = d.headline, bio = d.bio, company = d.company, website = d.website, location = d.location
FROM (VALUES
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'Angel investor in consumer and edtech', 'Former product lead turned angel. Writes first cheques of $10K-$50K.', 'Petrova Angels', 'https://petrova.example', 'Berlin, Germany'),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'Associate at Savanna Ventures', 'Backs early consumer products across West Africa and beyond.', 'Savanna Ventures', 'https://savanna.example', 'Accra, Ghana'),
  ('d0000000-0000-4000-8000-000000000009'::uuid, 'Principal at Alvarez Family Office', 'Long-horizon capital for founders who care about unit economics.', 'Alvarez Family Office', 'https://alvarez.example', 'Madrid, Spain')
) AS d(id, headline, bio, company, website, location)
WHERE p.id = d.id;

ALTER TABLE public.proposals DISABLE TRIGGER proposals_notify;

UPDATE public.proposals
   SET counter_amount = 30000, counter_equity = 6,
       counter_message = 'Happy to proceed at these terms if you can share your user numbers.',
       responded_at = now() - interval '20 hours'
 WHERE id = 'b0000000-0000-4000-8000-000000000002' AND counter_amount IS NULL;

-- Investor-side demo: Priya's sent proposals in every state
INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, counter_amount, counter_equity, counter_message, responded_at, created_at) VALUES
('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000003',
 40000, 8, 'Strong fit with our climate thesis.', 'countered', 55000, 10, 'We can do $55k if you accept a 10% stake.', now() - interval '2 days', now() - interval '4 days'),
('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000002',
 30000, 6, 'Interested in the MVP traction.', 'rejected', NULL, NULL, NULL, now() - interval '8 days', now() - interval '10 days'),
('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004',
 100000, 3, 'Would like to lead a portion of the growth round.', 'pending', NULL, NULL, NULL, NULL, now() - interval '9 hours')
ON CONFLICT (id) DO NOTHING;

DO $do$
DECLARE me uuid;
BEGIN
  SELECT id INTO me FROM auth.users WHERE email NOT LIKE '%@demo.pitchbridge.test' ORDER BY created_at LIMIT 1;
  IF me IS NULL THEN RAISE NOTICE 'No real user yet - skipping personal proposals.'; RETURN; END IF;

  -- Founder side: more offers on the first real user's SkillSwap idea
  INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, responded_at, created_at) VALUES
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', me,
   35000, 7, 'Love the peer-to-peer angle. We have helped two other student products reach their first 10,000 users.', 'pending', NULL, now() - interval '5 hours'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000008', me,
   50000, 12, 'We back early consumer products in West Africa and would like to talk about a launch there.', 'pending', NULL, now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000009', me,
   15000, 4, 'Interesting idea, but we would want to see paying users first.', 'rejected', now() - interval '5 days', now() - interval '6 days'),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', me,
   10000, 3, 'An earlier, smaller offer.', 'withdrawn', now() - interval '11 days', now() - interval '12 days')
  ON CONFLICT (id) DO NOTHING;

  -- Investor side: proposals the first real user sent to other founders
  INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, counter_amount, counter_equity, counter_message, responded_at, created_at) VALUES
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', me, 'd0000000-0000-4000-8000-000000000001',
   30000, 3, 'Impressive pilot results. Happy to join the round.', 'accepted', NULL, NULL, NULL, now() - interval '3 days', now() - interval '6 days'),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000004', me, 'd0000000-0000-4000-8000-000000000004',
   60000, 2.5, 'Interested in the revenue retention numbers.', 'pending', NULL, NULL, NULL, NULL, now() - interval '2 days'),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000003', me, 'd0000000-0000-4000-8000-000000000003',
   40000, 8, 'Keen to support the three-site pilot.', 'countered', 45000, 9, 'We can accept $45k at 9% to cover the extra site.', now() - interval '1 day', now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000007', me, 'd0000000-0000-4000-8000-000000000004',
   100000, 6, 'Early, but the research direction is compelling.', 'rejected', NULL, NULL, NULL, now() - interval '9 days', now() - interval '11 days'),
  ('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000005', me, 'd0000000-0000-4000-8000-000000000003',
   12000, 10, 'Initial offer for the marketplace.', 'withdrawn', NULL, NULL, NULL, now() - interval '14 days', now() - interval '16 days')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notifications (id, user_id, title, body, link, type, read_at, created_at) VALUES
  ('e0000000-0000-4000-8000-000000000005', me, 'New proposal on SkillSwap', 'Elena Petrova offered $35,000', '/app/proposals', 'proposal', NULL, now() - interval '5 hours'),
  ('e0000000-0000-4000-8000-000000000006', me, 'New proposal on SkillSwap', 'Kwame Mensah offered $50,000', '/app/proposals', 'proposal', NULL, now() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;
END
$do$;

ALTER TABLE public.proposals ENABLE TRIGGER proposals_notify;
-- 7. Protected pitch demo data (added with the idea-protection feature).
--    Detailed pitches for the first real user's SkillSwap idea and four demo ideas, plus access requests
--    in every state on both sides, two signed confidentiality records and the matching activity log.
INSERT INTO public.idea_pitch_details (idea_id, business_model, target_customers, market_research, financial_estimates) VALUES
('a0000000-0000-4000-8000-000000000012',
 'Freemium. Basic skill matching is free. Premium (USD 5 per month) adds priority matching, session scheduling and verified-tutor badges. Universities can license a campus edition for USD 8,000 per year.',
 'Undergraduate and postgraduate students aged 18 to 26 at universities with more than 5,000 students. Early adopters are language-exchange clubs and coding societies. Secondary customers are university career offices.',
 'We surveyed 212 students across 3 universities: 71% said they would trade skills instead of paying for tutoring. About 14 million tertiary students in our first target countries. Closest alternatives are paid tutoring marketplaces and informal Discord groups.',
 'Year 1: 6,000 active users, 4% paying, revenue USD 14,400. Year 2: 40,000 users, 5% paying, 6 campus licences, revenue USD 168,000. Break-even in month 17. Funding is used for engineering (55%), campus launches (30%) and legal and operations (15%).'),
('a0000000-0000-4000-8000-000000000001',
 'Per-clinic subscription of USD 120 per month plus USD 2 per assessed patient above 500 a month. Government health programmes can license the triage engine at country level.',
 'Rural and peri-urban primary care clinics with one to three nurses and no triage protocol. Buyers are clinic owners, NGOs and district health offices.',
 'Pilot in 6 clinics cut waiting time for urgent cases by 38%. An estimated 180,000 primary clinics in our first five markets. Competitors target hospitals, not single-nurse clinics.',
 'Year 1: 120 clinics, revenue USD 190,000. Year 2: 600 clinics, revenue USD 1.1M. Gross margin 78%. Break-even in month 20. Funds go to clinical validation (40%), offline mode (35%) and onboarding (25%).'),
('a0000000-0000-4000-8000-000000000003',
 'Annual software subscription priced at USD 900 per MW monitored, plus a success fee of 5% of recovered output for the first year.',
 'Owners and operators of 5 to 100 MW solar farms, and the maintenance contractors who service them.',
 'Underperforming panels and failing inverters cost operators up to 8% of yearly output. Validated against 14 months of data from a 20 MW farm: faults predicted 3 to 5 weeks early.',
 'Pilot: 3 sites, USD 54,000 in the first year. Year 2: 25 sites, USD 540,000. Break-even in month 22. Funds go to the paid pilot, a data engineer and cloud costs.'),
('a0000000-0000-4000-8000-000000000004',
 'Seat-based SaaS: USD 60 per revenue-team seat per month, with an enterprise tier above 200 seats. 118% net revenue retention.',
 'B2B SaaS companies with 20 to 500 employees that run a CRM and want account-level expansion and churn signals.',
 '140 paying customers and USD 1.9M ARR. Customer interviews show teams replace two or three point tools. Competitors are generic analytics suites without CRM write-back.',
 'Next 18 months: ARR from USD 1.9M to USD 6M. A US sales team of 6 is the main use of funds. Cash-flow positive in month 15.'),
('a0000000-0000-4000-8000-000000000007',
 'Compiler-layer licence sold to quantum hardware vendors and research labs: USD 150,000 per vendor per year, plus a usage fee on large runs.',
 'Quantum hardware vendors, national labs and cloud quantum providers that need useful results from noisy chips.',
 'Error rates on current chips limit circuit depth to a few dozen gates. Early benchmarks on simulated noise models show 3x deeper useful circuits. No dominant commercial tool exists yet.',
 'Pre-revenue. Seed round funds 2 researchers for 18 months and a benchmark against 3 vendors. First licence expected in month 14.')
ON CONFLICT (idea_id) DO NOTHING;

DO $do$
DECLARE
  me uuid;
  _nda public.nda_templates%ROWTYPE;
  _me_name text; _me_email text;
BEGIN
  SELECT id INTO me FROM auth.users WHERE email NOT LIKE '%@demo.pitchbridge.test' ORDER BY created_at LIMIT 1;
  IF me IS NULL THEN RAISE NOTICE 'No real user yet - skipping access requests.'; RETURN; END IF;
  SELECT * INTO _nda FROM public.nda_templates ORDER BY created_at DESC LIMIT 1;
  SELECT full_name INTO _me_name FROM public.profiles WHERE id = me;
  SELECT email INTO _me_email FROM auth.users WHERE id = me;

  -- Founder side: requests for the first real user's SkillSwap idea
  INSERT INTO public.pitch_access_requests (id, idea_id, investor_id, status, message, created_at, decided_at) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', 'approved', 'We would like to review the financial estimates before our investment committee.', now() - interval '3 days', now() - interval '3 days' + interval '4 hours'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'pending',  'Keen to read the market research and the campus licensing model.', now() - interval '6 hours', NULL),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000008', 'pending',  'Could we see how you plan to enter West Africa?', now() - interval '1 day', NULL),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000006', 'rejected', 'Please share the full pitch.', now() - interval '8 days', now() - interval '7 days')
  ON CONFLICT DO NOTHING;

  -- Investor side: requests the first real user sent to other founders
  INSERT INTO public.pitch_access_requests (id, idea_id, investor_id, status, message, created_at, decided_at) VALUES
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', me, 'approved', 'Impressive pilot. I would like to read the financials.', now() - interval '6 days', now() - interval '5 days'),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', me, 'approved', 'Interested in the pilot economics.', now() - interval '1 day', now() - interval '20 hours'),
  ('a1000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000004', me, 'pending',  'Please share the retention data.', now() - interval '2 days', NULL),
  ('a1000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000007', me, 'rejected', 'Interested in the benchmark plan.', now() - interval '10 days', now() - interval '9 days')
  ON CONFLICT DO NOTHING;

  -- Signed confidentiality records
  INSERT INTO public.nda_acceptances (id, request_id, idea_id, investor_id, nda_version, nda_text, nda_hash, investor_name, investor_email, ip_address, user_agent, accepted_at) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005',
   _nda.version, _nda.body, encode(extensions.digest(_nda.body, 'sha256'), 'hex'), 'Priya Nair', 'priya.nair@demo.pitchbridge.test', '203.0.113.24',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', now() - interval '3 days' + interval '6 hours'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', me,
   _nda.version, _nda.body, encode(extensions.digest(_nda.body, 'sha256'), 'hex'), _me_name, _me_email, '203.0.113.77',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130.0 Safari/537.36', now() - interval '5 days' + interval '3 hours')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.pitch_access_log (id, idea_id, actor_id, event, request_id, details, created_at) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', 'access_requested', 'a1000000-0000-4000-8000-000000000001', NULL, now() - interval '3 days'),
  ('a3000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', me, 'access_approved', 'a1000000-0000-4000-8000-000000000001', NULL, now() - interval '3 days' + interval '4 hours'),
  ('a3000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', 'nda_accepted', 'a1000000-0000-4000-8000-000000000001', jsonb_build_object('nda_version', _nda.version), now() - interval '3 days' + interval '6 hours'),
  ('a3000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', 'pitch_viewed', NULL, NULL, now() - interval '3 days' + interval '6 hours 5 minutes'),
  ('a3000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000005', 'pitch_viewed', NULL, NULL, now() - interval '1 day 3 hours'),
  ('a3000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000007', 'access_requested', 'a1000000-0000-4000-8000-000000000002', NULL, now() - interval '6 hours'),
  ('a3000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000008', 'access_requested', 'a1000000-0000-4000-8000-000000000003', NULL, now() - interval '1 day'),
  ('a3000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000006', 'access_requested', 'a1000000-0000-4000-8000-000000000004', NULL, now() - interval '8 days'),
  ('a3000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000012', me, 'access_rejected', 'a1000000-0000-4000-8000-000000000004', NULL, now() - interval '7 days'),
  ('a3000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', me, 'access_requested', 'a1000000-0000-4000-8000-000000000005', NULL, now() - interval '6 days'),
  ('a3000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', me, 'nda_accepted', 'a1000000-0000-4000-8000-000000000005', jsonb_build_object('nda_version', _nda.version), now() - interval '5 days' + interval '3 hours')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (id, user_id, title, body, link, type, read_at, created_at) VALUES
  ('e0000000-0000-4000-8000-000000000007', me, 'Pitch access request', 'Elena Petrova asked to read the detailed pitch of SkillSwap', '/app/access', 'access', NULL, now() - interval '6 hours'),
  ('e0000000-0000-4000-8000-000000000008', me, 'Pitch access request', 'Kwame Mensah asked to read the detailed pitch of SkillSwap', '/app/access', 'access', NULL, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000009', me, 'Pitch access approved', 'Sana Malik approved your request for GridSage. Accept the confidentiality terms to read the pitch.', '/app/ideas/a0000000-0000-4000-8000-000000000003', 'access', NULL, now() - interval '20 hours')
  ON CONFLICT (id) DO NOTHING;
END
$do$;

-- 8. Investment agreements demo data (added with the agreements feature).
--    Signed agreements for the three deals that were already accepted (their money is already part of each
--    idea's funding_raised, so seeding does not add it again), a cancelled one, and two drafts waiting for the
--    first real user: a loan from Daniel (they are the investor) and a revenue share from Sofia (they are the
--    founder). Safe to re-run: nothing happens if the first agreement is already there.
CREATE OR REPLACE FUNCTION pg_temp.seed_agreement(
  _id uuid, _proposal uuid, _type text, _terms jsonb, _version integer, _status text,
  _created timestamptz, _executed timestamptz, _cancelled timestamptz
) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE p public.proposals%ROWTYPE; _clean jsonb; _parties jsonb;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE id = _proposal;
  IF NOT FOUND THEN RETURN; END IF;
  _clean := public.normalize_agreement_terms(_type, _terms);
  IF _status = 'executed' THEN
    _parties := jsonb_build_object(
      'investor', jsonb_build_object('id', p.investor_id, 'name', (SELECT full_name FROM public.profiles WHERE id = p.investor_id), 'email', (SELECT email FROM auth.users WHERE id = p.investor_id)),
      'entrepreneur', jsonb_build_object('id', p.entrepreneur_id, 'name', (SELECT full_name FROM public.profiles WHERE id = p.entrepreneur_id), 'email', (SELECT email FROM auth.users WHERE id = p.entrepreneur_id)));
  END IF;
  INSERT INTO public.agreements (id, proposal_id, idea_id, investor_id, entrepreneur_id, agreement_type, amount, terms, version, terms_hash, status, parties, executed_at, cancelled_at, created_at, updated_at)
  VALUES (_id, p.id, p.idea_id, p.investor_id, p.entrepreneur_id, _type, p.amount, _clean, _version,
          public.agreement_hash('agreement-template-v1', p.id, p.idea_id, p.investor_id, p.entrepreneur_id, _type, p.amount, _clean, _version),
          _status, _parties, _executed, _cancelled, _created, COALESCE(_executed, _cancelled, _created))
  ON CONFLICT (id) DO NOTHING;
END $f$;

CREATE OR REPLACE FUNCTION pg_temp.seed_confirmation(_agreement uuid, _user uuid, _version integer, _at timestamptz, _ip text) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE a public.agreements%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.agreements WHERE id = _agreement;
  INSERT INTO public.agreement_confirmations (agreement_id, user_id, party, version, terms_hash, name, email, ip_address, user_agent, confirmed_at)
  VALUES (a.id, _user, CASE WHEN a.investor_id = _user THEN 'investor' ELSE 'entrepreneur' END, _version, a.terms_hash,
          (SELECT full_name FROM public.profiles WHERE id = _user), (SELECT email FROM auth.users WHERE id = _user), _ip,
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36', _at)
  ON CONFLICT (agreement_id, version, user_id) DO NOTHING;
END $f$;

CREATE OR REPLACE FUNCTION pg_temp.seed_event(_agreement uuid, _actor uuid, _event text, _version integer, _details jsonb, _at timestamptz) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO public.agreement_events (agreement_id, actor_id, event, version, details, created_at) VALUES (_agreement, _actor, _event, _version, _details, _at)
$f$;

-- Two more accepted proposals for the first real user, with no equity (so one becomes a loan, one a revenue share).
-- The "new proposal" notification trigger is off while seeding, so history does not arrive as unread notifications.
ALTER TABLE public.proposals DISABLE TRIGGER proposals_notify;

DO $do$
DECLARE
  me uuid;
  amara  constant uuid := 'd0000000-0000-4000-8000-000000000001';
  daniel constant uuid := 'd0000000-0000-4000-8000-000000000002';
  sana   constant uuid := 'd0000000-0000-4000-8000-000000000003';
  priya  constant uuid := 'd0000000-0000-4000-8000-000000000005';
  elena  constant uuid := 'd0000000-0000-4000-8000-000000000007';
  sofia  constant uuid := 'd0000000-0000-4000-8000-000000000009';
  founder_duty constant text := 'Use the funds only for the Project, report progress to the investor every quarter and keep accurate financial records.';
  investor_duty constant text := 'Pay each instalment on its due date and keep all confidential information shared under the confidentiality terms private.';
  fmt constant text := 'YYYY-MM-DD';
BEGIN
  SELECT id INTO me FROM auth.users WHERE email NOT LIKE '%@demo.pitchbridge.test' ORDER BY created_at LIMIT 1;
  IF me IS NULL THEN RAISE NOTICE 'No real user yet - skipping agreements.'; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.agreements WHERE id = 'f0000000-0000-4000-8000-000000000001') THEN RAISE NOTICE 'Agreements already seeded.'; RETURN; END IF;

  INSERT INTO public.proposals (id, idea_id, investor_id, entrepreneur_id, amount, equity, message, status, created_at, responded_at) VALUES
  ('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000002', me, daniel, 25000, NULL, 'A loan would suit us better than giving up equity.', 'accepted', now() - interval '4 days', now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-000000000012', sofia, me, 5000, NULL, 'Would you consider a revenue share instead of equity?', 'accepted', now() - interval '5 days', now() - interval '4 days')
  ON CONFLICT (id) DO NOTHING;

  -- Signed: Priya invested in Lumora Health (founder Amara)
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'equity',
    jsonb_build_object('governing_law', 'Laws of Pakistan', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty, 'additional_terms', '',
      'equity_percent', 6, 'schedule', jsonb_build_array(
        jsonb_build_object('due_date', to_char(current_date - 36, fmt), 'amount', 40000, 'note', 'On signing'),
        jsonb_build_object('due_date', to_char(current_date - 6, fmt), 'amount', 35000, 'note', 'After the pilot report'))),
    1, 'executed', now() - interval '40 days', now() - interval '38 days', NULL);
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000001', amara, 'created', 1, jsonb_build_object('amount', 75000, 'type', 'equity'), now() - interval '40 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000001', amara, 1, now() - interval '39 days', '203.0.113.31');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000001', amara, 'confirmed', 1, jsonb_build_object('party', 'entrepreneur'), now() - interval '39 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000001', priya, 1, now() - interval '38 days', '203.0.113.24');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000001', priya, 'confirmed', 1, jsonb_build_object('party', 'investor'), now() - interval '38 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000001', priya, 'executed', 1, jsonb_build_object('amount', 75000), now() - interval '38 days');

  -- Signed: the first real user invested in Lumora Health (founder Amara)
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000013', 'equity',
    jsonb_build_object('governing_law', 'Laws of Pakistan', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty, 'additional_terms', '',
      'equity_percent', 3, 'schedule', jsonb_build_array(jsonb_build_object('due_date', to_char(current_date - 20, fmt), 'amount', 30000, 'note', 'Full amount'))),
    1, 'executed', now() - interval '22 days', now() - interval '20 days', NULL);
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000002', amara, 'created', 1, jsonb_build_object('amount', 30000, 'type', 'equity'), now() - interval '22 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000002', amara, 1, now() - interval '21 days', '203.0.113.31');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000002', amara, 'confirmed', 1, jsonb_build_object('party', 'entrepreneur'), now() - interval '21 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000002', me, 1, now() - interval '20 days', '203.0.113.77');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000002', me, 'confirmed', 1, jsonb_build_object('party', 'investor'), now() - interval '20 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000002', me, 'executed', 1, jsonb_build_object('amount', 30000), now() - interval '20 days');

  -- Signed after one change of terms: Elena invested in SkillSwap (the first real user is the founder)
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000006', 'equity',
    jsonb_build_object('governing_law', 'Laws of England and Wales', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty,
      'additional_terms', 'The founder will give the investor one board observer seat for as long as the investor holds shares.',
      'equity_percent', 7, 'schedule', jsonb_build_array(
        jsonb_build_object('due_date', to_char(current_date - 12, fmt), 'amount', 20000, 'note', 'On signing'),
        jsonb_build_object('due_date', to_char(current_date + 18, fmt), 'amount', 15000, 'note', 'After the campus pilot starts'))),
    2, 'executed', now() - interval '16 days', now() - interval '14 days', NULL);
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000003', me, 'created', 1, jsonb_build_object('amount', 35000, 'type', 'equity'), now() - interval '16 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000003', elena, 'terms_updated', 2, jsonb_build_object('changed', jsonb_build_array('additional_terms', 'governing_law', 'schedule')), now() - interval '15 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000003', me, 2, now() - interval '14 days 3 hours', '203.0.113.77');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000003', me, 'confirmed', 2, jsonb_build_object('party', 'entrepreneur'), now() - interval '14 days 3 hours');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000003', elena, 2, now() - interval '14 days', '203.0.113.52');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000003', elena, 'confirmed', 2, jsonb_build_object('party', 'investor'), now() - interval '14 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000003', elena, 'executed', 2, jsonb_build_object('amount', 35000), now() - interval '14 days');

  -- Cancelled: the first real user walked away from a CraftCircle deal (the proposal shows as withdrawn)
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000017', 'equity',
    jsonb_build_object('governing_law', 'Laws of Pakistan', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty, 'additional_terms', '',
      'equity_percent', 10, 'schedule', jsonb_build_array(jsonb_build_object('due_date', to_char(current_date - 8, fmt), 'amount', 12000, 'note', 'Full amount'))),
    1, 'cancelled', now() - interval '12 days', NULL, now() - interval '9 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000004', sana, 'created', 1, jsonb_build_object('amount', 12000, 'type', 'equity'), now() - interval '12 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000004', me, 'cancelled', 1, NULL, now() - interval '9 days');

  -- Draft: a loan from the first real user to Daniel's LedgerLeaf. Daniel has confirmed version 2; it is the first real user's turn.
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000018', 'loan',
    jsonb_build_object('governing_law', 'Laws of Pakistan', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty,
      'additional_terms', 'The founder may repay the loan early without a penalty.',
      'interest_rate', 8, 'term_months', 24, 'repayment', 'monthly', 'schedule', jsonb_build_array(
        jsonb_build_object('due_date', to_char(current_date + 7, fmt), 'amount', 15000, 'note', 'First tranche'),
        jsonb_build_object('due_date', to_char(current_date + 45, fmt), 'amount', 10000, 'note', 'Second tranche'))),
    2, 'draft', now() - interval '3 days', NULL, NULL);
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000005', daniel, 'created', 1, jsonb_build_object('amount', 25000, 'type', 'equity'), now() - interval '3 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000005', daniel, 'terms_updated', 2, jsonb_build_object('changed', jsonb_build_array('agreement_type', 'governing_law', 'interest_rate', 'repayment', 'term_months')), now() - interval '2 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000005', daniel, 2, now() - interval '1 day', '203.0.113.40');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000005', daniel, 'confirmed', 2, jsonb_build_object('party', 'entrepreneur'), now() - interval '1 day');

  -- Draft: a revenue share Sofia proposed for SkillSwap. Sofia has confirmed version 2; it is the first real user's turn as founder.
  PERFORM pg_temp.seed_agreement('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000019', 'other',
    jsonb_build_object('governing_law', 'Laws of Pakistan', 'founder_responsibilities', founder_duty, 'investor_responsibilities', investor_duty, 'additional_terms', '',
      'arrangement_title', 'Revenue share', 'arrangement_description', 'The investor receives 5% of SkillSwap''s monthly revenue for 24 months, paid on the 5th of each month.',
      'schedule', jsonb_build_array(jsonb_build_object('due_date', to_char(current_date + 10, fmt), 'amount', 5000, 'note', 'Full amount'))),
    2, 'draft', now() - interval '4 days', NULL, NULL);
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000006', me, 'created', 1, jsonb_build_object('amount', 5000, 'type', 'other'), now() - interval '4 days');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000006', sofia, 'terms_updated', 2, jsonb_build_object('changed', jsonb_build_array('arrangement_description', 'arrangement_title', 'governing_law')), now() - interval '3 days');
  PERFORM pg_temp.seed_confirmation('f0000000-0000-4000-8000-000000000006', sofia, 2, now() - interval '2 days', '203.0.113.61');
  PERFORM pg_temp.seed_event('f0000000-0000-4000-8000-000000000006', sofia, 'confirmed', 2, jsonb_build_object('party', 'investor'), now() - interval '2 days');

  INSERT INTO public.notifications (id, user_id, title, body, link, type, read_at, created_at) VALUES
  ('e0000000-0000-4000-8000-000000000010', me, 'Agreement waiting for you', 'Daniel Reyes confirmed the agreement for LedgerLeaf. Your confirmation is needed.', '/app/agreements/f0000000-0000-4000-8000-000000000005', 'agreement', NULL, now() - interval '1 day'),
  ('e0000000-0000-4000-8000-000000000011', me, 'Agreement waiting for you', 'Sofia Alvarez confirmed the agreement for SkillSwap. Your confirmation is needed.', '/app/agreements/f0000000-0000-4000-8000-000000000006', 'agreement', NULL, now() - interval '2 days')
  ON CONFLICT (id) DO NOTHING;
END
$do$;

ALTER TABLE public.proposals ENABLE TRIGGER proposals_notify;
