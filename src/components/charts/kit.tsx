import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Cards shared by the Portfolio (investor) and Analytics (founder) pages.

export const KpiCard = ({ icon: Icon, label, value, hint, loading, tone }: {
  icon: LucideIcon; label: string; value: string; hint?: string; loading: boolean; tone: string;
}) => (
  <Card className="glass-card p-5 hover-lift">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <div className="font-display text-xl sm:text-2xl font-bold mt-1 break-words">{value}</div>}
        {hint && !loading && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
      {/* hidden on phones: the number matters more than the icon in a narrow card */}
      <div className={cn("hidden sm:flex h-10 w-10 flex-shrink-0 rounded-xl items-center justify-center", tone)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </Card>
);

export const ChartCard = ({ title, subtitle, loading, className, children }: {
  title: string; subtitle: string; loading: boolean; className?: string; children: React.ReactNode;
}) => (
  <Card className={cn("glass-card p-6", className)}>
    <h3 className="font-display font-semibold text-lg">{title}</h3>
    <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
    {loading ? <Skeleton className="h-[240px] w-full rounded-xl" /> : children}
  </Card>
);
