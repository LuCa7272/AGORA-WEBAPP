// FILE: client/src/components/shopping-list.tsx

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trash2, ShoppingBasket, Calendar, Check, Loader2, Pencil, Save, X, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingItem } from "@shared/schema";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ShoppingListProps {
  isMarketMode: boolean;
  activeListId: number;
  activeStoreId: number | null;
  categoryOrder: string[];
}

const ShoppingItemRow = ({
  item,
  isMarketMode,
  isCompleted, // --- NUOVA PROP: per gestire lo stato visivo
  onPurchase,
  onDelete,
  onUpdate,
}: {
  item: ShoppingItem;
  isMarketMode: boolean;
  isCompleted: boolean; // --- NUOVA PROP
  onPurchase: (item: ShoppingItem) => void;
  onDelete: (itemId: number) => void;
  onUpdate: (data: { id: number; name?: string; quantity?: string | null }) => void;
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
      <Card
        onClick={() => !isCompleted && onPurchase(item)}
        className={cn(
          "transition-all duration-300 active:scale-95",
          isCompleted 
            ? "bg-slate-100 opacity-60" 
            : "cursor-pointer bg-white"
        )}
      >
        <CardContent className="p-4 flex items-start gap-4">
          <div className={cn(
            "w-8 h-8 border-2 rounded-lg flex-shrink-0 flex items-center justify-center transition-all",
            isCompleted 
              ? "bg-green-500 border-green-500"
              : "border-primary bg-white"
          )}>
            {isCompleted && <Check className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h3 className={cn(
              "capitalize font-semibold text-lg leading-tight break-words",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {item.name}
            </h3>
            {item.quantity && <Badge variant="secondary" className="mt-1.5">{item.quantity}</Badge>}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Logica per la modalità Casa (invariata) ---
  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-3 space-y-2">
          <Input 
            value={editedName} 
            onChange={(e) => setEditedName(e.target.value)} 
            placeholder="Nome prodotto" 
            className="h-10" 
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <Input 
            value={editedQuantity} 
            onChange={(e) => setEditedQuantity(e.target.value)} 
            placeholder="Quantità (es. 1kg, 6x)" 
            className="h-10" 
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}><X className="w-4 h-4 mr-1"/>Annulla</Button>
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1"/>Salva</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition-all duration-100">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="capitalize font-semibold text-base">{item.name}</h3>
            {item.quantity && <Badge variant="secondary">{item.quantity}</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(item.dateAdded), "dd MMM", { locale: it })}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(item.id!)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ShoppingList({ isMarketMode, activeListId, activeStoreId, categoryOrder }: ShoppingListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [completedItems, setCompletedItems] = useState<Record<number, boolean>>({});

  const { data: items = [], isLoading } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
      if (!activeListId) return [];
      const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
      return res.json();
    },
    enabled: !!activeListId,
  });

  const activeItems = useMemo(() => items.filter(item => !item.isCompleted), [items]);

  const groupedItems = useMemo(() => {
    const group = (list: ShoppingItem[]) => Object.entries(
      list.reduce((groups, item) => {
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
    
    const allGrouped = group(activeItems);
    const activeGroups = allGrouped.map(([category, items]) => {
      return [category, items.filter(item => !completedItems[item.id!])] as const;
    }).filter(([, items]) => items.length > 0);

    const completedGroups = allGrouped.map(([category, items]) => {
        return [category, items.filter(item => completedItems[item.id!])] as const;
    }).filter(([, items]) => items.length > 0);


    return { active: activeGroups, completed: completedGroups };
  }, [activeItems, completedItems, categoryOrder]);

  useEffect(() => {
    const allCategories = activeItems.map(i => i.category || "Altro");
    setOpenCategories(Array.from(new Set(allCategories)));
  }, [activeItems]);

  const purchaseItemMutation = useMutation({
    mutationFn: (itemToPurchase: ShoppingItem) => apiRequest("POST", `/api/items/${itemToPurchase.id!}/purchase`, { storeId: activeStoreId }),
    // --- MODIFICA: onSuccess gestisce l'invalidazione ---
    onSuccess: () => {
      // Invalida le query per ricaricare i dati freschi dal server
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
    },
    onError: (err, item) => {
      toast({ title: "Errore di Sincronizzazione", description: "Impossibile salvare l'acquisto.", variant: "destructive" });
      // Se fallisce, annulliamo lo stato visivo di completamento
      setCompletedItems(prev => {
        const newState = { ...prev };
        delete newState[item.id!];
        return newState;
      });
    },
  });

  const handlePurchase = (itemToPurchase: ShoppingItem) => {
    if (navigator.vibrate) navigator.vibrate(50);
    
    // 1. Aggiorna lo stato locale per un feedback visivo immediato
    setCompletedItems(prev => ({ ...prev, [itemToPurchase.id!]: true }));

    // 2. Dopo un ritardo, chiama la mutazione
    setTimeout(() => {
      purchaseItemMutation.mutate(itemToPurchase);
    }, 2000); // Ritardo aumentato a 2 secondo
  };
  
  // Rileva quando una categoria attiva viene svuotata
  useEffect(() => {
    if (isMarketMode) {
      const activeCategoryNames = groupedItems.active.map(([name]) => name);
      // Chiudi solo le categorie che non hanno più item attivi
      setOpenCategories(prevOpen => prevOpen.filter(cat => activeCategoryNames.includes(cat)));
    }
  }, [groupedItems.active, isMarketMode]);

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
      toast({ title: "Prodotto rimosso" });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
    },
    onError: () => toast({ title: "Errore", description: "Impossibile cancellare il prodotto.", variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (activeItems.length === 0 && !isLoading) return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"><ShoppingBasket className="w-10 h-10 text-muted-foreground" /></div>
      <h3 className="text-xl font-semibold mb-3">Spesa Completata!</h3>
      <p className="text-muted-foreground">Hai preso tutto. Ottimo lavoro!</p>
    </div>
  );

  return (
    <div className="space-y-4 pt-4 px-4 pb-8">
      <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full space-y-4">
        {groupedItems.active.map(([category, categoryItems]) => (
          <AccordionItem value={category} key={`${category}-active`} className="border-none">
            <AccordionTrigger className="text-lg font-bold capitalize hover:no-underline px-2 py-1 border-b-2 border-slate-200">
              <div className="flex items-center gap-2">
                {category}
                <Badge variant="outline">{categoryItems.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-3">
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    isMarketMode={isMarketMode}
                    isCompleted={!!completedItems[item.id!]}
                    onPurchase={handlePurchase}
                    onDelete={deleteItemMutation.mutate}
                    onUpdate={updateItemMutation.mutate}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
        {isMarketMode && groupedItems.completed.length > 0 && (
          <div className="pt-4">
            <h3 className="px-2 text-lg font-bold text-muted-foreground flex items-center gap-2"><CheckCircle className="text-green-500"/>Completati</h3>
            <div className="space-y-4 mt-2">
               {groupedItems.completed.map(([category, categoryItems]) => (
                <div key={`${category}-completed`} className="space-y-3">
                  {categoryItems.map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      isMarketMode={true}
                      isCompleted={true}
                      onPurchase={() => {}} // Non fare nulla se giÃ  completato
                      onDelete={() => {}}
                      onUpdate={() => {}}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </Accordion>
    </div>
  );
}