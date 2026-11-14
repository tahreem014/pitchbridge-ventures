import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PortfolioView } from "@/components/portfolio/PortfolioView";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AgreementStatus, PortfolioProposal, computePortfolio } from "@/lib/portfolio";

const Portfolio = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [proposals, setProposals] = useState<PortfolioProposal[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const [mine, saved] = await Promise.all([
      supabase.from("proposals")
        .select("id, amount, equity, status, created_at, updated_at, ideas(id, title, category, stage), agreements(status, executed_at)")
        .eq("investor_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    if (mine.error) { setError(mine.error.message); setLoading(false); return; }
    setProposals(mine.data.map(({ ideas, agreements, ...row }) => {
      const agreement = Array.isArray(agreements) ? agreements[0] : agreements;
      return {
        ...row,
        amount: Number(row.amount),
        equity: row.equity == null ? null : Number(row.equity),
        idea: (Array.isArray(ideas) ? ideas[0] : ideas) ?? null,
        agreementStatus: (agreement?.status as AgreementStatus | undefined) ?? null,
        committedAt: agreement?.executed_at ?? null,
      };
    }));
    setSavedCount(saved.count ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => computePortfolio(proposals), [proposals]);

  return (
    <AppShell title="Portfolio">
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Your investment portfolio</h2>
          <p className="text-sm text-muted-foreground mt-1">Track what you have invested, what is still pending, and where your money is going.</p>
        </div>
        <PortfolioView stats={stats} proposals={proposals} savedCount={savedCount} loading={loading} error={error} onRetry={load} />
      </div>
    </AppShell>
  );
};

export default Portfolio;
