import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Explore from "./pages/Explore";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Dashboard from "./pages/app/Dashboard";
import MyIdeas from "./pages/app/MyIdeas";
import IdeaForm from "./pages/app/IdeaForm";
import IdeaDetail from "./pages/app/IdeaDetail";
import Discover from "./pages/app/Discover";
import Saved from "./pages/app/Saved";
import Profile from "./pages/app/Profile";
import { Messages, Proposals, Analytics, Portfolio, AdminUsers, AdminIdeas, AdminReports } from "./pages/app/Placeholder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/about" element={<About />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/profile" element={<Profile />} />
            <Route path="/app/ideas" element={<MyIdeas />} />
            <Route path="/app/ideas/new" element={<IdeaForm />} />
            <Route path="/app/ideas/:id/edit" element={<IdeaForm />} />
            <Route path="/app/ideas/:id" element={<IdeaDetail />} />
            <Route path="/app/discover" element={<Discover />} />
            <Route path="/app/saved" element={<Saved />} />
            <Route path="/app/messages" element={<Messages />} />
            <Route path="/app/proposals" element={<Proposals />} />
            <Route path="/app/analytics" element={<Analytics />} />
            <Route path="/app/portfolio" element={<Portfolio />} />
            <Route path="/app/admin/users" element={<RequireAuth roles={["admin"]}><AdminUsers /></RequireAuth>} />
            <Route path="/app/admin/ideas" element={<RequireAuth roles={["admin"]}><AdminIdeas /></RequireAuth>} />
            <Route path="/app/admin/reports" element={<RequireAuth roles={["admin"]}><AdminReports /></RequireAuth>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
