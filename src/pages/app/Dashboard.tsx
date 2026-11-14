import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { AgreementStatus, formatMoney, isCommitted } from "@/lib/portfolio";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TrendingUp, Lightbulb, Heart, MessageSquare, Plus, Eye, DollarSign, Users } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

const sample = [
  { d: "Mon", v: 12 }, { d: "Tue", v: 24 }, { d: "Wed", v: 18 },
  { d: "Thu", v: 42 }, { d: "Fri", v: 38 }, { d: "Sat", v: 55 }, { d: "Sun", v: 64 },
];

const Stat = ({ icon: Icon, label, value, accent }: any) => (
  <Card className="glass-card p-5 hover-lift">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold mt-1">{value}</div>
      </div>
      <div className={`h-10 w-10 rounded-xl ${accent} flex items-center justify-center`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </Card>
);

const Dashboard = () => {
  const { user, role } = useAuth();
  const [counts, setCounts] = useState({ ideas: 0, favs: 0 });
  const [money, setMoney] = useState(0);
  const unreadMessages = useUnreadMessages();

  // Investors: money in signed deals (accepted proposals whose agreement both sides confirmed). Founders: funding raised
  // across their ideas. Zero when there is none.
  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      if (role === "investor") {
        const { data } = await supabase.from("proposals").select("amount, status, agreements(status)").eq("investor_id", user.id).eq("status", "accepted");
        setMoney((data ?? []).reduce((total, row) => {
          const agreement = Array.isArray(row.agreements) ? row.agreements[0] : row.agreements;
          return isCommitted({ status: row.status, agreementStatus: (agreement?.status as AgreementStatus | undefined) ?? null }) ? total + Number(row.amount) : total;
        }, 0));
      } else {
        const { data } = await supabase.from("ideas").select("funding_raised").eq("user_id", user.id);
        setMoney((data ?? []).reduce((total, row) => total + Number(row.funding_raised), 0));
      }
    })();
  }, [user, role]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [ideas, favs] = await Promise.all([
        supabase.from("ideas").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      setCounts({ ideas: ideas.count ?? 0, favs: favs.count ?? 0 });
    })();
  }, [user]);

  const isInvestor = role === "investor";
  const isAdmin = role === "admin";

  return (
    <AppShell title="Dashboard">
      <div className="p-6 md:p-8 space-y-8 animate-fade-in">
        <div className="rounded-2xl p-8 bg-gradient-primary text-white shadow-elegant relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
          <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">Welcome back</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold mt-1">{user?.email?.split("@")[0]}</h2>
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
          <Stat icon={Lightbulb} label={isInvestor ? "Saved ideas" : "My ideas"} value={isInvestor ? counts.favs : counts.ideas} accent="bg-gradient-primary" />
          <Stat icon={Eye} label="Profile views" value="1,284" accent="bg-gradient-accent" />
          <Stat icon={MessageSquare} label="Unread messages" value={unreadMessages} accent="bg-primary" />
          <Stat icon={DollarSign} label={isInvestor ? "Invested" : "Raised"} value={formatMoney(money)} accent="bg-accent" />
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
              <AreaChart data={sample}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#g1)" />
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
      </div>
    </AppShell>
  );
};
export default Dashboard;
