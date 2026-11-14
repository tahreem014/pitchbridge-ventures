import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { applyPendingSignupRole } from "@/lib/signupRole";
import { AppRole, isAppRole, readStoredRole, resolveActiveRole, storeActiveRole } from "@/lib/roles";

export type { AppRole };

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** The role the app is acting as right now (the active mode). */
  role: AppRole | null;
  /** Every role this account holds - one person can be both founder and investor. */
  roles: AppRole[];
  loading: boolean;
  /** Switches mode. If the account does not hold the role yet, it is enabled first. */
  switchRole: (target: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer Supabase calls to avoid deadlock
        setTimeout(() => fetchRoles(newSession.user.id), 0);
      } else {
        setRoles([]);
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) fetchRoles(existing.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRoles = async (userId: string) => {
    await applyPendingSignupRole();
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) return;
    const held = data.map(r => r.role).filter(isAppRole);
    setRoles(held);
    // Stay in the current mode if it is still held, otherwise use the saved or default one.
    setRole(prev => (prev && held.includes(prev) ? prev : resolveActiveRole(held, readStoredRole(userId))));
  };

  const switchRole = async (target: AppRole) => {
    if (!user) return;
    if (!roles.includes(target)) {
      const { error } = await supabase.rpc("add_my_role", { _role: target });
      if (error) throw error;
      setRoles(prev => (prev.includes(target) ? prev : [...prev, target]));
    }
    storeActiveRole(user.id, target);
    setRole(target);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setSession(null); setRoles([]); setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roles, loading, switchRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
