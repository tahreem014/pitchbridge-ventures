import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Coins, DollarSign, Heart, Hourglass, Percent, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, KpiCard } from "@/components/charts/kit";
import {
  ACCENT, AUTO_DOMAIN, AXIS, CATEGORY_COLORS, GRID, STATUS_COLORS, TOOLTIP_STYLE, ZERO_LINE_DOMAIN,
} from "@/components/charts/theme";
import {
  PortfolioProposal, PortfolioStats, STATUS_LABELS, formatCompactMoney, formatMoney,
} from "@/lib/portfolio";
export const PortfolioView = ({ stats, proposals, savedCount, loading = false, error = null, onRetry }: {
  stats: PortfolioStats;
  proposals: PortfolioProposal[];
  savedCount: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) => {
  if (error) {
    return (
      <Card className="glass-card p-10 text-center">
        <div className="font-display text-lg font-semibold">We could not load your portfolio</div>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
      </Card>
    );
  }

  const noMoney = stats.byCategory.length === 0;
  const maxMonthly = Math.max(...stats.monthly.map(m => m.cumulative));
  const maxStage = Math.max(...stats.byStage.map(s => s.value));
  const maxStatus = Math.max(...stats.byStatus.map(s => s.count));
  const pieData = noMoney ? [{ name: "No investments yet", value: 1 }] : stats.byCategory;
  const recent = proposals.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Total invested" value={formatMoney(stats.invested)} loading={loading}
          hint={`${stats.dealCount} signed ${stats.dealCount === 1 ? "deal" : "deals"}${stats.awaitingAgreementCount > 0 ? ` · ${formatMoney(stats.awaitingAgreementAmount)} awaiting signature` : ""}`}
          tone="bg-gradient-primary" />
        <KpiCard icon={Hourglass} label="Pending offers" value={formatMoney(stats.pendingAmount)} loading={loading}
          hint={`${stats.pendingCount} awaiting a reply`} tone="bg-gradient-accent" />
        <KpiCard icon={Trophy} label="Deals closed" value={String(stats.dealCount)} loading={loading}
          hint={`of ${stats.proposalCount} proposals sent`} tone="bg-primary" />
        <KpiCard icon={Coins} label="Average ticket" value={formatMoney(stats.avgTicket)} loading={loading}
          hint="per signed deal" tone="bg-accent" />
        <KpiCard icon={Percent} label="Acceptance rate" value={`${stats.acceptanceRate}%`} loading={loading}
          hint="accepted vs. declined" tone="bg-gradient-primary" />
        <KpiCard icon={Heart} label="Saved ideas" value={String(savedCount)} loading={loading}
          hint="on your watchlist" tone="bg-gradient-accent" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Capital committed" subtitle="Total in accepted deals, last 6 months" loading={loading} className="lg:col-span-2">
          <div role="img" aria-label="Capital committed per month">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="pf-committed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={56}
                  tickFormatter={formatCompactMoney} domain={maxMonthly === 0 ? ZERO_LINE_DOMAIN : AUTO_DOMAIN} ticks={maxMonthly === 0 ? [0] : undefined} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name, item) => [`${formatMoney(value)} (+${formatMoney(item.payload.committed)} this month)`, "Committed"]} />
                <Area type="monotone" dataKey="cumulative" stroke={ACCENT} strokeWidth={2.5} fill="url(#pf-committed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Proposal pipeline" subtitle="Proposals by status" loading={loading}>
          <div role="img" aria-label="Proposals by status">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.byStatus} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 4 }}>
                <XAxis type="number" hide allowDecimals={false} domain={[0, maxStatus === 0 ? 1 : "auto"]} />
                <YAxis type="category" dataKey="label" width={84} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name, item) => [`${value} (${formatMoney(item.payload.amount)})`, "Proposals"]} />
                <Bar dataKey="count" barSize={18} radius={[0, 6, 6, 0]} background={{ fill: "hsl(var(--muted))", radius: 6 }}>
                  {stats.byStatus.map(s => <Cell key={s.status} fill={STATUS_COLORS[s.status]} />)}
                  <LabelList dataKey="count" position="right" fontSize={12} fill={AXIS} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Allocation by sector" subtitle="Where your money is invested" loading={loading}>
          <div role="img" aria-label="Investment allocation by sector">
            <div className="relative mx-auto h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={64} outerRadius={92} paddingAngle={noMoney ? 0 : 2} stroke="none">
                    {pieData.map((d, i) => <Cell key={d.name} fill={noMoney ? "hsl(var(--muted))" : CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                  </Pie>
                  {!noMoney && <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => formatMoney(value)} />}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[11px] text-muted-foreground">Invested</div>
                <div className="font-display text-xl font-bold">{formatCompactMoney(stats.invested)}</div>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {noMoney ? (
                <li className="text-center text-xs text-muted-foreground">No investments yet</li>
              ) : stats.byCategory.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">{formatCompactMoney(c.value)}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">{Math.round((c.value / stats.invested) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        <ChartCard title="Allocation by stage" subtitle="Accepted investments by company stage" loading={loading} className="lg:col-span-2">
          <div role="img" aria-label="Investment allocation by company stage">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.byStage} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={56}
                  tickFormatter={formatCompactMoney} domain={[0, maxStage === 0 ? 1 : "auto"]} ticks={maxStage === 0 ? [0] : undefined} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [formatMoney(value), "Invested"]} />
                <Bar dataKey="value" fill={ACCENT} barSize={36} radius={[8, 8, 0, 0]} background={{ fill: "hsl(var(--muted) / 0.5)", radius: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-lg">Your proposals</h3>
            <p className="text-xs text-muted-foreground">Most recent first</p>
          </div>
          <Link to="/app/discover"><Button variant="outline" size="sm">Browse ideas</Button></Link>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <div className="text-sm font-medium">No proposals yet</div>
            <p className="mt-1 text-xs text-muted-foreground">Open an idea you like and send your first proposal. Your investments will be tracked here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Idea</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium text-right">Equity</th>
                  <th className="pb-2 pl-6 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Sent</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(p => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4">
                      {p.idea
                        ? <Link to={`/app/ideas/${p.idea.id}`} className="font-medium hover:text-primary">{p.idea.title}</Link>
                        : <span className="text-muted-foreground">Idea no longer available</span>}
                      {p.idea?.category && <div className="text-xs text-muted-foreground">{p.idea.category}</div>}
                    </td>
                    <td className="py-3 text-right font-medium">{formatMoney(p.amount)}</td>
                    <td className="py-3 text-right text-muted-foreground">{p.equity != null ? `${p.equity}%` : "–"}</td>
                    <td className="py-3 pl-6">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[p.status] }} />
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs text-muted-foreground">{format(new Date(p.created_at), "MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
