import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TrendingUp, Lightbulb, MessageSquare, Plus, Eye, DollarSign, Users, Heart, Target, Briefcase } from "lucide-react";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area, BarChart, Bar } from "recharts";
import { sampleIdeas, sampleProposals, sampleMessages } from "@/lib/sampleData";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const engagement = [
  { d: "Mon", views: 120, saves: 18 }, { d: "Tue", views: 240, saves: 32 },
  { d: "Wed", views: 180, saves: 26 }, { d: "Thu", views: 420, saves: 51 },
  { d: "Fri", views: 380, saves: 47 }, { d: "Sat", views: 550, saves: 62 },
  { d: "Sun", views: 640, saves: 78 },
];
const sectorData = [
  { sector: "AI", deals: 12 }, { sector: "Climate", deals: 8 },
  { sector: "Health", deals: 6 }, { sector: "FinTech", deals: 9 },
  { sector: "Deep", deals: 4 }, { sector: "SaaS", deals: 11 },
];

const Stat = ({ icon: Icon, label, value, accent, delta }: any) => (
  <Card className="glass-card p-5 hover-lift">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold mt-1">{value}</div>
        {delta && <div className="text-[11px] text-accent font-medium mt-1">{delta}</div>}
      </div>
      <div className={`h-10 w-10 rounded-xl ${accent} flex items-center justify-center`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </Card>
);

const Dashboard = () => {
  const { user, role } = useAuth();
  const isInvestor = role === "investor";
  const isAdmin = role === "admin";
  const displayName = user?.email?.split("@")[0] ?? "founder";

  return (
    <AppShell title="Dashboard">
      <div className="p-6 md:p-8 space-y-8 animate-fade-in">
        <div className="rounded-2xl p-8 bg-gradient-primary text-white shadow-elegant relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">Welcome back</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1 capitalize">{displayName}</h2>
              <p className="text-white/70 mt-2 max-w-md">{isInvestor ? "Review fresh deal flow tailored to your portfolio." : isAdmin ? "Monitor platform health, users, and listings." : "Refine your pitch and engage with active investors today."}</p>
            </div>
            <div className="flex gap-2">
              {isInvestor ? (
                <Link to="/app/discover"><Button className="bg-white text-primary hover:bg-white/90"><TrendingUp className="h-4 w-4 mr-1" /> Discover ideas</Button></Link>
              ) : (
                <Link to="/app/ideas/new"><Button className="bg-white text-primary hover:bg-white/90"><Plus className="h-4 w-4 mr-1" /> New idea</Button></Link>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={Lightbulb} label={isInvestor ? "Saved ideas" : "Active pitches"} value={isInvestor ? 14 : 6} accent="bg-gradient-primary" delta="+3 this week" />
          <Stat icon={Eye} label="Profile views" value="1,284" accent="bg-gradient-accent" delta="+18% MoM" />
          <Stat icon={MessageSquare} label="Messages" value={sampleMessages.length} accent="bg-primary" delta="2 unread" />
          <Stat icon={DollarSign} label={isInvestor ? "Invested" : "Raised"} value="$1.9M" accent="bg-accent" delta="+$240K" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="glass-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-lg">Engagement this week</h3>
                <p className="text-xs text-muted-foreground">Pitch views, saves, and proposal activity</p>
              </div>
              <div className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">+24% vs last week</div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={engagement}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g1)" />
                <Area type="monotone" dataKey="saves" stroke="hsl(var(--accent))" strokeWidth={2.5} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="font-display font-semibold text-lg">Quick actions</h3>
            <div className="mt-4 space-y-2">
              {isInvestor ? (
                <>
                  <Link to="/app/discover" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                    <span className="flex items-center gap-3 text-sm"><TrendingUp className="h-4 w-4 text-primary" /> Browse new pitches</span>
                  </Link>
                  <Link to="/app/saved" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                    <span className="flex items-center gap-3 text-sm"><Heart className="h-4 w-4 text-destructive" /> View saved</span>
                  </Link>
                  <Link to="/app/portfolio" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                    <span className="flex items-center gap-3 text-sm"><Briefcase className="h-4 w-4 text-accent" /> Portfolio</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/app/ideas/new" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                    <span className="flex items-center gap-3 text-sm"><Plus className="h-4 w-4 text-accent" /> Create new pitch</span>
                  </Link>
                  <Link to="/app/ideas" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                    <span className="flex items-center gap-3 text-sm"><Lightbulb className="h-4 w-4 text-primary" /> Manage my ideas</span>
                  </Link>
                </>
              )}
              <Link to="/app/messages" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                <span className="flex items-center gap-3 text-sm"><MessageSquare className="h-4 w-4 text-highlight" /> Open inbox</span>
              </Link>
              <Link to="/app/profile" className="flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors">
                <span className="flex items-center gap-3 text-sm"><Users className="h-4 w-4 text-muted-foreground" /> Edit profile</span>
              </Link>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="glass-card p-6 lg:col-span-2">
            <h3 className="font-display font-semibold text-lg mb-1">Trending pitches</h3>
            <p className="text-xs text-muted-foreground mb-4">Top performing ideas across the platform this week</p>
            <div className="space-y-3">
              {sampleIdeas.slice(0, 4).map(i => {
                const pct = Math.min(100, (i.funding_raised / i.funding_target) * 100);
                return (
                  <Link to={`/app/ideas/${i.id}`} key={i.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors">
                    <div className="h-12 w-12 rounded-xl bg-gradient-accent flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{i.title}</span>
                        <Badge variant="outline" className="text-[10px]">{i.category}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{i.tagline}</div>
                      <Progress value={pct} className="h-1 mt-2" />
                    </div>
                    <div className="text-right text-xs flex-shrink-0">
                      <div className="font-semibold">${(i.funding_raised / 1000).toFixed(0)}K</div>
                      <div className="text-accent">{pct.toFixed(0)}% funded</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="font-display font-semibold text-lg mb-1">Sector deal flow</h3>
            <p className="text-xs text-muted-foreground mb-4">Active deals by sector</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="sector" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="deals" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="glass-card p-6">
            <h3 className="font-display font-semibold text-lg mb-4">Recent proposals</h3>
            <div className="space-y-3">
              {sampleProposals.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.idea_title}</div>
                    <div className="text-xs text-muted-foreground">{p.investor} · ${(p.amount/1000).toFixed(0)}K for {p.equity}%</div>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="glass-card p-6">
            <h3 className="font-display font-semibold text-lg mb-4">Inbox</h3>
            <div className="space-y-2">
              {sampleMessages.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors">
                  <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-semibold">
                    {m.from.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${m.unread ? "font-semibold" : ""}`}>{m.from}</span>
                      <span className="text-[10px] text-muted-foreground">{m.time}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.preview}</div>
                  </div>
                  {m.unread && <div className="h-2 w-2 rounded-full bg-accent flex-shrink-0" />}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};
export default Dashboard;
