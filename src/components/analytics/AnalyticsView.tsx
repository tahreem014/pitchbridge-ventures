import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { DollarSign, Eye, Heart, Send, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartCard, KpiCard } from "@/components/charts/kit";
import {
  ACCENT, AUTO_DOMAIN, AXIS, GRID, STATUS_COLORS, TOOLTIP_STYLE, ZERO_LINE_DOMAIN,
} from "@/components/charts/theme";
import { AnalyticsStats, formatPercent } from "@/lib/analytics";
import { formatCompactMoney, formatMoney } from "@/lib/portfolio";

const FUNNEL_COLORS: Record<string, string> = {
  views: "hsl(230 55% 32%)", saves: "hsl(38 92% 50%)", proposals: "hsl(200 75% 45%)", deals: ACCENT,
};

const ideaLabel = (status: string, visibility: string) => {
  if (status === "published") return visibility === "public" ? "Live" : "Private";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const AnalyticsView = ({ stats, loading = false, error = null, onRetry }: {
  stats: AnalyticsStats;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) => {
  if (error) {
    return (
      <Card className="glass-card p-10 text-center">
        <div className="font-display text-lg font-semibold">We could not load your analytics</div>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        {onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}>Try again</Button>}
      </Card>
    );
  }

  const maxViews = Math.max(...stats.daily.map(d => d.views));
  const maxMonthly = Math.max(...stats.monthly.map(m => m.count));
  const maxFunnel = Math.max(...stats.funnel.map(f => f.value));
  const noProposals = stats.proposalCount === 0;
  const pieData = noProposals ? [{ status: "none", label: "No proposals yet", count: 1 }] : stats.byStatus.filter(s => s.count > 0);
  const fundingHeight = Math.max(140, stats.funding.length * 46 + 30);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={Eye} label="Total views" value={stats.totalViews.toLocaleString()} loading={loading} tone="bg-gradient-primary"
          hint={`${stats.views7d.toLocaleString()} in the last 7 days`} />
        <KpiCard icon={Heart} label="Investor saves" value={stats.totalSaves.toLocaleString()} loading={loading} tone="bg-gradient-accent"
          hint="times your ideas were saved" />
        <KpiCard icon={Send} label="Proposals received" value={stats.proposalCount.toLocaleString()} loading={loading} tone="bg-primary"
          hint={`${stats.openCount} awaiting your reply`} />
        <KpiCard icon={Wallet} label="Capital offered" value={formatMoney(stats.openAmount)} loading={loading} tone="bg-accent"
          hint="in pending and countered offers" />
        <KpiCard icon={DollarSign} label="Funds raised" value={formatMoney(stats.raised)} loading={loading} tone="bg-gradient-primary"
          hint={`of ${formatMoney(stats.target)} goal (${stats.fundingPct}%)${stats.awaitingAgreementCount > 0 ? ` · ${formatMoney(stats.awaitingAgreementAmount)} awaiting signature` : ""}`} />
        <KpiCard icon={Target} label="View to proposal rate" value={formatPercent(stats.conversion)} loading={loading} tone="bg-gradient-accent"
          hint="of views led to a proposal" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Views" subtitle="Daily views on your ideas, last 30 days" loading={loading} className="lg:col-span-2">
          <div role="img" aria-label="Views per day over the last 30 days">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="an-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={40} allowDecimals={false}
                  domain={maxViews === 0 ? ZERO_LINE_DOMAIN : AUTO_DOMAIN} ticks={maxViews === 0 ? [0] : undefined} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [value, "Views"]} />
                <Area type="monotone" dataKey="views" stroke={ACCENT} strokeWidth={2.5} fill="url(#an-views)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Interest funnel" subtitle="From first look to a closed deal" loading={loading}>
          <div role="img" aria-label="Views, saves, proposals and deals">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.funnel} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 4 }}>
                <XAxis type="number" hide allowDecimals={false} domain={[0, maxFunnel === 0 ? 1 : "auto"]} />
                <YAxis type="category" dataKey="label" width={70} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [value, "Total"]} />
                <Bar dataKey="value" barSize={20} radius={[0, 6, 6, 0]} background={{ fill: "hsl(var(--muted))", radius: 6 }}>
                  {stats.funnel.map(f => <Cell key={f.key} fill={FUNNEL_COLORS[f.key]} />)}
                  <LabelList dataKey="value" position="right" fontSize={12} fill={AXIS} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <ChartCard title="Proposals received" subtitle="Offers from investors, last 6 months" loading={loading} className="lg:col-span-2">
          <div role="img" aria-label="Proposals received per month">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} width={40} allowDecimals={false}
                  domain={maxMonthly === 0 ? [0, 1] : AUTO_DOMAIN} ticks={maxMonthly === 0 ? [0] : undefined} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, _name, item) => [`${value} (${formatMoney(item.payload.amount)})`, "Proposals"]} />
                <Bar dataKey="count" fill={ACCENT} barSize={36} radius={[8, 8, 0, 0]} background={{ fill: "hsl(var(--muted) / 0.5)", radius: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Proposal status" subtitle="Where your offers stand" loading={loading}>
          <div role="img" aria-label="Proposals by status">
            <div className="relative mx-auto h-[170px] w-[170px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="count" nameKey="label" innerRadius={54} outerRadius={80} paddingAngle={noProposals ? 0 : 2} stroke="none">
                    {pieData.map(d => <Cell key={d.status} fill={noProposals ? "hsl(var(--muted))" : STATUS_COLORS[d.status as keyof typeof STATUS_COLORS]} />)}
                  </Pie>
                  {!noProposals && <Tooltip contentStyle={TOOLTIP_STYLE} />}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-2xl font-bold">{stats.proposalCount}</div>
                <div className="text-[11px] text-muted-foreground">proposals</div>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {stats.byStatus.map(s => (
                <li key={s.status} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                  <span className="flex-1">{s.label}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Funding progress" subtitle="Raised so far against each idea's goal" loading={loading}>
        {stats.funding.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <div className="text-sm font-medium">No funding goals yet</div>
            <p className="mt-1 text-xs text-muted-foreground">Create an idea with a funding goal and its progress will be tracked here.</p>
            <Link to="/app/ideas/new"><Button size="sm" variant="outline" className="mt-4">New idea</Button></Link>
          </div>
        ) : (
          <div role="img" aria-label="Funding raised against goal for each idea">
            <ResponsiveContainer width="100%" height={fundingHeight}>
              <BarChart data={stats.funding} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCompactMoney} />
                <YAxis type="category" dataKey="name" width={120} stroke={AXIS} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string, item) => [
                    name === "raised" ? `${formatMoney(value)} (${item.payload.pct}% of ${formatMoney(item.payload.target)})` : formatMoney(value),
                    name === "raised" ? "Raised" : "Still to raise",
                  ]} />
                <Bar dataKey="raised" stackId="goal" fill={ACCENT} barSize={20} />
                <Bar dataKey="remaining" stackId="goal" fill="hsl(var(--muted))" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <Card className="glass-card p-6">
        <div className="mb-4">
          <h3 className="font-display font-semibold text-lg">Idea performance</h3>
          <p className="text-xs text-muted-foreground">Most viewed first</p>
        </div>
        {loading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : stats.perIdea.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <div className="text-sm font-medium">No ideas yet</div>
            <p className="mt-1 text-xs text-muted-foreground">Pitch your first idea to start seeing views, saves and proposals here.</p>
            <Link to="/app/ideas/new"><Button size="sm" className="mt-4 bg-gradient-primary">Pitch an idea</Button></Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Idea</th>
                  <th className="pb-2 font-medium text-right">Views</th>
                  <th className="pb-2 font-medium text-right">Saves</th>
                  <th className="pb-2 font-medium text-right">Proposals</th>
                  <th className="pb-2 pl-6 font-medium min-w-[160px]">Funding</th>
                </tr>
              </thead>
              <tbody>
                {stats.perIdea.map(i => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4">
                      <Link to={`/app/ideas/${i.id}`} className="font-medium hover:text-primary">{i.title}</Link>
                      <div className="text-xs text-muted-foreground">{ideaLabel(i.status, i.visibility)}</div>
                    </td>
                    <td className="py-3 text-right">{i.views.toLocaleString()}</td>
                    <td className="py-3 text-right">{i.saves.toLocaleString()}</td>
                    <td className="py-3 text-right">{i.proposals.toLocaleString()}</td>
                    <td className="py-3 pl-6">
                      <Progress value={i.pct} className="h-1.5" />
                      <div className="mt-1 text-xs text-muted-foreground">{formatMoney(i.raised)} of {formatMoney(i.target)} · {i.pct}%</div>
                    </td>
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
