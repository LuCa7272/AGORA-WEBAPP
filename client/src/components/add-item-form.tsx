// FILE: client/src/components/add-item-form.tsx

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Aggiungiamo la prop per l'ID della lista attiva
interface AddItemFormProps {
  isMarketMode: boolean;
  activeListId: number;
}

export default function AddItemForm({ isMarketMode, activeListId }: AddItemFormProps) {
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addItemMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      // La rotta API ora include l'ID della lista
      const response = await apiRequest("POST", `/api/lists/${activeListId}/items`, data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidiamo la query specifica per questa lista, in modo che si aggiorni
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      setNewItem("");
      toast({
        title: "Prodotto aggiunto!",
        description: "Il prodotto è stato inserito nella tua lista.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere il prodotto",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (!newItem.trim() || !activeListId) return;
    
    addItemMutation.mutate({
      name: newItem.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItem();
    }
  };

  if (isMarketMode) return null;

  return (
    <div className="p-4" id="add-form">
      <div className="md3-surface-container md3-elevation-1 rounded-3xl p-3">
        <div className="flex items-center space-x-2 md3-surface-container-high rounded-full p-1">
          <div className="flex-1">
            <Input
              id="add-input"
              type="text"
              placeholder="Aggiungi un prodotto..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-12 px-4 md3-body-large"
            />
          </div>
          <button
            onClick={handleAddItem}
            disabled={!newItem.trim() || addItemMutation.isPending}
            className="md3-button-tonal flex items-center justify-center !p-0 w-12 h-12 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            aria-label="Aggiungi prodotto"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}