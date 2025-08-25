import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trash2, ShoppingBasket, Calendar, Check, Loader2, Pencil, Save, X, CheckCircle, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ToastAction } from "@/components/ui/toast";

interface ShoppingListProps {
  isMarketMode: boolean;
  activeListId: number;
  activeStoreId: number | null;
  categoryOrder: string[];
}

const ShoppingItemRow = ({
  item,
  isMarketMode,
  isPendingPurchase, // Nuovo stato per indicare l'attesa
  onPurchase,
  onDelete,
  onUpdate,
  onUndoPurchase,
}: {
  item: ShoppingItem;
  isMarketMode: boolean;
  isPendingPurchase: boolean;
  onPurchase: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onUpdate: (data: { id: number; name?: string; quantity?: string | null }) => void;
  onUndoPurchase: (itemId: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);
  const [editedQuantity, setEditedQuantity] = useState(item.quantity || "");

  const handleSave = () => {
    if (editedName.trim()) {
      onUpdate({ id: item.id!, name: editedName.trim(), quantity: editedQuantity.trim() || null });
      setIsEditing(false);
    }
  };
  
  const handleCancel = () => {
    setEditedName(item.name);
    setEditedQuantity(item.quantity || "");
    setIsEditing(false);
  }

  if (isMarketMode) {
    return (
      <div
        onClick={() => !isPendingPurchase && onPurchase(item)}
        className={cn(
          "flex items-center p-3 border-b transition-all duration-300",
          isPendingPurchase 
            ? "bg-slate-100" 
            : "cursor-pointer bg-white"
        )}
      >
        <div className={cn(
          "w-6 h-6 border-2 rounded-lg flex-shrink-0 flex items-center justify-center transition-all",
          isPendingPurchase 
            ? "bg-green-500 border-green-500"
            : "border-primary bg-white"
        )}>
          {isPendingPurchase && <Check className="w-4 h-4 text-white" />}
        </div>
        <div className="flex-1 min-w-0 ml-3">
          <h3 className={cn(
            "capitalize font-medium text-base leading-tight break-words",
            isPendingPurchase && "line-through text-muted-foreground"
          )}>
            {item.name}
          </h3>
          {item.quantity && <Badge variant="secondary" className="mt-1 text-xs">{item.quantity}</Badge>}
        </div>
        {isPendingPurchase && (
          <Button variant="ghost" size="sm" onClick={() => onUndoPurchase(item.id!)} className="flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4" />
            Annulla
          </Button>
        )}
      </div>
    );
  }

  // Modalità Casa
  if (isEditing) {
    return (
      <div className="p-2 border rounded-lg bg-background">
        <div className="space-y-2">
          <Input 
            value={editedName} 
            onChange={(e) => setEditedName(e.target.value)} 
            placeholder="Nome prodotto" 
            className="h-9" 
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Input 
            value={editedQuantity} 
            onChange={(e) => setEditedQuantity(e.target.value)} 
            placeholder="Quantità (es. 1kg, 6x)" 
            className="h-9" 
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-1 pt-1">
            <Button variant="ghost" size="sm" onClick={handleCancel}><X className="w-4 h-4 mr-1"/>Annulla</Button>
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1"/>Salva</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 flex items-center gap-2 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="capitalize font-medium text-base">{item.name}</h3>
            {item.quantity && <Badge variant="secondary" className="text-xs">{item.quantity}</Badge>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(item.dateAdded), "dd MMM", { locale: it })}</span>
          </div>
        </div>
        <div className="flex items-center gap-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(item)}><Trash2 className="w-4 h-4" /></Button>
        </div>
    </div>
  );
};

export default function ShoppingList({ isMarketMode, activeListId, activeStoreId, categoryOrder }: ShoppingListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // --- MODIFICA 1: Rinominiamo e adattiamo gli stati pendenti ---
  const [pendingPurchaseItems, setPendingPurchaseItems] = useState<number[]>([]);
  const purchaseTimers = useRef<Record<number, NodeJS.Timeout>>({});
  
  const [itemsPendingDeletion, setItemsPendingDeletion] = useState<number[]>([]);
  const deletionTimers = useRef<Record<number, NodeJS.Timeout>>({});

  const { data: items = [], isLoading } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
      if (!activeListId) return [];
      const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
      return res.json();
    },
    enabled: !!activeListId,
  });

  const visibleItems = useMemo(
    () => items.filter(item => !itemsPendingDeletion.includes(item.id!)),
    [items, itemsPendingDeletion]
  );
  
  // --- MODIFICA 2: La lista attiva ora filtra anche gli item in attesa di acquisto (che verranno rimossi dopo 5s) ---
  const activeItems = useMemo(
    () => visibleItems.filter(item => !item.isCompleted && !pendingPurchaseItems.includes(item.id!)), 
    [visibleItems, pendingPurchaseItems]
  );

  const groupedItems = useMemo(() => {
    return Object.entries(
      visibleItems.reduce((groups, item) => {
        const category = item.category || "Altro";
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
      if (catA === "Altro") return 1;
      if (catB === "Altro") return -1;
      return catA.localeCompare(catB);
    });
  }, [visibleItems, categoryOrder]);

  const purchaseItemMutation = useMutation({
    mutationFn: (itemToPurchase: ShoppingItem) => apiRequest("POST", `/api/items/${itemToPurchase.id!}/purchase`, { storeId: activeStoreId }),
    onSuccess: (_, item) => {
      // Rimuoviamo l'item dalla lista di attesa e invalidiamo la query per aggiornare la UI
      setPendingPurchaseItems(prev => prev.filter(id => id !== item.id!));
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
    },
    onError: (err, item) => {
      toast({ title: "Errore di Sincronizzazione", description: "Impossibile salvare l'acquisto.", variant: "destructive" });
      // Rollback: se l'acquisto fallisce, l'item riappare nella lista
      setPendingPurchaseItems(prev => prev.filter(id => id !== item.id!));
    },
  });

  // --- MODIFICA 3: Logica di acquisto aggiornata per il nuovo flusso ---
  const handlePurchase = (itemToPurchase: ShoppingItem) => {
    if (navigator.vibrate) navigator.vibrate(50);
    const itemId = itemToPurchase.id!;
    
    // 1. Sposta l'item nello stato di attesa (diventa grigio)
    setPendingPurchaseItems(prev => [...prev, itemId]);

    // 2. Imposta il timer per l'acquisto definitivo
    const timer = setTimeout(() => {
      purchaseItemMutation.mutate(itemToPurchase);
      delete purchaseTimers.current[itemId];
    }, 5000); // 5 secondi

    purchaseTimers.current[itemId] = timer;
  };

  const handleUndoPurchase = (itemId: number) => {
    // 1. Cancella il timer per prevenire l'acquisto
    clearTimeout(purchaseTimers.current[itemId]);
    delete purchaseTimers.current[itemId];

    // 2. Rimuovi l'item dallo stato di attesa, facendolo tornare normale
    setPendingPurchaseItems(prev => prev.filter(id => id !== itemId));
  };

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: number; name?: string; quantity?: string | null }) => {
      const { id, ...updateData } = data;
      return apiRequest("PUT", `/api/items/${id}`, updateData);
    },
    onSuccess: () => {
      toast({ title: "Prodotto aggiornato!" });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
    },
    onError: (error: any) => toast({ title: "Errore", description: error.message || "Impossibile aggiornare il prodotto", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
    },
    onError: (error, itemId) => {
      toast({ title: "Errore", description: "Impossibile cancellare il prodotto.", variant: "destructive" });
      setItemsPendingDeletion(prev => prev.filter(id => id !== itemId));
    },
  });

  const handleUndoDelete = (itemId: number) => {
    clearTimeout(deletionTimers.current[itemId]);
    delete deletionTimers.current[itemId];
    setItemsPendingDeletion(prev => prev.filter(id => id !== itemId));
  };

  const handleInitiateDelete = (item: ShoppingItem) => {
    const itemId = item.id!;
    setItemsPendingDeletion(prev => [...prev, itemId]);
    const timer = setTimeout(() => {
      deleteItemMutation.mutate(itemId);
      delete deletionTimers.current[itemId];
    }, 2500);
    deletionTimers.current[itemId] = timer;
    toast({
      title: "Prodotto rimosso",
      description: `"${item.name}" è stato rimosso dalla lista.`,
      action: (
        <ToastAction altText="Annulla" onClick={() => handleUndoDelete(itemId)}>
          Annulla
        </ToastAction>
      ),
    });
  };

  if (isLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // --- MODIFICA 4: La condizione di "spesa completata" ora si basa sulla nuova `activeItems` ---
  if (activeItems.length === 0 && !isLoading) return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"><ShoppingBasket className="w-10 h-10 text-muted-foreground" /></div>
      <h3 className="text-xl font-semibold mb-3">Spesa Completata!</h3>
      <p className="text-muted-foreground">Hai preso tutto. Ottimo lavoro!</p>
    </div>
  );

  return (
    <div className={cn(!isMarketMode && "space-y-2")}>
      {/* --- MODIFICA 5: La logica di rendering è semplificata, non c'è più la sezione "Completati" --- */}
      {groupedItems.map(([category, categoryItems]) => (
        <div key={`${category}-active`}>
          <h3 className="text-xs font-bold uppercase text-muted-foreground px-2 py-1.5 mt-2 bg-slate-50 border-b sticky top-0 z-10">
            {category}
          </h3>
          <div className={cn(isMarketMode ? "bg-white shadow-sm" : "space-y-1 pt-1")}>
            {categoryItems.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={item}
                isMarketMode={isMarketMode}
                isPendingPurchase={pendingPurchaseItems.includes(item.id!)}
                onPurchase={handlePurchase}
                onDelete={handleInitiateDelete}
                onUpdate={updateItemMutation.mutate}
                onUndoPurchase={handleUndoPurchase}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}