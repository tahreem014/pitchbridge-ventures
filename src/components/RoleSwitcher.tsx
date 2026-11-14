import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Loader2, Rocket, ShieldCheck, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppRole, useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODES: Record<AppRole, { label: string; desc: string; icon: typeof Rocket }> = {
  entrepreneur: { label: "Entrepreneur", desc: "Pitch ideas and raise funding", icon: Rocket },
  investor: { label: "Investor", desc: "Discover and back ideas", icon: TrendingUp },
  admin: { label: "Admin", desc: "Moderate the platform", icon: ShieldCheck },
};

export const RoleSwitcher = () => {
  const { role, roles, switchRole } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!role) return null;

  // Entrepreneur and investor can always be enabled; admin only shows up for admins.
  const options: AppRole[] = roles.includes("admin") ? ["entrepreneur", "investor", "admin"] : ["entrepreneur", "investor"];
  const Current = MODES[role];

  const choose = async (target: AppRole) => {
    if (target === role || busy) return;
    const enabling = !roles.includes(target);
    setBusy(true);
    try {
      await switchRole(target);
      toast.success(enabling ? `${MODES[target].label} mode enabled` : `Switched to ${MODES[target].label} mode`);
      navigate("/app");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Could not switch mode");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={busy} aria-label="Switch mode">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Current.icon className="h-4 w-4 text-primary" />}
          <span className="hidden sm:inline">{Current.label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Use PitchBridge as</DropdownMenuLabel>
        {options.map(r => {
          const mode = MODES[r];
          return (
            <DropdownMenuItem key={r} onSelect={() => choose(r)} className="items-start gap-3 py-2.5 cursor-pointer">
              <mode.icon className="h-4 w-4 mt-0.5 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{mode.label}</div>
                <div className="text-xs text-muted-foreground">
                  {roles.includes(r) ? mode.desc : "Not set up yet - choose to enable it"}
                </div>
              </div>
              {r === role && <Check className="h-4 w-4 mt-0.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          One account can be both a founder and an investor. Your ideas, saves and messages stay the same in either mode.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
