// FILE: client/components/shopping-list.tsx (CON ACQUISTO E CANCELLAZIONE OFFLINE)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trash2, ShoppingBasket, Calendar, Check, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatFrequencyText, getFrequencyColor, getFrequencyDots } from "@/lib/frequency-calculator";
import type { ShoppingItem } from "@shared/schema";
import { useSwipeable } from "react-swipeable";
import { useAuth } from "@/hooks/use-auth";
// Importiamo le nuove funzioni specifiche dalla nostra coda offline
import { addPurchaseToOfflineQueue, addDeleteToOfflineQueue } from "@/lib/offline-queue";

interface ShoppingListProps {
  isMarketMode: boolean;
  activeListId: number;
  activeStoreId: number | null; 
  categoryOrder: string[]; 
}

// Il componente figlio riceve semplici funzioni di callback
const ShoppingItemRow = ({
  item,
  isMarketMode,
  onPurchase,
  onDelete
}: {
  item: ShoppingItem;
  isMarketMode: boolean;
  onPurchase: (item: ShoppingItem) => void;
  onDelete: (itemId: number) => void;
}) => {
  const [swipeProgress, setSwipeProgress] = useState(0);

  const handlers = useSwipeable({
    onSwiped: () => setSwipeProgress(0),
    onSwipedLeft: () => isMarketMode && onPurchase(item),
    onSwipedRight: () => isMarketMode && onPurchase(item),
    onSwiping: (eventData) => {
      if (isMarketMode) {
        const progress = Math.max(-100, Math.min(100, eventData.deltaX));
        setSwipeProgress(progress);
      }
    },
    trackMouse: true,
  });

  const renderFrequencyIndicator = (item: ShoppingItem) => {
    if (!item.averageFrequency) return null;
    const confidence = item.purchaseCount > 1 ? 0.8 : 0.3;
    const dots = getFrequencyDots(confidence);
    const colorClass = getFrequencyColor(confidence);
    return (
      <div className="flex items-center mt-1">
        <div className="flex space-x-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i < dots ? colorClass : "bg-[color:var(--md-sys-color-outline-variant)]"
              }`}
            />
          ))}
        </div>
        <span className="ml-2 md3-label-small text-[color:var(--md-sys-color-on-surface-variant)]">
          {formatFrequencyText(item.averageFrequency)}
        </span>
      </div>
    );
  };
  
  const swipeStyle = {
    transform: `translateX(${swipeProgress}px)`,
    backgroundColor: `rgba(0, 109, 61, ${Math.abs(swipeProgress) / 150})`,
    transition: 'transform 0.1s ease-out, background-color 0.1s ease-out'
  };

  return (
    <div {...handlers} className={`md3-surface-container md3-elevation-1 rounded-2xl`} style={isMarketMode ? swipeStyle : {}}>
      <div className="p-3 flex items-center gap-3 bg-inherit rounded-2xl">
        {isMarketMode && (
          <div
            onClick={() => onPurchase(item)}
            className="w-8 h-8 border-2 border-[color:var(--md-sys-color-outline)] rounded-lg flex-shrink-0 cursor-pointer flex items-center justify-center transition-all duration-200 hover:bg-[color:var(--md-sys-color-surface-container-highest)]"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className={`capitalize truncate ${isMarketMode ? 'md3-title-large' : 'md3-title-medium'}`}>{item.name}</h3>
          {!isMarketMode && (
            <>
              <div className="flex items-center gap-2 md3-body-small text-[color:var(--md-sys-color-on-surface-variant)]">
                <span>{item.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(item.dateAdded), "dd MMM", { locale: it })}</span>
              </div>
              {renderFrequencyIndicator(item)}
            </>
          )}
        </div>
        
        <div className="flex items-center">
          {isMarketMode ? (
            <div className="w-10 h-10 flex items-center justify-center text-[color:var(--md-sys-color-primary)]"><Check className="w-6 h-6" /></div>
          ) : (
            <button
              onClick={() => onDelete(item.id!)}
              className="md3-button-text text-[color:var(--md-sys-color-error)] !p-0 w-10 h-10 flex items-center justify-center"
              aria-label="Elimina prodotto"
            ><Trash2 className="w-5 h-5" /></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ShoppingList({ isMarketMode, activeListId, activeStoreId, categoryOrder }: ShoppingListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: items = [], isLoading } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
        if (!activeListId) return [];
        const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
        return res.json();
    },
    enabled: !!activeListId,
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      if (!navigator.onLine) {
        addDeleteToOfflineQueue(itemId);
        return { offline: true };
      }
      await apiRequest("DELETE", `/api/items/${itemId}`);
      return { offline: false };
    },
    onMutate: async (itemId: number) => {
      await queryClient.cancelQueries({ queryKey: ["shoppingItems", activeListId] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["shoppingItems", activeListId]);
      queryClient.setQueryData<ShoppingItem[]>(["shoppingItems", activeListId], (old) =>
        old ? old.filter((item) => item.id !== itemId) : []
      );
      return { previousItems };
    },
    onSuccess: (data, itemId) => {
      if (data.offline) {
        toast({ title: "Prodotto rimosso offline", description: "La cancellazione sarà sincronizzata." });
      } else {
        toast({ title: "Prodotto rimosso" });
      }
    },
    onError: (err, itemId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["shoppingItems", activeListId], context.previousItems);
      }
      toast({ title: "Errore", description: "Impossibile cancellare il prodotto.", variant: "destructive" });
    },
    onSettled: (data) => {
      if (data && !data.offline) {
        queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      }
    },
  });

  const purchaseItemMutation = useMutation({
    mutationFn: async (itemToPurchase: ShoppingItem) => {
      if (!user) throw new Error("Utente non autenticato.");
      if (!navigator.onLine) {
        addPurchaseToOfflineQueue(itemToPurchase.id!, user.id, activeStoreId);
        return { offline: true };
      }
      await apiRequest("POST", `/api/items/${itemToPurchase.id}/purchase`, { storeId: activeStoreId });
      return { offline: false };
    },
    onMutate: async (itemToPurchase: ShoppingItem) => {
      await queryClient.cancelQueries({ queryKey: ["shoppingItems", activeListId] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["shoppingItems", activeListId]);
      queryClient.setQueryData<ShoppingItem[]>(["shoppingItems", activeListId], (old) =>
        old ? old.filter((item) => item.id !== itemToPurchase.id) : []
      );
      return { previousItems };
    },
    onSuccess: (data, item) => {
      if (navigator.vibrate) navigator.vibrate(50);
      if (data.offline) {
        toast({ title: `"${item.name}" acquistato offline`, description: "Verrà sincronizzato." });
      } else {
        toast({ title: `"${item.name}" acquistato!` });
      }
    },
    onError: (err, itemToPurchase, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["shoppingItems", activeListId], context.previousItems);
      }
      toast({ title: "Errore di Sincronizzazione", description: "Impossibile acquistare il prodotto.", variant: "destructive" });
    },
    onSettled: (data, error) => {
      if (data && !data.offline && !error) {
        queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
        queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
      }
    },
  });

  if (isLoading) return (
      <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--md-sys-color-primary)]" />
      </div>
  );

  const activeItems = items.filter(item => !item.isCompleted);
  
  const groupedItems = isMarketMode
    ? Object.entries(
        activeItems.reduce((groups, item) => {
          const category = item.category || "Altri";
          if (!groups[category]) groups[category] = [];
          groups[category].push(item);
          return groups;
        }, {} as Record<string, ShoppingItem[]>)
      ).sort(([catA], [catB]) => {
        if (categoryOrder && categoryOrder.length > 0) {
            const indexA = categoryOrder.indexOf(catA);
            const indexB = categoryOrder.indexOf(catB);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
        }
        return catA.localeCompare(catB);
      })
    : [];

  if (activeItems.length === 0 && !isLoading) return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 md3-surface-variant rounded-full flex items-center justify-center mx-auto mb-6">
        <ShoppingBasket className="w-10 h-10" />
      </div>
      <h3 className="md3-headline-small mb-3">Lista completata!</h3>
      <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)]">
        Hai comprato tutto. Usa il form in alto per aggiungere nuovi prodotti.
      </p>
    </div>
  );

  return (
    <div className="p-4 space-y-6">
      {isMarketMode ? (
        <div className="space-y-6">
          {groupedItems.map(([category, categoryItems]) => (
            <div key={category}>
              <div className="flex justify-between items-center px-2 mb-2">
                <h2 className="md3-title-medium capitalize">{category}</h2>
                <span className="md3-label-large md3-secondary-container px-3 py-1 rounded-full">{categoryItems.length}</span>
              </div>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <ShoppingItemRow 
                    key={item.id} 
                    item={item} 
                    isMarketMode={true} 
                    onPurchase={purchaseItemMutation.mutate}
                    onDelete={deleteItemMutation.mutate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center px-2">
            <h2 className="md3-title-medium">Da comprare</h2>
            <span className="md3-label-large md3-secondary-container px-3 py-1 rounded-full">{activeItems.length} {activeItems.length === 1 ? 'prodotto' : 'prodotti'}</span>
          </div>
          <div className="space-y-3">
            {activeItems.map((item) => (
              <ShoppingItemRow 
                key={item.id} 
                item={item} 
                isMarketMode={false} 
                onPurchase={purchaseItemMutation.mutate}
                onDelete={deleteItemMutation.mutate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}