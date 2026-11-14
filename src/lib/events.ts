// Tiny signals so the inbox, the sidebar badge and the notification bell stay in
// sync immediately, without waiting for the realtime push or a poll.
export const MESSAGES_CHANGED = "pitchbridge:messages-changed";
export const NOTIFICATIONS_CHANGED = "pitchbridge:notifications-changed";
export const PROFILE_CHANGED = "pitchbridge:profile-changed";

export const emit = (name: string) => window.dispatchEvent(new Event(name));
