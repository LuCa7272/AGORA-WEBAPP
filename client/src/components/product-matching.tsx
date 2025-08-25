import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Bot, ExternalLink, Zap, Plus, Minus, ShoppingCart, RotateCcw, CheckCircle, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingItem, EcommerceMatch } from "@shared/schema";
import { ProductMatchDetailsDialog } from './ProductMatchDetailsDialog';
import { ManualSelections } from "@/pages/home"; // Importa il tipo
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const platforms = [
  { id: "carrefour", name: "Carrefour", icon: Store, color: "border-primary bg-blue-50 text-primary" },
  { id: "esselunga", name: "Esselunga", icon: Store, color: "border-gray-200 text-gray-600" },
];

interface ProductMatchingProps {
  activeListId: number | null;
  onNavigateToCart?: () => void;
  onBack?: () => void;
  // --- MODIFICA 1: Aggiunta props per la gestione dello stato esterno ---
  manualSelections: ManualSelections;
  onManualSelectionsChange: (selections: ManualSelections) => void;
}

export default function ProductMatching({ 
  activeListId, 
  onNavigateToCart, 
  onBack,
  manualSelections,
  onManualSelectionsChange
}: ProductMatchingProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedPlatform, setSelectedPlatform] = useState("carrefour");
  const [isAutomatic, setIsAutomatic] = useState(true);

  const { data: items = [], isLoading: isLoadingItems } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
        if (!activeListId) return [];
        const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
        return res.json();
    },
    enabled: !!activeListId,
  });

  const { data: allMatches = [] } = useQuery<EcommerceMatch[]>({
    queryKey: ["/api/ecommerce/matches", selectedPlatform],
    enabled: !!selectedPlatform,
  });

  // --- MODIFICA 2: Inizializza le selezioni manuali se non presenti ---
  useEffect(() => {
    if (!isAutomatic && allMatches.length > 0) {
      const newSelections = { ...manualSelections };
      let changed = false;
      items.forEach(item => {
        if (!newSelections[item.name]) {
          const bestMatch = allMatches.find(m => m.originalItem.toLowerCase() === item.name.toLowerCase());
          if (bestMatch?.productId) {
            newSelections[item.name] = { productId: bestMatch.productId, quantity: 1 };
            changed = true;
          }
        }
      });
      if (changed) {
        onManualSelectionsChange(newSelections);
      }
    }
  }, [isAutomatic, allMatches, items, manualSelections, onManualSelectionsChange]);


  const matchProductsMutation = useMutation({
    mutationFn: async (): Promise<EcommerceMatch[]> => {
      await apiRequest("DELETE", `/api/ecommerce/matches/${selectedPlatform}`, {});
      
      const itemNames = items.map(item => item.name);
      if (itemNames.length === 0) {
        throw new Error("La lista è vuota. Aggiungi prodotti prima di avviare il matching.");
      }

      const response = await apiRequest("POST", "/api/ecommerce/match", {
        items: itemNames,
        platform: selectedPlatform,
        expandSearch: false
      });
      return response.json();
    },
    onSuccess: (newlyCreatedMatches) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ecommerce/matches", selectedPlatform] });
      toast({
        title: "Matching completato!",
        description: `Trovati ${newlyCreatedMatches.length} prodotti.`,
      });
      if (isAutomatic && onNavigateToCart) {
        onNavigateToCart();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore nel Matching",
        description: error.message || "Impossibile eseguire il matching.",
        variant: "destructive",
      });
    },
  });

  const loadMoreMutation = useMutation({
    mutationFn: async (itemName: string): Promise<EcommerceMatch[]> => {
      const response = await apiRequest("POST", "/api/ecommerce/match", {
        items: [itemName],
        platform: selectedPlatform,
        expandSearch: true,
      });
      return response.json();
    },
    onSuccess: (newlyCreatedMatches, itemName) => {
      queryClient.setQueryData(
        ["/api/ecommerce/matches", selectedPlatform],
        (oldData: EcommerceMatch[] = []) => [...oldData, ...newlyCreatedMatches]
      );
      toast({
        title: "Nuovi match caricati",
        description: `Trovate ${newlyCreatedMatches.length} nuove opzioni per "${itemName}".`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare altri match.",
        variant: "destructive",
      });
    },
  });

  // --- MODIFICA 3: Le funzioni di handle ora usano lo stato esterno ---
  const handleProductSelect = (itemName: string, productId: string | null, checked: boolean) => {
    const newSelections = { ...manualSelections };
    if (checked && productId) {
      const currentSelection = newSelections[itemName];
      newSelections[itemName] = { productId, quantity: currentSelection?.quantity || 1 };
    } else {
      delete newSelections[itemName];
    }
    onManualSelectionsChange(newSelections);
  };

  const handleQuantityChange = (itemName: string, productId: string | null, quantity: number) => {
    if (!productId || quantity < 1) return;
    const newSelections = { ...manualSelections };
    newSelections[itemName] = { productId, quantity };
    onManualSelectionsChange(newSelections);
  };

  const groupedMatches = allMatches.reduce((acc: {[key: string]: EcommerceMatch[]}, match) => {
    if (!acc[match.originalItem]) acc[match.originalItem] = [];
    acc[match.originalItem].push(match);
    return acc;
  }, {});
  
  const selectedPlatformData = platforms.find(p => p.id === selectedPlatform);
  const hasItems = items.length > 0;
  const hasMatches = allMatches.length > 0;

  const renderMatchButton = () => {
    const buttonText = isAutomatic ? "Matching Automatico" : "Trova Opzioni Prodotti";
    const isDisabled = matchProductsMutation.isPending || isLoadingItems;

    if (allMatches.length > 0) {
      return (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isDisabled} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2"/>
              {matchProductsMutation.isPending ? 'Sto cercando di nuovo...' : 'Esegui di Nuovo il Matching'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sei sicuro di voler continuare?</AlertDialogTitle>
              <AlertDialogDescription>
                Il carrello contiene già dei prodotti. Avviando un nuovo matching, i prodotti attuali verranno rimossi e sostituiti con i risultati della nuova ricerca basata sulla lista attuale.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => matchProductsMutation.mutate()}>
                Sovrascrivi Selezione
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return (
      <Button 
        onClick={() => matchProductsMutation.mutate()}
        disabled={isDisabled}
        className="w-full"
      >
        <Zap className="h-4 w-4 mr-2" />
        {matchProductsMutation.isPending ? 'Matching in corso...' : buttonText}
      </Button>
    );
  };


  return (
    <div className="space-y-6 p-4">
      {onBack && (
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Indietro</span>
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Store className="h-5 w-5 text-white" />
            </div>
            Selezione Piattaforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platforms.map((platform) => {
              const IconComponent = platform.icon;
              return (
                <button
                  key={platform.id}
                  onClick={() => {
                    if (platform.id === 'carrefour') {
                      setSelectedPlatform(platform.id);
                    }
                  }}
                  disabled={platform.id !== 'carrefour'}
                  className={`p-4 rounded-lg border-2 transition-colors text-center ${
                    platform.id === 'carrefour' ? (
                      selectedPlatform === platform.id
                        ? platform.color
                        : "border-gray-200 hover:border-gray-300"
                    ) : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                  }`}
                >
                  <IconComponent className={`h-6 w-6 mx-auto mb-2 ${platform.id !== 'carrefour' ? 'text-gray-400' : ''}`} />
                  <div className={`font-medium text-sm ${platform.id !== 'carrefour' ? 'text-gray-400' : ''}`}>
                    {platform.name}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            Matching Prodotti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Modalità Automatica</div>
              <div className="text-sm text-gray-600">
                {isAutomatic ? "Il sistema seleziona il miglior prodotto per te" : "Scegli tu tra le opzioni trovate"}
              </div>
            </div>
            <Switch
              checked={isAutomatic}
              onCheckedChange={setIsAutomatic}
            />
          </div>

          {!hasItems && !isLoadingItems ? (
            <div className="text-center py-8 text-gray-500">
              <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aggiungi prodotti alla lista per iniziare il matching.</p>
            </div>
           ) : (
            renderMatchButton()
           )}
        </CardContent>
      </Card>
      
      {hasMatches && !isAutomatic && (
        <Card>
          <CardHeader>
            <CardTitle>Seleziona i tuoi Prodotti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedMatches).map(([itemName, itemMatches]) => {
              const currentSelection = manualSelections[itemName];
              return (
                <div key={itemName} className="border rounded-lg p-4">
                  <h4 className="font-medium text-lg mb-3 capitalize">{itemName}</h4>
                  <div className="space-y-3">
                    {itemMatches.map((match) => {
                      const isSelected = currentSelection?.productId === match.productId;
                      const quantity = isSelected ? currentSelection.quantity : 1;
                      return (
                      <div key={match.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleProductSelect(itemName, match.productId, checked as boolean)}
                          />
                          <ProductMatchDetailsDialog match={match} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{match.matchedProduct}</div>
                            <div className="text-xs text-gray-600 truncate">{match.brand}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 w-full sm:w-auto sm:justify-end">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {(match.confidence * 100).toFixed(0)}%
                            </Badge>
                            {match.price && (
                              <div className="text-sm font-medium">€{match.price.toFixed(2)}</div>
                            )}
                          </div>
                          {match.productId && (
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm" onClick={() => handleQuantityChange(itemName, match.productId!, Math.max(1, quantity - 1))} className="h-8 w-8 p-0">
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input type="number" value={quantity} onChange={(e) => handleQuantityChange(itemName, match.productId!, parseInt(e.target.value) || 1)} className="w-12 sm:w-16 h-8 text-center" min="1" />
                              <Button variant="outline" size="sm" onClick={() => handleQuantityChange(itemName, match.productId!, quantity + 1)} className="h-8 w-8 p-0">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )})}
                    <div className="pt-3 border-t mt-3">
                      <Button variant="outline" size="sm" onClick={() => loadMoreMutation.mutate(itemName)} disabled={loadMoreMutation.isPending} className="w-full">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {loadMoreMutation.isPending ? "Caricamento..." : "Carica altre opzioni"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
            
            {Object.keys(manualSelections).length > 0 && (
              <div className="border-t pt-4 mt-6">
                <Button onClick={() => onNavigateToCart && onNavigateToCart()} className="w-full">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Conferma Selezione ({Object.keys(manualSelections).length} prodotti)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}