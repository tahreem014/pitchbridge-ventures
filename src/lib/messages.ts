import { format, isToday, isYesterday } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export type ChatMessage = Tables<"messages">;

export const MAX_MESSAGE_LENGTH = 2000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The ?with= query parameter ends up inside a database filter, so only real UUIDs are accepted.
export const isUuid = (value: string | null | undefined): value is string =>
  !!value && UUID_RE.test(value);

export const displayName = (name?: string | null) => name?.trim() || "PitchBridge member";

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";

export const dayLabel = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
};

// Short timestamp for the inbox list.
export const listTime = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "p");
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM d");
};

export const groupByDay = (messages: ChatMessage[]) => {
  const groups: { key: string; label: string; messages: ChatMessage[] }[] = [];
  for (const message of messages) {
    const key = format(new Date(message.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.messages.push(message);
    else groups.push({ key, label: dayLabel(message.created_at), messages: [message] });
  }
  return groups;
};
