import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  ShoppingBasket, 
  Loader2,
  Shuffle,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  History
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EcommerceMatch, ShoppingItem } from '@shared/schema';
import { ProductMatchDetailsDialog } from './ProductMatchDetailsDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface ShoppingCartViewProps {
  activeListId: number | null;
  onBack?: () => void;
}

export function ShoppingCartView({ activeListId, onBack }: ShoppingCartViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // --- MODIFICA 1: Stato per le scelte dell'utente ---
  // Mappa originalItem -> selectedProductId
  const [userSelections, setUserSelections] = useState<Record<string, string>>({});
  
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const { data: items = [], isLoading: isLoadingItems } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
      if (!activeListId) return [];
      const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
      return res.json();
    },
    enabled: !!activeListId,
  });

  const { data: allMatches = [], isLoading: isLoadingMatches } = useQuery<EcommerceMatch[]>({
    queryKey: ['/api/ecommerce/matches', 'carrefour'],
    enabled: !!activeListId,
  });

  // --- MODIFICA 2: Inizializza le selezioni dell'utente al caricamento ---
  useEffect(() => {
    if (items.length > 0 && allMatches.length > 0) {
      const initialSelections: Record<string, string> = {};
      const itemNamesInCurrentList = new Set(items.map(i => i.name.toLowerCase()));
      
      const bestMatches: Record<string, EcommerceMatch> = {};
      allMatches.forEach(match => {
        if (itemNamesInCurrentList.has(match.originalItem.toLowerCase())) {
          const existingMatch = bestMatches[match.originalItem.toLowerCase()];
          if (!existingMatch || match.confidence > existingMatch.confidence) {
            bestMatches[match.originalItem.toLowerCase()] = match;
          }
        }
      });
      
      Object.values(bestMatches).forEach(match => {
        if (match.productId) {
          initialSelections[match.originalItem] = match.productId;
        }
      });
      setUserSelections(initialSelections);
    }
  }, [items, allMatches]);

  // --- MODIFICA 3: Il carrello è ora derivato dalle selezioni dell'utente ---
  const cartMatches = React.useMemo((): EcommerceMatch[] => {
    if (Object.keys(userSelections).length === 0 || allMatches.length === 0) {
      return [];
    }
    return Object.entries(userSelections).map(([originalItem, productId]) => {
      return allMatches.find(m => m.productId === productId);
    }).filter((m): m is EcommerceMatch => m !== undefined);
  }, [userSelections, allMatches]);

  // Deriviamo le quantità dalle selezioni correnti
  const quantities = React.useMemo(() => {
    const q: Record<string, number> = {};
    Object.values(userSelections).forEach(productId => {
      q[productId] = q[productId] || 1;
    });
    return q;
  }, [userSelections]);

  const totalPrice = cartMatches.reduce((sum, match) => {
    const quantity = match.productId ? (quantities[match.productId] || 1) : 1;
    return sum + (match.price || 0) * quantity;
  }, 0);
  
  const totalItems = cartMatches.length;

  const generateCartUrlMutation = useMutation<any, Error>({
    mutationFn: async () => {
      if (cartMatches.length === 0) throw new Error("Il carrello è vuoto.");
      
      const selectedProductsForApi: Record<string, { productId: string; quantity: number }> = {};
      cartMatches.forEach(match => {
        if(match.productId) {
          selectedProductsForApi[match.originalItem] = {
            productId: match.productId,
            quantity: quantities[match.productId] || 1,
          };
        }
      });

      const response = await apiRequest("POST", "/api/ecommerce/cart/url", {
        platform: "carrefour",
        selectedProducts: selectedProductsForApi
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast({ title: "Carrello generato!", description: "Apertura del sito e-commerce in corso..." });
      }
    },
    onError: (error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const purchaseCartMutation = useMutation({
    mutationFn: async () => {
      if (!activeListId) throw new Error("Nessuna lista attiva selezionata.");
      return apiRequest("POST", `/api/lists/${activeListId}/purchase-cart`);
    },
    onSuccess: () => {
      toast({
        title: "Cronologia Aggiornata!",
        description: "I prodotti del carrello sono stati segnati come acquistati."
      });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
      
      generateCartUrlMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare la cronologia.",
        variant: "destructive"
      });
    }
  });

  // --- MODIFICA 4: Semplificate le funzioni di handle ---
  const handleProductChange = (originalItem: string, newProductId: string) => {
    const newItem = allMatches.find(m => m.productId === newProductId);
    if (!newItem) return;

    setUserSelections(prev => ({ ...prev, [originalItem]: newProductId }));

    toast({ title: "Prodotto sostituito", description: `"${newItem.matchedProduct}" è ora nella tua selezione.` });
  };
  
  const removeProductFromCart = (itemToRemove: EcommerceMatch) => {
    const newSelections = { ...userSelections };
    delete newSelections[itemToRemove.originalItem];
    setUserSelections(newSelections);

    toast({ title: "Prodotto rimosso", description: `"${itemToRemove.originalItem}" è stato rimosso dalla selezione.` });
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    // Questa logica rimane, ma la useremo per aggiornare le quantità quando implementeremo la persistenza delle quantità.
    // Per ora, non fa nulla di visibile ma è pronta per essere usata.
    console.log(`TODO: Update quantity for ${productId} to ${newQuantity}`);
  };

  if (isLoadingItems || isLoadingMatches) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="relative min-h-full pb-32 p-4">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            <span>Indietro</span>
          </Button>
        )}

        {cartMatches.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBasket className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Selezione Vuota</h3>
            <p className="text-muted-foreground">
              Vai alla scheda "Matching" per popolare la tua selezione.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold px-2">La tua Selezione Online</h3>
            <div className="border rounded-lg bg-card overflow-hidden">
              {cartMatches.map((match, index) => {
                const allProductOptions = allMatches.filter(m => 
                  m.originalItem.toLowerCase() === match.originalItem.toLowerCase()
                );

                return (
                  <div key={match.productId} className={`flex items-center gap-3 p-3 ${index < cartMatches.length - 1 ? 'border-b' : ''}`}>
                    <div className="flex-shrink-0">
                      <ProductMatchDetailsDialog match={match} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">Per: {match.originalItem}</p>
                      <p className="font-semibold break-words leading-tight text-sm">{match.matchedProduct}</p>
                      <p className="text-base font-bold text-primary pt-1">€{match.price?.toFixed(2)}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7 rounded-full" 
                            onClick={() => handleQuantityChange(match.productId!, (quantities[match.productId!] || 1) - 1)}
                        >
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-bold text-sm">{quantities[match.productId!] || 1}</span>
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-7 w-7 rounded-full"
                            onClick={() => handleQuantityChange(match.productId!, (quantities[match.productId!] || 1) + 1)}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        {allProductOptions.length > 1 && (
                          <Select value={match.productId!} onValueChange={(newProductId) => handleProductChange(match.originalItem, newProductId)}>
                            <SelectTrigger className="h-7 w-7 p-0" title="Sostituisci prodotto">
                              <Shuffle className="h-3 w-3 mx-auto" />
                            </SelectTrigger>
                            <SelectContent>
                              {allProductOptions.map(opt => (
                                <SelectItem key={opt.id} value={opt.productId!}>
                                  {opt.matchedProduct} (€{opt.price?.toFixed(2)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProductFromCart(match)} title="Rimuovi prodotto">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {cartMatches.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 p-4 bg-card border-t">
              <div className="flex justify-between items-center max-w-4xl mx-auto">
                  <div>
                      <span className="text-sm text-muted-foreground">{totalItems} prodotti</span>
                      <p className="text-2xl font-bold text-primary">€{totalPrice.toFixed(2)}</p>
                  </div>
                  <Button onClick={() => setIsConfirmDialogOpen(true)} disabled={generateCartUrlMutation.isPending || purchaseCartMutation.isPending} size="lg" className="rounded-full">
                    { (generateCartUrlMutation.isPending || purchaseCartMutation.isPending) ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                        <ExternalLink className="w-5 h-5 mr-2" />
                    )}
                    { (generateCartUrlMutation.isPending || purchaseCartMutation.isPending) ? "Attendi..." : "Procedi su Carrefour"}
                  </Button>
              </div>
          </div>
        )}
      </div>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Finalizzare la spesa?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Stai per essere reindirizzato al carrello di Carrefour. Vuoi anche segnare questi prodotti come acquistati nella tua cronologia?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={() => generateCartUrlMutation.mutate()}>
              No, vai solo al sito
            </AlertDialogAction>
            <AlertDialogAction onClick={() => purchaseCartMutation.mutate()}>
              Sì, registra e procedi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}