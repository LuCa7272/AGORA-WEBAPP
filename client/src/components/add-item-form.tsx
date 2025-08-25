import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ScanLine, Loader2, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BarcodeScanner from "./barcode-scanner";
import type { ShoppingItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import type { FrequentItem } from "server/storage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebounce } from 'use-debounce';

interface AddItemFormProps {
  isMarketMode: boolean;
  activeListId: number;
}

export default function AddItemForm({ isMarketMode, activeListId }: AddItemFormProps) {
  const [newItem, setNewItem] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [debouncedSearchTerm] = useDebounce(newItem, 300);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);

  const { data: suggestionsData = [], isLoading: isLoadingSuggestions } = useQuery<FrequentItem[]>({
    queryKey: ['autocompleteSuggestions', debouncedSearchTerm],
    queryFn: () => {
      console.log(`%c[CLIENT] ➡️ Passo 1: Chiedo suggerimenti per '${debouncedSearchTerm}'`, 'color: blue; font-weight: bold;');
      return apiRequest("GET", `/api/user/autocomplete-suggestions?term=${encodeURIComponent(debouncedSearchTerm)}`)
        .then(res => res.json());
    },
    enabled: debouncedSearchTerm.length > 1 && isInputFocused,
    onSuccess: (data) => {
      console.log(`%c[CLIENT] ✅ Passo 5: Ricevuti ${data.length} suggerimenti finali dal server`, 'color: green; font-weight: bold;');
      console.log(data);
    }
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: { name: string, quantity?: string | null, category?: string | null }) => {
      const response = await apiRequest("POST", `/api/lists/${activeListId}/items`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      setNewItem("");
      setIsInputFocused(false);
      toast({
        title: "Prodotto aggiunto!",
        description: `"${data.name}" è stato inserito nella tua lista.`,
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

  const handleAddItem = (data: { name: string; quantity?: string | null; category?: string | null }) => {
    if (!data.name.trim() || !activeListId) return;
    addItemMutation.mutate(data);
  };
  
  const handleScanSuccess = (scannedCode: string) => {
    if (scannedCode) {
      findProductByEanMutation.mutate(scannedCode);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem({ name: newItem });
    }
  };
  
  const frequentItemsSuggestions = suggestionsData;
  const specificSuggestion = useMemo(() => {
      return frequentItemsSuggestions.find(item => item.recentSpecificPurchase)
             ?.recentSpecificPurchase || null;
  }, [frequentItemsSuggestions]);

  const showSuggestions = isInputFocused && newItem.length > 1 && !isLoadingSuggestions;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (formRef.current && !formRef.current.contains(event.target as Node)) {
        setIsInputFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [formRef]);


  if (isMarketMode) return null;

  return (
    <>
      <div className="relative" ref={formRef}>
        <div className="bg-card shadow-sm border rounded-2xl p-1.5">
          <div className="flex items-center space-x-2 bg-muted rounded-full p-1">
            <div className="flex-1">
              <Input
                id="add-input"
                type="text"
                placeholder="Aggiungi un prodotto..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setIsInputFocused(true)}
                className="w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10 px-4 text-base"
                autoComplete="off"
              />
            </div>
            
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsScannerOpen(true)}
              className="w-10 h-10 rounded-full flex-shrink-0"
              aria-label="Scansiona codice a barre"
            >
              <ScanLine className="w-5 h-5" />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => handleAddItem({ name: newItem })}
              disabled={!newItem.trim() || addItemMutation.isPending}
              className="w-10 h-10 rounded-full flex-shrink-0"
              aria-label="Aggiungi prodotto"
            >
              {addItemMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {showSuggestions && (
          <div className="absolute top-full mt-2 w-full bg-card border shadow-lg rounded-2xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95">
            <ScrollArea className="max-h-[40vh]">
              {(frequentItemsSuggestions.length === 0 && !specificSuggestion) ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nessun suggerimento trovato.
                </div>
              ) : (
                <>
                  {frequentItemsSuggestions.length > 0 && (
                    <div className="p-2">
                      <h4 className="text-xs font-semibold text-muted-foreground px-2 pb-1">Dalle tue abitudini</h4>
                      {frequentItemsSuggestions.map(item => (
                        <button 
                          key={item.itemName} 
                          onMouseDown={() => handleAddItem({ name: item.itemName })} 
                          className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                        >
                          <History className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p>{item.itemName}</p>
                            <p className="text-xs text-muted-foreground">Acquistato {item.purchaseCount} volte</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {specificSuggestion && (
                    <div className="p-2 border-t">
                      <h4 className="text-xs font-semibold text-muted-foreground px-2 pb-1">Acquistato di recente online</h4>
                      <button 
                        onMouseDown={() => handleAddItem({ name: specificSuggestion.matchedProduct, category: specificSuggestion.category })} 
                        className="w-full text-left flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                      >
                        <img src={specificSuggestion.imageUrl || ''} alt={specificSuggestion.matchedProduct} className="w-10 h-10 object-contain rounded-md" />
                        <div className="flex-1">
                          <p className="font-semibold">{specificSuggestion.matchedProduct}</p>
                          {specificSuggestion.price && <p className="text-sm text-primary font-bold">€{specificSuggestion.price.toFixed(2)}</p>}
                        </div>
                      </button>
                    </div>
                  )}
                </>
              )}
            </ScrollArea>
          </div>
        )}
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