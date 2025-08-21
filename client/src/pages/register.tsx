// FILE: client/src/pages/register.tsx

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, User, UserPlus, Mail, Lock, CheckCircle } from "lucide-react"; // Aggiunta icona User

export default function RegisterPage() {
  // --- MODIFICA INIZIA QUI ---
  const { register, registerSchema } = useAuth(); // Usiamo il nuovo schema
  const [isSuccess, setIsSuccess] = useState(false);

  type RegisterFormValues = z.infer<typeof registerSchema>;

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      nickname: "", // Aggiungiamo il valore di default per il nuovo campo
    },
  });
  // --- FINE MODIFICA ---

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      await register(data);
      setIsSuccess(true); // Mostra il messaggio di successo
    } catch (error: any) {
      const errorMessage = error.message || "Si Ã¨ verificato un errore inaspettato.";
      form.setError("root", { message: errorMessage });
      console.error("Registration error:", error);
    }
  };

  // Se la registrazione ha avuto successo, mostriamo un messaggio all'utente.
  if (isSuccess) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center md3-surface p-4">
        <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 md3-primary-container rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-[color:var(--md-sys-color-on-primary-container)]" />
            </div>
          <h1 className="md3-display-small">Registrazione quasi completata!</h1>
          <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)] mt-4">
            Ti abbiamo inviato un'email all'indirizzo che hai fornito. Clicca sul link
            al suo interno per attivare il tuo account.
          </p>
          <Link href="/login">
            <Button className="mt-8 h-12 md3-button-tonal text-lg">
                Torna al Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Altrimenti, mostriamo il form di registrazione.
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center md3-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="md3-display-small">Crea un Account</h1>
          <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)] mt-2">
            Inizia a usare la tua SmartCart in pochi secondi.
          </p>
        </div>

        <div className="md3-surface-container-high md3-elevation-1 rounded-3xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Errore di registrazione</AlertTitle>
                  <AlertDescription>
                    {form.formState.errors.root.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* --- MODIFICA INIZIA QUI: NUOVO CAMPO NICKNAME --- */}
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="md3-body-large">Nickname (opzionale)</FormLabel>
                    <FormControl>
                       <div className="relative flex items-center">
                        <User className="absolute left-3 h-5 w-5 text-[color:var(--md-sys-color-on-surface-variant)]" />
                        <Input
                          placeholder="Il tuo nome (max 8 lettere)"
                          className="pl-10 h-14 md3-body-large rounded-xl"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* --- FINE MODIFICA --- */}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="md3-body-large">Email</FormLabel>
                    <FormControl>
                       <div className="relative flex items-center">
                        <Mail className="absolute left-3 h-5 w-5 text-[color:var(--md-sys-color-on-surface-variant)]" />
                        <Input
                          placeholder="il_tuo@indirizzo.email"
                          className="pl-10 h-14 md3-body-large rounded-xl"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="md3-body-large">Password</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <Lock className="absolute left-3 h-5 w-5 text-[color:var(--md-sys-color-on-surface-variant)]" />
                        <Input
                          type="password"
                          placeholder="Minimo 8 caratteri"
                          className="pl-10 h-14 md3-body-large rounded-xl"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 md3-button-filled text-lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  "Creazione account..."
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" />
                    Registrati
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <div className="text-center mt-6">
          <p className="md3-body-large">
            Hai giÃ  un account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[color:var(--md-sys-color-primary)] hover:underline"
            >
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}