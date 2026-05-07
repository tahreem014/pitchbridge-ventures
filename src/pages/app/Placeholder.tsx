import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Search, TrendingUp, DollarSign, Users, Eye, Flag, Shield, CheckCircle2, XCircle } from "lucide-react";
import { sampleProposals, sampleMessages, samplePortfolio, sampleIdeas } from "@/lib/sampleData";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, BarChart, Bar } from "recharts";

export const Messages = () => (
  <AppShell title="Messages">
    <div className="p-6 md:p-8 animate-fade-in">
      <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-10rem)]">
        <Card className="glass-card p-4 md:col-span-1 overflow-y-auto">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search conversations…" className="pl-9" />
          </div>
          <div className="space-y-1">
            {sampleMessages.map((m, idx) => (
              <button key={m.id} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors ${idx === 0 ? "bg-muted" : ""}`}>
                <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {m.from.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm truncate ${m.unread ? "font-semibold" : ""}`}>{m.from}</span>
                    <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.preview}</div>
                </div>
                {m.unread && <div className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />}
              </button>
            ))}
          </div>
        </Card>
        <Card className="glass-card p-6 md:col-span-2 flex flex-col">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-semibold">SS</div>
            <div>
              <div className="font-semibold">Sequoia Scout</div>
              <div className="text-xs text-muted-foreground">Active now</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-6 space-y-4">
            <div className="flex"><div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 max-w-md text-sm">Hi! Love what you're building with NeuroPilot. Can we set up a quick call this week?</div></div>
            <div className="flex justify-end"><div className="bg-gradient-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-md text-sm">Absolutely — Thursday at 3pm PT works for me. I'll send the deck ahead.</div></div>
            <div className="flex"><div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2 max-w-md text-sm">Perfect. Looking forward to diving deeper into your traction numbers.</div></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <Input placeholder="Write a message…" />
            <Button className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>
    </div>
  </AppShell>
);

export const Proposals = () => (
  <AppShell title="Proposals">
    <div className="p-6 md:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">Investment proposals</h2>
        <p className="text-sm text-muted-foreground">Track pending offers, negotiations, and accepted deals.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Pending</div><div className="font-display text-2xl font-bold mt-1">8</div></Card>
        <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Total volume</div><div className="font-display text-2xl font-bold mt-1">$3.4M</div></Card>
        <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Accepted</div><div className="font-display text-2xl font-bold mt-1 text-accent">3</div></Card>
      </div>
      <Card className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="text-left p-4">Idea</th><th className="text-left p-4">Investor</th><th className="text-left p-4">Amount</th><th className="text-left p-4">Equity</th><th className="text-left p-4">Status</th><th></th></tr>
            </thead>
            <tbody>
              {sampleProposals.map(p => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-4 font-medium">{p.idea_title}</td>
                  <td className="p-4">{p.investor}</td>
                  <td className="p-4">${p.amount.toLocaleString()}</td>
                  <td className="p-4">{p.equity}%</td>
                  <td className="p-4"><Badge variant="outline" className="capitalize">{p.status}</Badge></td>
                  <td className="p-4 text-right"><Button variant="ghost" size="sm">View</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  </AppShell>
);

const analyticsData = [
  { m: "Jan", views: 1200, proposals: 8 }, { m: "Feb", views: 1800, proposals: 12 },
  { m: "Mar", views: 2400, proposals: 18 }, { m: "Apr", views: 2100, proposals: 14 },
  { m: "May", views: 3200, proposals: 22 }, { m: "Jun", views: 4100, proposals: 31 },
];
const sectorPie = [
  { name: "AI", value: 35 }, { name: "FinTech", value: 22 },
  { name: "Climate", value: 18 }, { name: "Health", value: 15 }, { name: "Other", value: 10 },
];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--highlight))", "hsl(var(--muted-foreground))", "hsl(var(--border))"];

export const Analytics = () => (
  <AppShell title="Analytics">
    <div className="p-6 md:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">Performance insights</h2>
        <p className="text-sm text-muted-foreground">Deep dive into pitch performance and investor engagement.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Total views</div><div className="font-display text-2xl font-bold mt-1">14.8K</div></Card>
        <Card className="glass-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Unique investors</div><div className="font-display text-2xl font-bold mt-1">432</div></Card>
        <Card className="glass-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" /> Conversion</div><div className="font-display text-2xl font-bold mt-1">8.4%</div></Card>
        <Card className="glass-card p-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3.5 w-3.5" /> Avg deal size</div><div className="font-display text-2xl font-bold mt-1">$385K</div></Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="glass-card p-6 lg:col-span-2">
          <h3 className="font-display font-semibold text-lg mb-4">Views & proposals over time</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={analyticsData}>
              <defs>
                <linearGradient id="ag1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} /><stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="m" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#ag1)" />
              <Area type="monotone" dataKey="proposals" stroke="hsl(var(--accent))" strokeWidth={2.5} fill="url(#ag2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card className="glass-card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Audience by sector</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sectorPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {sectorPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  </AppShell>
);

export const Portfolio = () => {
  const total = samplePortfolio.reduce((s, p) => s + p.invested, 0);
  const valuation = samplePortfolio.reduce((s, p) => s + p.invested * p.multiple, 0);
  return (
    <AppShell title="Portfolio">
      <div className="p-6 md:p-8 space-y-6 animate-fade-in">
        <div>
          <h2 className="font-display text-2xl font-bold">Investment portfolio</h2>
          <p className="text-sm text-muted-foreground">Track your investments, valuations, and returns in one elegant view.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Total invested</div><div className="font-display text-2xl font-bold mt-1">${(total/1e6).toFixed(2)}M</div></Card>
          <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Current value</div><div className="font-display text-2xl font-bold mt-1 text-accent">${(valuation/1e6).toFixed(2)}M</div></Card>
          <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Avg multiple</div><div className="font-display text-2xl font-bold mt-1">2.4x</div></Card>
          <Card className="glass-card p-5"><div className="text-xs text-muted-foreground">Companies</div><div className="font-display text-2xl font-bold mt-1">{samplePortfolio.length}</div></Card>
        </div>
        <Card className="glass-card p-6">
          <h3 className="font-display font-semibold text-lg mb-4">Holdings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr><th className="text-left pb-3">Company</th><th className="text-left pb-3">Stage</th><th className="text-left pb-3">Invested</th><th className="text-left pb-3">Valuation</th><th className="text-left pb-3">Multiple</th></tr>
              </thead>
              <tbody>
                {samplePortfolio.map(p => (
                  <tr key={p.company} className="border-t border-border">
                    <td className="py-3 font-medium">{p.company}</td>
                    <td className="py-3"><Badge variant="outline">{p.stage}</Badge></td>
                    <td className="py-3">${p.invested.toLocaleString()}</td>
                    <td className="py-3">${(p.valuation/1e6).toFixed(1)}M</td>
                    <td className="py-3 text-accent font-semibold">{p.multiple}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

const adminUsers = [
  { name: "Ava Chen", email: "ava@neuropilot.ai", role: "entrepreneur", status: "active", joined: "2025-09-12" },
  { name: "Sequoia Scout", email: "scout@sequoia.com", role: "investor", status: "active", joined: "2025-08-04" },
  { name: "Marcus Reid", email: "marcus@greenledger.io", role: "entrepreneur", status: "active", joined: "2025-10-01" },
  { name: "Khosla Ventures", email: "deals@khosla.com", role: "investor", status: "pending", joined: "2026-01-22" },
];

export const AdminUsers = () => (
  <AppShell title="User Moderation">
    <div className="p-6 md:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">User moderation</h2>
        <p className="text-sm text-muted-foreground">Manage members, roles, and access across the platform.</p>
      </div>
      <Card className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-4">Name</th><th className="text-left p-4">Email</th><th className="text-left p-4">Role</th><th className="text-left p-4">Status</th><th className="text-left p-4">Joined</th><th></th></tr>
          </thead>
          <tbody>
            {adminUsers.map(u => (
              <tr key={u.email} className="border-t border-border">
                <td className="p-4 font-medium">{u.name}</td>
                <td className="p-4 text-muted-foreground">{u.email}</td>
                <td className="p-4 capitalize">{u.role}</td>
                <td className="p-4"><Badge variant="outline" className="capitalize">{u.status}</Badge></td>
                <td className="p-4 text-muted-foreground">{u.joined}</td>
                <td className="p-4 text-right"><Button variant="ghost" size="sm"><Shield className="h-3.5 w-3.5 mr-1" />Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  </AppShell>
);

export const AdminIdeas = () => (
  <AppShell title="Idea Approvals">
    <div className="p-6 md:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">Idea approvals</h2>
        <p className="text-sm text-muted-foreground">Review and moderate pitches awaiting publication.</p>
      </div>
      <div className="grid gap-4">
        {sampleIdeas.slice(0, 4).map(i => (
          <Card key={i.id} className="glass-card p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="h-14 w-14 rounded-xl bg-gradient-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{i.title}</span><Badge variant="outline">{i.category}</Badge></div>
              <p className="text-sm text-muted-foreground mt-1">{i.tagline}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-destructive"><XCircle className="h-3.5 w-3.5 mr-1" />Reject</Button>
              <Button size="sm" className="bg-gradient-accent"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </AppShell>
);

const reportsData = [
  { id: "r1", target: "GreenLedger pitch", reason: "Misleading claims", reporter: "investor@vc.com", status: "open" },
  { id: "r2", target: "User: spam_account", reason: "Spam messages", reporter: "ava@neuropilot.ai", status: "investigating" },
  { id: "r3", target: "Vaultpay pitch", reason: "Duplicate listing", reporter: "ops@platform.com", status: "resolved" },
];

export const AdminReports = () => (
  <AppShell title="Reports">
    <div className="p-6 md:p-8 space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold">Reports queue</h2>
        <p className="text-sm text-muted-foreground">Investigate user-submitted reports across the platform.</p>
      </div>
      <Card className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr><th className="text-left p-4">Target</th><th className="text-left p-4">Reason</th><th className="text-left p-4">Reporter</th><th className="text-left p-4">Status</th><th></th></tr>
          </thead>
          <tbody>
            {reportsData.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-4 font-medium">{r.target}</td>
                <td className="p-4">{r.reason}</td>
                <td className="p-4 text-muted-foreground">{r.reporter}</td>
                <td className="p-4"><Badge variant="outline" className="capitalize">{r.status}</Badge></td>
                <td className="p-4 text-right"><Button variant="ghost" size="sm"><Flag className="h-3.5 w-3.5 mr-1" />Review</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  </AppShell>
);
