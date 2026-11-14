-- Messaging between founders and investors.

-- 1. Data integrity: no messages to yourself, and a sane length.
ALTER TABLE public.messages
  ADD CONSTRAINT messages_not_self CHECK (sender_id <> recipient_id),
  ADD CONSTRAINT messages_content_length CHECK (char_length(btrim(content)) BETWEEN 1 AND 2000);

-- 2. Permissions: anonymous visitors get nothing, signed-in users can read and send,
--    and a recipient may ONLY change read_at (not rewrite what someone sent them).
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- 3. Indexes for the inbox and the unread badge.
CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender ON public.messages (recipient_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages (recipient_id) WHERE read_at IS NULL;

-- 4. Inbox: one row per person you have talked to, with the latest message and unread count.
--    SECURITY INVOKER (the default), so row-level security still limits it to your own messages.
CREATE OR REPLACE FUNCTION public.list_conversations()
RETURNS TABLE (
  other_id uuid,
  other_name text,
  other_avatar text,
  other_headline text,
  last_message text,
  last_at timestamptz,
  last_sender_id uuid,
  unread_count bigint
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH mine AS (
    SELECT m.sender_id, m.recipient_id, m.content, m.created_at, m.read_at,
           CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END AS peer_id
    FROM public.messages m
    WHERE m.sender_id = auth.uid() OR m.recipient_id = auth.uid()
  ),
  latest AS (
    SELECT DISTINCT ON (peer_id) peer_id, content, created_at, sender_id
    FROM mine
    ORDER BY peer_id, created_at DESC
  ),
  unread AS (
    SELECT peer_id, count(*) AS n
    FROM mine
    WHERE recipient_id = auth.uid() AND read_at IS NULL
    GROUP BY peer_id
  )
  SELECT l.peer_id, p.full_name, p.avatar_url, p.headline,
         l.content, l.created_at, l.sender_id, COALESCE(u.n, 0)
  FROM latest l
  LEFT JOIN public.profiles p ON p.id = l.peer_id
  LEFT JOIN unread u ON u.peer_id = l.peer_id
  ORDER BY l.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.list_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_conversations() TO authenticated;

-- 5. Notify the recipient. One notification per conversation until it is read,
--    so a long chat does not flood the bell.
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _name text;
  _link text := '/app/messages?with=' || NEW.sender_id::text;
BEGIN
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'Someone') INTO _name
  FROM public.profiles WHERE id = NEW.sender_id;
  _name := COALESCE(_name, 'Someone');

  UPDATE public.notifications
     SET body = left(NEW.content, 140), created_at = now()
   WHERE user_id = NEW.recipient_id AND type = 'message' AND link = _link AND read_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.notifications (user_id, title, body, link, type)
    VALUES (NEW.recipient_id, 'New message from ' || _name, left(NEW.content, 140), _link, 'message');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;

-- 6. Live updates: let the app subscribe to new messages and notifications.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
