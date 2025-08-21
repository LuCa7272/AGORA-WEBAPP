// FILE: client/src/pages/accept-invitation.tsx (NUOVO FILE)

import { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AcceptInvitationPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Estrae il token dai parametri dell'URL
  const urlParams = new URLSearchParams(search);
  const token = urlParams.get('token');

  const acceptMutation = useMutation({
    mutationFn: (token: string) => apiRequest('POST', '/api/invitations/accept', { token }),
    onSuccess: () => {
      toast({
        title: "Invito Accettato!",
        description: "La lista condivisa è ora disponibile nel tuo account.",
      });
      // Dopo il successo, reindirizza alla home page
      navigate('/', { replace: true });
    },
    onError: (error: any) => {
      // L'errore viene gestito dallo stato della mutazione per essere mostrato nella UI
      console.error("Errore nell'accettare l'invito:", error);
    }
  });

  useEffect(() => {
    // Questo effetto si attiva quando lo stato di autenticazione è definito e c'è un token
    if (!isAuthLoading && token) {
      if (isAuthenticated) {
        // Se l'utente è loggato, prova subito ad accettare l'invito
        acceptMutation.mutate(token);
      } else {
        // Se non è loggato, reindirizza alla pagina di login,
        // passando l'URL corrente come destinazione post-login.
        navigate(`/login?redirect=/invite/accept?token=${token}`, { replace: true });
      }
    }
  }, [isAuthenticated, isAuthLoading, token, navigate, acceptMutation]);

  const renderContent = () => {
    if (!token) {
      return (
        <>
          <CardTitle>Invito non valido</CardTitle>
          <CardDescription>Il link di invito sembra essere incompleto. Manca il token di autorizzazione.</CardDescription>
          <Button onClick={() => navigate('/')} className="mt-4">Torna alla Home</Button>
        </>
      );
    }

    if (isAuthLoading || (isAuthenticated && acceptMutation.isPending)) {
      return (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <CardTitle>Stiamo processando il tuo invito...</CardTitle>
          <CardDescription>Attendi un momento.</CardDescription>
        </>
      );
    }

    if (acceptMutation.isError) {
      return (
        <>
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <CardTitle>Oops! Qualcosa è andato storto.</CardTitle>
          <CardDescription>
            {acceptMutation.error?.message || "Non è stato possibile accettare l'invito. Potrebbe essere scaduto o già utilizzato."}
          </CardDescription>
          <Button onClick={() => navigate('/')} className="mt-4">Torna alla Home</Button>
        </>
      );
    }
    
    // Lo stato di successo viene gestito dal reindirizzamento nell'onSuccess,
    // ma teniamo un messaggio di fallback nel caso il reindirizzamento fallisca.
     if (acceptMutation.isSuccess) {
      return (
        <>
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <CardTitle>Invito Accettato!</CardTitle>
          <CardDescription>
            Stai per essere reindirizzato alla tua dashboard...
          </CardDescription>
        </>
      );
    }

    // Stato iniziale prima che l'useEffect faccia il suo lavoro
    return (
        <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <CardTitle>Verifica in corso...</CardTitle>
            <CardDescription>Stiamo controllando il tuo stato di autenticazione.</CardDescription>
        </>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            SmartCart
        </CardHeader>
        <CardContent className="text-center">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}