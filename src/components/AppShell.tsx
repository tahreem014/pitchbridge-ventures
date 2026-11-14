import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { RoleSwitcher } from "./RoleSwitcher";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Lightbulb, Compass, MessageSquare, Heart, BarChart3,
  Users, FileCheck, Flag, Send, Briefcase, User, LogOut, Plus, ShieldCheck, FileSignature,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMyAvatar } from "@/hooks/useMyAvatar";
import { ReactNode } from "react";

const entrepreneurNav = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "My Ideas", url: "/app/ideas", icon: Lightbulb },
  { title: "Proposals", url: "/app/proposals", icon: Send },
  { title: "Agreements", url: "/app/agreements", icon: FileSignature },
  { title: "Pitch access", url: "/app/access", icon: ShieldCheck },
  { title: "Messages", url: "/app/messages", icon: MessageSquare },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
];
const investorNav = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Discover", url: "/app/discover", icon: Compass },
  { title: "Saved", url: "/app/saved", icon: Heart },
  { title: "Proposals", url: "/app/proposals", icon: Send },
  { title: "Agreements", url: "/app/agreements", icon: FileSignature },
  { title: "Pitch access", url: "/app/access", icon: ShieldCheck },
  { title: "Portfolio", url: "/app/portfolio", icon: Briefcase },
  { title: "Messages", url: "/app/messages", icon: MessageSquare },
];
const adminNav = [
  { title: "Overview", url: "/app", icon: LayoutDashboard },
  { title: "Users", url: "/app/admin/users", icon: Users },
  { title: "Idea Approvals", url: "/app/admin/ideas", icon: FileCheck },
  { title: "Reports", url: "/app/admin/reports", icon: Flag },
  { title: "Analytics", url: "/app/analytics", icon: BarChart3 },
];

function AppSidebar() {
  const { role, signOut, user } = useAuth();
  const unreadMessages = useUnreadMessages();
  const myAvatar = useMyAvatar();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const nav = role === "admin" ? adminNav : role === "investor" ? investorNav : entrepreneurNav;
  const isActive = (path: string) => pathname === path || (path !== "/app" && pathname.startsWith(path));
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        {!collapsed ? <Logo variant="light" /> : (
          <div className="h-9 w-9 rounded-xl bg-gradient-accent shadow-glow flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/60">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                  {item.url === "/app/messages" && unreadMessages > 0 && (
                    <SidebarMenuBadge className="bg-primary text-primary-foreground rounded-full">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === "entrepreneur" && !collapsed && (
          <div className="px-3 mt-2">
            <Button onClick={() => navigate("/app/ideas/new")} className="w-full bg-gradient-accent hover:opacity-90 text-white shadow-glow">
              <Plus className="h-4 w-4 mr-1" /> New Idea
            </Button>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            {myAvatar && <AvatarImage src={myAvatar} alt="Your profile photo" />}
            <AvatarFallback className="bg-gradient-primary text-white text-xs">{user?.email?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-xs text-sidebar-foreground truncate">{user?.email}</div>
              <div className="text-[10px] text-sidebar-foreground/60 capitalize">{role}</div>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export const AppShell = ({ children, title }: { children: ReactNode; title?: string }) => {
  const navigate = useNavigate();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              {title && <h1 className="font-display font-semibold text-lg">{title}</h1>}
            </div>
            <div className="flex items-center gap-2">
              <RoleSwitcher />
              <Button variant="ghost" size="icon" onClick={() => navigate("/app/profile")}><User className="h-4 w-4" /></Button>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};
