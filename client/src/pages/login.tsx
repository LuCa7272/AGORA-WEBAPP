// FILE: client/src/pages/login.tsx

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// IMPORTIAMO useSearch per leggere i query parameters
import { useLocation, Link, useSearch } from "wouter";
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
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, LogIn, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const search = useSearch(); // Hook per accedere ai query params
  const { login, authSchema, isAuthenticated } = useAuth();
  const { toast } = useToast();

  if (isAuthenticated) {
    navigate("/");
  }

  type LoginFormValues = z.infer<typeof authSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login(data);
      toast({
        title: "Accesso effettuato!",
        description: "Bentornato nella tua SmartCart.",
      });

      // --- LOGICA DI REINDIRIZZAMENTO MODIFICATA ---
      const params = new URLSearchParams(search);
      const redirectUrl = params.get('redirect');

      if (redirectUrl) {
        // Se c'Ã¨ un URL di redirect (es. dall'invito), vai lÃ¬
        navigate(redirectUrl);
      } else {
        // Altrimenti, vai alla home come al solito
        navigate("/");
      }
      // --- FINE MODIFICA ---

    } catch (error: any) {
      const errorMessage = error.message || "Si Ã¨ verificato un errore inaspettato.";
      form.setError("root", { message: errorMessage });
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center md3-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="md3-display-small">Bentornato!</h1>
          <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)] mt-2">
            Accedi per continuare con la tua SmartCart.
          </p>
        </div>

        <div className="md3-surface-container-high md3-elevation-1 rounded-3xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {form.formState.errors.root && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Errore di accesso</AlertTitle>
                  <AlertDescription>
                    {form.formState.errors.root.message}
                  </AlertDescription>
                </Alert>
              )}

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
                          placeholder="tuo@esempio.com"
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
                          placeholder="********"
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
                  "Accesso in corso..."
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Accedi
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <div className="text-center mt-6">
          <p className="md3-body-large">
            Non hai un account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[color:var(--md-sys-color-primary)] hover:underline"
            >
              Registrati ora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}