// FILE: client/src/App.tsx

import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

// Import delle pagine e dell'hook di autenticazione
import Home from "@/pages/home";
import ShoppingCartPage from "@/pages/shopping-cart";
import AdminPage from "@/pages/admin";
import LoginPage from "@/pages/login"; // NUOVO
import RegisterPage from "@/pages/register"; // NUOVO
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth"; // NUOVO

// Componente per gestire le rotte protette
function ProtectedRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  // Se stiamo ancora caricando lo stato dell'utente, non mostriamo nulla per evitare sfarfallii
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
          <p>Caricamento...</p>
      </div>
    );
  }

  // Se l'utente non è autenticato, reindirizza alla pagina di login
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // Se l'utente è autenticato, mostra le rotte protette
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/carrello" component={ShoppingCartPage} />
      <Route path="/admin" component={AdminPage} />
      {/* Qualsiasi altra rotta protetta andrà qui */}
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* Usiamo un router principale per distinguere le rotte pubbliche da quelle protette */}
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          {/* Qualsiasi altra rotta pubblica (es. /verify-email) andrebbe qui */}
          
          {/* Per tutte le altre rotte, usiamo il nostro ProtectedRouter */}
          <Route>
            <ProtectedRouter />
          </Route>
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;