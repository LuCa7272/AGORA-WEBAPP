import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Share2, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Label } from './ui/label';

interface ShareListDialogProps {
  activeListId: number;
  listName: string;
}

export function ShareListDialog({ activeListId, listName }: ShareListDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => 
      apiRequest("POST", `/api/lists/${activeListId}/invitations`, { email }),
    onSuccess: (_, email) => {
      toast({ 
        title: "Invito Inviato!", 
        description: `Un'email è stata inviata a ${email} per unirsi alla lista.` 
      });
      queryClient.invalidateQueries({ queryKey: ['listMembers', activeListId] });
      setInviteEmail("");
      // Potresti voler chiudere il dialogo dopo l'invio
      // setIsDialogOpen(false); 
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile inviare l'invito.", 
        variant: "destructive" 
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteMutation.mutate(inviteEmail.trim());
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" title="Condividi lista">
          <Share2 className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Condividi "{listName}"</DialogTitle>
          <DialogDescription>
            Invita altri utenti a collaborare. Potranno aggiungere e rimuovere prodotti in tempo reale.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite}>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="nome@esempio.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        disabled={inviteMutation.isPending}
                        className="col-span-3"
                    />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Annulla
                    </Button>
                </DialogClose>
                <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
                    {inviteMutation.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Invio...
                        </>
                    ) : (
                        <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Invia Invito
                        </>
                    )}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}