export type AppRole = "admin" | "entrepreneur" | "investor";

// One person can hold several roles (e.g. founder and investor). Which one the
// app currently acts as is the "active role"; when nothing was chosen the
// highest-priority role wins - the same order as the get_primary_role() SQL function.
const PRIORITY: AppRole[] = ["admin", "entrepreneur", "investor"];

export const isAppRole = (value: unknown): value is AppRole =>
  typeof value === "string" && (PRIORITY as string[]).includes(value);

export const resolveActiveRole = (roles: AppRole[], preferred?: string | null): AppRole | null => {
  if (isAppRole(preferred) && roles.includes(preferred)) return preferred;
  return PRIORITY.find(r => roles.includes(r)) ?? null;
};

const storageKey = (userId: string) => `pitchbridge:active-role:${userId}`;

export const readStoredRole = (userId: string): string | null => {
  try { return localStorage.getItem(storageKey(userId)); } catch { return null; }
};

export const storeActiveRole = (userId: string, role: AppRole) => {
  try { localStorage.setItem(storageKey(userId), role); } catch { /* storage unavailable */ }
};
