import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const Placeholder = ({ title, desc }: { title: string; desc: string }) => (
  <AppShell title={title}>
    <div className="p-6 md:p-8 animate-fade-in">
      <Card className="glass-card p-12 text-center">
        <div className="h-14 w-14 mx-auto rounded-2xl bg-gradient-accent flex items-center justify-center mb-4">
          <Construction className="h-6 w-6 text-white" />
        </div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">{desc}</p>
      </Card>
    </div>
  </AppShell>
);

export const AdminUsers = () => <Placeholder title="User Moderation" desc="Review users, manage roles, and handle account actions." />;
export const AdminIdeas = () => <Placeholder title="Idea Approvals" desc="Approve, reject, or flag pitches awaiting moderation." />;
export const AdminReports = () => <Placeholder title="Reports" desc="Investigate user-submitted reports across the platform." />;
