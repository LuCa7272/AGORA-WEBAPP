// FILE: client/src/components/add-item-form.tsx (CON PULSANTE SCANNER)

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ScanLine, Loader2 } from "lucide-react"; // --- 1. IMPORTA ICONA SCANNER ---
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
// --- 2. IMPORTA COMPONENTI DIALOG E SCANNER ---
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BarcodeScanner from "./barcode-scanner";
import type { ShoppingItem } from "@shared/schema";

interface AddItemFormProps {
  isMarketMode: boolean;
  activeListId: number;
}

export default function AddItemForm({ isMarketMode, activeListId }: AddItemFormProps) {
  const [newItem, setNewItem] = useState("");
  // --- 3. NUOVO STATO PER GESTIRE L'APERTURA DELLO SCANNER ---
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutazione esistente per aggiungere un item alla lista
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
  
  // --- 4. NUOVA MUTAZIONE PER CERCARE IL PRODOTTO TRAMITE EAN ---
  const findProductByEanMutation = useMutation({
    mutationFn: async (ean: string) => {
      // Usiamo l'endpoint API che hai già creato
      const response = await apiRequest("GET", `/api/products/by-ean/${ean}`);
      return response.json();
    },
    onSuccess: (product: { nome: string }) => {
      // Se il prodotto viene trovato, chiamiamo la mutazione per aggiungerlo alla lista
      toast({
        title: "Prodotto trovato!",
        description: `Aggiunta di "${product.nome}" alla lista...`,
      });
      addItemMutation.mutate({ name: product.nome });
      setIsScannerOpen(false); // Chiudiamo lo scanner
    },
    onError: (error: any) => {
      toast({
        title: "Prodotto non trovato",
        description: "Questo codice a barre non è presente nel nostro database prodotti.",
        variant: "destructive",
      });
      // Lasciamo lo scanner aperto per un altro tentativo
    },
  });


  const handleAddItem = () => {
    if (!newItem.trim() || !activeListId) return;
    addItemMutation.mutate({ name: newItem.trim() });
  };
  
  // --- 5. NUOVA FUNZIONE PER GESTIRE LA SCANSIONE RIUSCITA ---
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
        <div className="md3-surface-container md3-elevation-1 rounded-3xl p-3">
          <div className="flex items-center space-x-2 md3-surface-container-high rounded-full p-1">
            <div className="flex-1">
              <Input
                id="add-input"
                type="text"
                placeholder="Aggiungi un prodotto o scansiona..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-12 px-4 md3-body-large"
              />
            </div>
            
            {/* --- 6. NUOVO PULSANTE PER APRIRE LO SCANNER --- */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="md3-button-tonal flex items-center justify-center !p-0 w-12 h-12"
              aria-label="Scansiona codice a barre"
            >
              <ScanLine className="w-5 h-5" />
            </button>

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
      
      {/* --- 7. DIALOGO CHE CONTIENE IL COMPONENTE SCANNER --- */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="max-w-md w-full p-0 border-0">
          <DialogHeader className="p-4">
            <DialogTitle>Scansiona Codice a Barre</DialogTitle>
          </DialogHeader>
          <div className="aspect-square w-full">
            {findProductByEanMutation.isPending ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
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