// FILE: client/src/components/shopping-cart.tsx (VERSIONE CON SOSTITUZIONE IN-PLACE)

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
  Minus
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EcommerceMatch, ShoppingItem } from '@shared/schema';
import { ProductMatchDetailsDialog } from './ProductMatchDetailsDialog';

interface ShoppingCartViewProps {
  activeListId: number | null;
}

export function ShoppingCartView({ activeListId }: ShoppingCartViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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

  const getCartItems = (): EcommerceMatch[] => {
    if (!items.length || !allMatches.length) return [];
    
    const itemNamesInCurrentList = new Set(items.map(i => i.name.toLowerCase()));
    
    const bestMatches: Record<string, EcommerceMatch> = {};
    allMatches.forEach(match => {
      if (itemNamesInCurrentList.has(match.originalItem.toLowerCase())) {
        const existingMatch = bestMatches[match.originalItem];
        if (!existingMatch || match.confidence > existingMatch.confidence) {
          bestMatches[match.originalItem] = match;
        }
      }
    });
    
    return Object.values(bestMatches);
  };

  const cartMatches = getCartItems();

  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    cartMatches.forEach(match => {
      if (match.productId) {
        initialQuantities[match.productId] = quantities[match.productId] || 1;
      }
    });
    setQuantities(initialQuantities);
  }, [cartMatches]);
  
  const totalPrice = cartMatches.reduce((sum, match) => {
    const quantity = match.productId ? (quantities[match.productId] || 1) : 1;
    return sum + (match.price || 0) * quantity;
  }, 0);
  
  const totalItems = cartMatches.length;

  const generateCartMutation = useMutation<any, Error>({
    mutationFn: async () => {
      if (cartMatches.length === 0) {
        throw new Error("Il carrello è vuoto.");
      }
      
      const selectedProductsForApi: Record<string, { productId: string; quantity: number }> = {};
      cartMatches.forEach(match => {
        if(match.productId) {
            selectedProductsForApi[match.originalItem] = {
                productId: match.productId,
                quantity: quantities[match.productId] || 1,
            };
        }
      });
	  
	  const payload = { platform: "carrefour", selectedProducts: selectedProductsForApi };
    console.log("FRONTEND: Sto inviando questo payload:", JSON.stringify(payload, null, 2));

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

  // --- MODIFICA CHIAVE QUI ---
  const handleProductChange = (currentItem: EcommerceMatch, newProductId: string) => {
    const newItem = allMatches.find(m => m.productId === newProductId);
    if (!newItem) return;

    // Aggiorniamo la cache usando .map() per sostituire l'elemento in-place
    queryClient.setQueryData(['/api/ecommerce/matches', 'carrefour'], (oldData: EcommerceMatch[] = []) => {
      return oldData.map(match => 
        // Se troviamo il prodotto da sostituire (identificato dal suo ID univoco)...
        match.id === currentItem.id 
          // ...lo rimpiazziamo con il nuovo prodotto.
          ? newItem 
          // Altrimenti, manteniamo il prodotto esistente.
          : match
      );
    });

    if(newItem.productId) {
        setQuantities(prev => ({...prev, [newItem.productId!]: 1}));
    }

    toast({ title: "Prodotto sostituito", description: `"${newItem.matchedProduct}" è ora nel carrello.` });
  };
  
  const removeProductFromCart = (itemToRemove: EcommerceMatch) => {
     queryClient.setQueryData(['/api/ecommerce/matches', 'carrefour'], (oldData: EcommerceMatch[] = []) => {
      return oldData.filter(m => m.originalItem.toLowerCase() !== itemToRemove.originalItem.toLowerCase());
    });
    toast({ title: "Prodotto rimosso", description: `"${itemToRemove.originalItem}" è stato rimosso dal carrello.` });
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
      setQuantities(prev => ({
          ...prev,
          [productId]: Math.max(1, newQuantity)
      }));
  };

  if (isLoadingItems || isLoadingMatches) {
    return (
      <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-full pb-32">
      {cartMatches.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-20 h-20 md3-surface-variant rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBasket className="w-10 h-10" />
          </div>
          <h3 className="md3-headline-small mb-3">Carrello vuoto</h3>
          <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)]">
            Vai alla scheda "Matching" per popolare il carrello.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <h3 className="md3-title-medium px-2">Prodotti nel carrello</h3>
          {cartMatches.map((match) => {
            const alternativeMatches = allMatches.filter(m => 
              m.originalItem.toLowerCase() === match.originalItem.toLowerCase() && 
              m.productId !== match.productId
            );

            return (
              <div key={match.id} className="md3-surface-container md3-elevation-1 rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <ProductMatchDetailsDialog match={match} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="md3-label-medium text-[color:var(--md-sys-color-on-surface-variant)]">Per: {match.originalItem}</p>
                    <h3 className="md3-title-medium font-bold line-clamp-3 leading-tight">{match.matchedProduct}</h3>
                    <p className="md3-title-medium text-[color:var(--md-sys-color-primary)] pt-1">€{match.price?.toFixed(2)}</p>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[color:var(--md-sys-color-outline-variant)]">
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-full" 
                                onClick={() => handleQuantityChange(match.productId!, (quantities[match.productId!] || 1) - 1)}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Input 
                                type="number" 
                                value={quantities[match.productId!] || 1} 
                                onChange={(e) => handleQuantityChange(match.productId!, parseInt(e.target.value) || 1)}
                                className="h-8 w-12 text-center font-bold border-0 bg-transparent focus-visible:ring-0"
                                min="1"
                            />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-8 w-8 rounded-full"
                                onClick={() => handleQuantityChange(match.productId!, (quantities[match.productId!] || 1) + 1)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            {alternativeMatches.length > 0 && (
                                <Select value={match.productId!} onValueChange={(newProductId) => handleProductChange(match, newProductId)}>
                                    <SelectTrigger className="h-9 w-9 p-0">
                                        <Shuffle className="h-4 w-4 mx-auto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[match, ...alternativeMatches].map(opt => (
                                            <SelectItem key={opt.id} value={opt.productId!}>
                                                {opt.matchedProduct} (€{opt.price?.toFixed(2)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-[color:var(--md-sys-color-error)]" onClick={() => removeProductFromCart(match)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cartMatches.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-[color:var(--md-sys-color-surface-container)] md3-elevation-2 border-t border-[color:var(--md-sys-color-outline-variant)]">
            <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="md3-label-large text-[color:var(--md-sys-color-on-surface-variant)]">{totalItems} prodotti</span>
                    <span className="md3-headline-small font-bold text-[color:var(--md-sys-color-primary)]">€{totalPrice.toFixed(2)}</span>
                </div>
                <Button onClick={() => generateCartMutation.mutate()} disabled={generateCartMutation.isPending} className="h-12 rounded-full md3-button-filled">
                  <ExternalLink className="w-5 h-5 mr-2" />
                  {generateCartMutation.isPending ? "Attendi..." : "Vai al carrello"}
                </Button>
            </div>
        </div>
      )}
    </div>
  );
}