import { supabase } from "@/integrations/supabase/client";

type SignupRole = "entrepreneur" | "investor";

const KEY = "pitchbridge:signup-role";

// Google OAuth can't carry the role picked on the signup form, so it is kept
// across the redirect and applied once the new session exists.
export const rememberSignupRole = (role: SignupRole) => {
  try { sessionStorage.setItem(KEY, role); } catch { /* storage unavailable */ }
};

export const forgetSignupRole = () => {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

export const applyPendingSignupRole = async () => {
  let role: string | null = null;
  try {
    role = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (role !== "entrepreneur" && role !== "investor") return;
  const { error } = await supabase.rpc("set_signup_role", { _role: role });
  if (error) console.error("Could not apply signup role:", error.message);
};
