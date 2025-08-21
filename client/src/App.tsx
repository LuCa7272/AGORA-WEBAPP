// FILE: client/src/App.tsx

import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWABadge from "@/components/PWABadge"; // Ripristiniamo il PWABadge

import Home from "@/pages/home";
import ShoppingCartPage from "@/pages/shopping-cart";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import NotFound from "@/pages/not-found";
// NUOVO IMPORT: La pagina che gestirÃ  l'accettazione degli inviti
import AcceptInvitationPage from "@/pages/accept-invitation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

function ProtectedRouter() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Reindirizza al login, mantenendo l'URL di destinazione se presente
    const destination = location === '/login' || location === '/register' ? '' : `?redirect=${location}`;
    return <Redirect to={`/login${destination}`} />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/carrello" component={ShoppingCartPage} />
      <Route path="/admin" component={AdminPage} />
      {/* Qualsiasi altra rotta protetta va qui */}
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <PWABadge />
        
        <Switch>
          {/* Rotte pubbliche */}
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          {/* NUOVA ROTTA PUBBLICA PER GLI INVITI */}
          <Route path="/invite/accept" component={AcceptInvitationPage} />

          {/* Tutte le altre rotte sono gestite dal router protetto */}
          <Route>
            <ProtectedRouter />
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;