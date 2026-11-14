import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AnalyticsInput, computeAnalytics } from "@/lib/analytics";
import { AgreementStatus } from "@/lib/portfolio";

const EMPTY: AnalyticsInput = { ideas: [], proposals: [], stats: [], viewsByDay: [] };

const Analytics = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<AnalyticsInput>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const [ideas, proposals, stats, days] = await Promise.all([
      supabase.from("ideas").select("id, title, status, visibility, category, funding_target, funding_raised").eq("user_id", userId),
      supabase.from("proposals").select("id, idea_id, amount, status, created_at, agreements(status)").eq("entrepreneur_id", userId),
      supabase.rpc("my_idea_stats"),
      supabase.rpc("my_views_by_day", { _days: 30 }),
    ]);
    const failed = ideas.error ?? proposals.error ?? stats.error ?? days.error;
    if (failed) { setError(failed.message); setLoading(false); return; }
    setData({
      ideas: ideas.data,
      proposals: proposals.data.map(({ agreements, ...p }) => {
        const agreement = Array.isArray(agreements) ? agreements[0] : agreements;
        return { ...p, amount: Number(p.amount), agreementStatus: (agreement?.status as AgreementStatus | undefined) ?? null };
      }),
      stats: stats.data.map(s => ({ idea_id: s.idea_id, views: Number(s.views), saves: Number(s.saves) })),
      viewsByDay: days.data.map(d => ({ day: d.day, views: Number(d.views) })),
    });
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computeAnalytics(data), [data]);

  return (
    <AppShell title="Analytics">
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Your pitch analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">See who is looking at your ideas, who is interested, and how your funding is progressing.</p>
        </div>
        <AnalyticsView stats={stats} loading={loading} error={error} onRetry={load} />
      </div>
    </AppShell>
  );
};

export default Analytics;
