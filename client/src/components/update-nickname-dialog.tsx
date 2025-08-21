// FILE: client/src/components/update-nickname-dialog.tsx (VERSIONE CORRETTA E ROBUSTA)

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUser, nicknameSchema } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Loader2 } from "lucide-react";
import { User as UserType } from "@shared/schema";

interface UpdateNicknameDialogProps {
  user: UserType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NicknameFormValues = z.infer<typeof nicknameSchema>;

export function UpdateNicknameDialog({ user, open, onOpenChange }: UpdateNicknameDialogProps) {
  const { toast } = useToast();
  const { updateNickname, isUpdatingNickname } = useUser();

  const form = useForm<NicknameFormValues>({
    resolver: zodResolver(nicknameSchema),
    // Usiamo optional chaining `?.` per accedere in sicurezza al nickname
    defaultValues: {
      nickname: user?.nickname || "",
    },
  });

  // Usiamo useEffect per aggiornare i valori del form in modo sicuro
  // solo quando l'utente o lo stato di apertura cambiano.
  useEffect(() => {
    if (user) {
      form.reset({ nickname: user.nickname || "" });
    }
  }, [user, open, form]);


  const onSubmit = async (data: NicknameFormValues) => {
    try {
      await updateNickname(data);
      toast({
        title: "Successo!",
        description: "Il tuo nickname è stato aggiornato.",
      });
      onOpenChange(false); // Chiude il dialogo in caso di successo
    } catch (error: any) {
      const errorMessage = error.message || "Si è verificato un errore.";
      form.setError("root", { message: errorMessage });
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  // --- FIX PRINCIPALE: Se non c'è l'utente, non renderizzare nulla ---
  // Questo previene qualsiasi tentativo di accedere a `user` quando è null.
  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica il tuo Nickname</DialogTitle>
          <DialogDescription>
            Scegli un nome che verrà visualizzato nell'app. Massimo 8 caratteri.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Il tuo nome" className="pl-10" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Annulla</Button>
              </DialogClose>
              <Button type="submit" disabled={isUpdatingNickname}>
                {isUpdatingNickname && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salva Modifiche
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}