// FILE: client/src/hooks/use-auth.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { z } from "zod";

// --- MODIFICA INIZIA QUI ---

// Schema base per il login (invariato)
const authSchema = z.object({
  email: z.string().email("Email non valida."),
  password: z.string().min(8, "La password deve essere di almeno 8 caratteri."),
});

// Nuovo schema esteso per la registrazione
const registerSchema = authSchema.extend({
    // Rendiamo il nickname opzionale con `.optional()` ma applichiamo le validazioni se viene fornito.
    nickname: z.string()
        .max(8, "Il nickname non può superare gli 8 caratteri.")
        .optional(),
});

type AuthInput = z.infer<typeof authSchema>;
type RegisterInput = z.infer<typeof registerSchema>; // Nuovo tipo per la registrazione

// --- FINE MODIFICA ---

// Funzione per ottenere i dati dell'utente corrente
async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await apiRequest("GET", "/api/auth/me");
    const data = await response.json();
    return data.user || null;
  } catch (error) {
    // Se la richiesta fallisce (es. 401), significa che l'utente non Ã¨ loggato
    return null;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();

  // useQuery per ottenere e mantenere in cache i dati dell'utente.
  // La chiave 'currentUser' Ã¨ usata per identificare questa query in tutta l'app.
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: Infinity, // I dati dell'utente non diventano "stale" a meno che non si faccia login/logout
  });

  // useMutation per la funzione di login
  const loginMutation = useMutation({
    mutationFn: async (credentials: AuthInput) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: () => {
      // Dopo un login riuscito, invalida la query 'currentUser' per forzare un refetch
      // e aggiornare lo stato dell'utente in tutta l'applicazione.
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  // useMutation per la funzione di registrazione
  const registerMutation = useMutation({
    // --- MODIFICA INIZIA QUI ---
    mutationFn: async (credentials: RegisterInput) => {
      const response = await apiRequest("POST", "/api/auth/register", credentials);
      return response.json();
    },
    // --- FINE MODIFICA ---
  });

  // useMutation per la funzione di logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Dopo il logout, aggiorna direttamente la cache di 'currentUser' a null
      // per una reattivitÃ  istantanea, e poi invalida per essere sicuri.
      queryClient.setQueryData(["currentUser"], null);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  return {
    // Dati sullo stato
    user,
    isLoading,
    isAuthenticated: !!user && !isError,

    // Funzioni di mutazione
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,

    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    logoutError: logoutMutation.error,

    // --- MODIFICA INIZIA QUI ---
    // Esponiamo entrambi gli schemi per i form
    authSchema,
    registerSchema,
    // --- FINE MODIFICA ---
  };
}