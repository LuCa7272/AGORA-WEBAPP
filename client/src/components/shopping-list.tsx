import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Trash2, ShoppingBasket, Calendar, Check, Loader2, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingItem } from "@shared/schema";
import { useSwipeable } from "react-swipeable";
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
  AlertDialogTrigger,
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
  onPurchase,
  onDelete,
  onUpdate,
}: {
  item: ShoppingItem;
  isMarketMode: boolean;
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

  const handlers = useSwipeable({
    onSwipedLeft: () => isMarketMode && onPurchase(item),
    onSwipedRight: () => isMarketMode && onPurchase(item),
    trackMouse: true,
  });

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
    <Card {...handlers} className="transition-all duration-100">
      <CardContent className={cn("p-3 flex items-center gap-3", isMarketMode && "py-4")}>
        {isMarketMode && (
          <div onClick={() => onPurchase(item)} className="w-8 h-8 border-2 rounded-lg flex-shrink-0 cursor-pointer flex items-center justify-center transition-all border-primary hover:bg-accent/20" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("capitalize truncate font-semibold", isMarketMode ? 'text-xl' : 'text-base')}>{item.name}</h3>
            {item.quantity && <Badge variant="secondary">{item.quantity}</Badge>}
          </div>
          {!isMarketMode && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(item.dateAdded), "dd MMM", { locale: it })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isMarketMode ? (
            <div className="w-10 h-10 flex items-center justify-center text-green-500"><Check className="w-6 h-6" /></div>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsEditing(true)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(item.id!)}><Trash2 className="w-4 h-4" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ShoppingList({ isMarketMode, activeListId, activeStoreId, categoryOrder }: ShoppingListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const { data: items = [], isLoading } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: async () => {
      if (!activeListId) return [];
      const res = await apiRequest("GET", `/api/lists/${activeListId}/items`);
      return res.json();
    },
    enabled: !!activeListId,
  });

  const activeItems = items.filter(item => !item.isCompleted);

  const groupedItems = useMemo(() => {
    return Object.entries(
      activeItems.reduce((groups, item) => {
        const category = item.category || "Senza Categoria";
        if (!groups[category]) groups[category] = [];
        groups[category].push(item);
        return groups;
      }, {} as Record<string, ShoppingItem[]>)
    ).sort(([catA], [catB]) => {
      if (isMarketMode && categoryOrder && categoryOrder.length > 0) {
        const indexA = categoryOrder.indexOf(catA);
        const indexB = categoryOrder.indexOf(catB);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }
      if (catA === "Senza Categoria") return 1;
      if (catB === "Senza Categoria") return -1;
      return catA.localeCompare(catB);
    });
  }, [activeItems, isMarketMode, categoryOrder]);

  useEffect(() => {
    const newCategories = groupedItems.map(([category]) => category);
    setOpenCategories(prevOpen => {
      const allCategories = new Set([...prevOpen, ...newCategories]);
      return Array.from(allCategories);
    });
  }, [groupedItems]);

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

  const purchaseItemMutation = useMutation({
    mutationFn: (itemToPurchase: ShoppingItem) => apiRequest("POST", `/api/items/${itemToPurchase.id!}/purchase`, { storeId: activeStoreId }),
    onMutate: async (itemToPurchase: ShoppingItem) => {
      await queryClient.cancelQueries({ queryKey: ["shoppingItems", activeListId] });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(["shoppingItems", activeListId]) || [];
      if (isMarketMode) {
        const isLastItemInCategory = previousItems.filter(item => item.category === itemToPurchase.category && !item.isCompleted).length === 1;
        if (isLastItemInCategory) { setOpenCategories(prev => prev.filter(cat => cat !== itemToPurchase.category)); }
      }
      queryClient.setQueryData<ShoppingItem[]>(["shoppingItems", activeListId], old => old ? old.filter(item => item.id !== itemToPurchase.id) : []);
      return { previousItems };
    },
    onSuccess: (data, item) => {
      if (navigator.vibrate) navigator.vibrate(50);
      toast({ title: `"${item.name}" acquistato!` });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
    },
    onError: (err, item, context) => {
      if (context?.previousItems) { queryClient.setQueryData(["shoppingItems", activeListId], context.previousItems); }
      toast({ title: "Errore di Sincronizzazione", variant: "destructive" });
    },
  });

  const clearListMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/lists/${activeListId}/items`),
    onSuccess: () => {
      toast({ title: "Lista svuotata!", description: "Tutti i prodotti sono stati rimossi." });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile svuotare la lista.", variant: "destructive" });
    },
  });

  if (isLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (activeItems.length === 0 && !isLoading) return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6"><ShoppingBasket className="w-10 h-10 text-muted-foreground" /></div>
      <h3 className="text-xl font-semibold mb-3">Lista completata!</h3>
      <p className="text-muted-foreground">Hai comprato tutto. Usa il form in alto per aggiungere nuovi prodotti.</p>
    </div>
  );

  return (
    <div className="space-y-4 pt-4">
       <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{isMarketMode ? "Modalità Spesa" : "Da Comprare"}</h2>
              <Badge variant="secondary">{activeItems.length} prodotti</Badge>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Svuota lista" className="h-8 w-8 text-muted-foreground" disabled={activeItems.length === 0}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro di voler svuotare la lista?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione è irreversibile. Tutti i {activeItems.length} prodotti verranno rimossi permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => clearListMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Svuota Lista
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
       </div>
      <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="w-full">
        {groupedItems.map(([category, categoryItems]) => (
          <AccordionItem value={category} key={category} className={cn(!openCategories.includes(category) && "opacity-50")}>
            <AccordionTrigger className="text-base font-medium capitalize hover:no-underline">
              <div className="flex items-center gap-2">
                {!openCategories.includes(category) && <Check className="w-5 h-5 text-green-500"/>}
                {category}
                <Badge variant={openCategories.includes(category) ? "outline" : "default"}>{categoryItems.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    isMarketMode={isMarketMode}
                    onPurchase={purchaseItemMutation.mutate}
                    onDelete={deleteItemMutation.mutate}
                    onUpdate={updateItemMutation.mutate}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}