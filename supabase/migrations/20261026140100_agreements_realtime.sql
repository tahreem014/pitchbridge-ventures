-- A confirmation or an edit does not change the agreement row until the agreement is signed, so the pages also
-- listen to confirmations and the timeline. Row-level security still decides who receives what.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreement_confirmations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agreement_confirmations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'agreement_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agreement_events;
  END IF;
END $$;
