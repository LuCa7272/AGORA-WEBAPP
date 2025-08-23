import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ScanLine, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BarcodeScanner from "./barcode-scanner";
import type { ShoppingItem } from "@shared/schema";
import { Button } from "@/components/ui/button";

interface AddItemFormProps {
  isMarketMode: boolean;
  activeListId: number;
}

export default function AddItemForm({ isMarketMode, activeListId }: AddItemFormProps) {
  const [newItem, setNewItem] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addItemMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", `/api/lists/${activeListId}/items`, data);
      return response.json();
    },
    onSuccess: () => {
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
  
  const findProductByEanMutation = useMutation({
    mutationFn: async (ean: string) => {
      const response = await apiRequest("GET", `/api/products/by-ean/${ean}`);
      return response.json();
    },
    onSuccess: (product: { nome: string }) => {
      toast({
        title: "Prodotto trovato!",
        description: `Aggiunta di "${product.nome}" alla lista...`,
      });
      addItemMutation.mutate({ name: product.nome });
      setIsScannerOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Prodotto non trovato",
        description: "Questo codice a barre non è presente nel nostro database prodotti.",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (!newItem.trim() || !activeListId) return;
    addItemMutation.mutate({ name: newItem.trim() });
  };
  
  const handleScanSuccess = (scannedCode: string) => {
    if (scannedCode) {
      findProductByEanMutation.mutate(scannedCode);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItem();
    }
  };

  if (isMarketMode) return null;

  return (
    <>
      <div className="p-4" id="add-form">
        <div className="bg-card shadow-sm border rounded-2xl p-2">
          <div className="flex items-center space-x-2 bg-muted rounded-full p-1">
            <div className="flex-1">
              <Input
                id="add-input"
                type="text"
                placeholder="Aggiungi un prodotto o scansiona..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-12 px-4 text-base"
              />
            </div>
            
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsScannerOpen(true)}
              className="w-12 h-12 rounded-full flex-shrink-0"
              aria-label="Scansiona codice a barre"
            >
              <ScanLine className="w-5 h-5" />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={handleAddItem}
              disabled={!newItem.trim() || addItemMutation.isPending}
              className="w-12 h-12 rounded-full flex-shrink-0"
              aria-label="Aggiungi prodotto"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md w-full p-0 border-0">
          <DialogHeader className="p-4">
            <DialogTitle>Scansiona Codice a Barre</DialogTitle>
          </DialogHeader>
          <div className="aspect-square w-full">
            {findProductByEanMutation.isPending ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="font-medium">Ricerca prodotto...</p>
              </div>
            ) : (
              <BarcodeScanner
                onScanSuccess={handleScanSuccess}
                onClose={() => setIsScannerOpen(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}