// FILE: client/src/pages/home.tsx

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  FileText, History, Lightbulb, Zap, ShoppingBasket, ShoppingCart, Settings, Plus, LogOut, Loader2,
  MapPin, Store as StoreIcon, Edit, Share2, X as XIcon
} from "lucide-react";
import { Link } from "wouter";
import ModeToggle from "@/components/mode-toggle";
import ShoppingList from "@/components/shopping-list";
import AddItemForm from "@/components/add-item-form";
import PurchaseHistory from "@/components/purchase-history";
import SmartSuggestions from "@/components/smart-suggestions";
import ProductMatching from "@/components/product-matching";
import { ShoppingCartView } from "@/components/shopping-cart";
import { UpdateNicknameDialog } from "@/components/update-nickname-dialog";
import { ShareListDialog } from "@/components/ShareListDialog";

import { useAuth } from "@/hooks/use-auth";
import type { ShoppingList as ShoppingListType, Store, ShoppingItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { processOfflineQueue, getOfflineQueue } from "@/lib/offline-queue";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const newListSchema = z.object({
  name: z.string().min(1, "Il nome della lista e' obbligatorio.").max(50, "Il nome non puo' superare i 50 caratteri."),
});
type NewListFormValues = z.infer<typeof newListSchema>;

// Componente dedicato per la Market Mode
const MarketModeView = ({
  onExit,
  activeListId,
  activeStore,
  categoryOrder,
  items
}: {
  onExit: () => void;
  activeListId: number;
  activeStore: Store | null;
  categoryOrder: string[];
  items: ShoppingItem[];
}) => {
  const totalItems = items.length;
  const completedItems = items.filter(i => i.isCompleted).length;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <header className="border-b sticky top-0 z-40 bg-card p-3">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={onExit}>
            <XIcon className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Modalità Spesa</p>
            {activeStore ? (
              <p className="font-semibold flex items-center gap-1"><StoreIcon size={14}/>{activeStore.name}</p>
            ) : (
              <p className="font-semibold flex items-center gap-1 text-muted-foreground"><StoreIcon size={14}/>Ordinamento Standard</p>
            )}
          </div>
          <div className="text-sm font-semibold bg-secondary text-secondary-foreground rounded-full px-3 py-1 w-20 text-center">
            {completedItems} / {totalItems}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <ShoppingList 
          isMarketMode={true} 
          activeListId={activeListId} 
          activeStoreId={activeStore?.id ?? null} 
          categoryOrder={categoryOrder} 
        />
      </main>
    </div>
  )
}

export default function Home() {
  const { user, logout, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"lista" | "storico" | "matching" | "carrello">("lista");
  const [isMarketMode, setIsMarketMode] = useState(false);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);

  const form = useForm<NewListFormValues>({ resolver: zodResolver(newListSchema), defaultValues: { name: "" } });

  const { data: lists = [], isLoading: isLoadingLists } = useQuery<ShoppingListType[]>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("GET", "/api/lists").then(res => res.json()),
    enabled: !!user,
  });

  // Query per gli item della lista attiva
  const { data: shoppingItems = [] } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: () => apiRequest("GET", `/api/lists/${activeListId}/items`).then(res => res.json()),
    enabled: !!activeListId,
  });

  const createListMutation = useMutation({
    mutationFn: (newList: NewListFormValues): Promise<ShoppingListType> => apiRequest("POST", "/api/lists", newList).then(res => res.json()),
    onSuccess: (newList) => {
        toast({ title: "Lista creata!", description: `La lista "${newList.name}" e' stata creata.` });
        queryClient.invalidateQueries({ queryKey: ['lists'] });
        setActiveListId(newList.id);
        setIsAddListDialogOpen(false);
        form.reset();
    },
    onError: (error: any) => toast({ title: "Errore", description: error.message, variant: "destructive" })
  });

  const onAddListSubmit = (data: NewListFormValues) => createListMutation.mutate(data);
  
  useEffect(() => {
    if (isLoadingLists) return;
    if (lists && lists.length > 0) {
        const currentListExists = lists.some(l => l.id === activeListId);
        if (!activeListId || !currentListExists) setActiveListId(lists[0].id);
    } else { setActiveListId(null); }
  }, [lists, activeListId, isLoadingLists]);

  const activeList = lists.find(list => list.id === activeListId);
  const isOwner = user && activeList && user.id === activeList.ownerId;

  useEffect(() => {
    const trySync = async () => {
      if (isAuthLoading || !isAuthenticated || !navigator.onLine) return;
      const result = await processOfflineQueue();
      if (result.success > 0) {
        toast({ title: "Sincronizzazione completata!", description: `${result.success} azioni offline sono state salvate.` });
        queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
        queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
      }
      setPendingSyncs(getOfflineQueue().length);
    };
    const updatePendingSyncs = () => setPendingSyncs(getOfflineQueue().length);
    trySync();
    window.addEventListener('online', trySync);
    window.addEventListener('offline', updatePendingSyncs);
    return () => {
      window.removeEventListener('online', trySync);
      window.removeEventListener('offline', updatePendingSyncs);
    };
  }, [activeListId, queryClient, toast, isAuthenticated, isAuthLoading]);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logout effettuato con successo." });
  };
  
  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    toast({ title: "Ricerca GPS in corso..." });
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
      const coords = import.meta.env.DEV ? { latitude: 45.4582, longitude: 9.1633 } : position.coords;
      if(import.meta.env.DEV) toast({ title: "Modalita' Sviluppo", description: "Utilizzo coordinate di test." });
      
      const foundStores: Store[] = await apiRequest("POST", "/api/check-in", { latitude: coords.latitude, longitude: coords.longitude }).then(res => res.json());
      
      if (foundStores.length === 0) {
        toast({ title: "Nessun negozio trovato nelle vicinanze", duration: 5000 });
        setActiveStore(null);
        setCategoryOrder([]);
      } else if (foundStores.length === 1) {
        await handleStoreSelect(foundStores[0]);
      } else {
        setNearbyStores(foundStores);
        setIsStoreSelectorOpen(true);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore GPS", description: error.message });
      setIsMarketMode(false);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleStoreSelect = async (store: Store) => {
    setIsStoreSelectorOpen(false);
    setActiveStore(store);
    toast({ title: `Check-in effettuato!`, description: `Ottimizzazione per ${store.name}.` });
    try {
      const { categoryOrder: newOrder } = await apiRequest("GET", `/api/stores/${store.id}/layout`).then(res => res.json());
      if (newOrder?.length > 0) {
        setCategoryOrder(newOrder);
        toast({ title: "Lista ottimizzata!" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare il layout del negozio." });
    }
  };

  const handleToggleMode = (newMode: boolean) => {
    if (isCheckingIn) return;
    setIsMarketMode(newMode);
    if (newMode && navigator.onLine) handleCheckIn();
    else if (!newMode) { setActiveStore(null); setCategoryOrder([]); }
  };

  const tabs = useMemo(() => [
    { id: "lista", label: "Lista", icon: FileText },
    { id: "storico", label: "Storico", icon: History },
    { id: "matching", label: "Matching", icon: Zap },
    { id: "carrello", label: "Carrello", icon: ShoppingBasket },
  ], []);

  const renderContent = () => {
    if (isLoadingLists || isAuthLoading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!activeListId) {
      return (
        <div className="text-center py-16 px-4">
          <h3 className="text-xl font-semibold mb-3">Benvenuto!</h3>
          <p className="text-muted-foreground">Crea la tua prima lista per iniziare.</p>
        </div>
      );
    }

    switch (activeTab) {
      case "lista": return <ShoppingList isMarketMode={false} activeListId={activeListId} activeStoreId={null} categoryOrder={[]} />;
      case "storico": return <PurchaseHistory activeListId={activeListId} />;
      case "matching": return <ProductMatching activeListId={activeListId} onNavigateToCart={() => setActiveTab("carrello")} />;
      case "carrello": return <ShoppingCartView activeListId={activeListId} />;
      default: return <div className="p-4">Sezione in costruzione.</div>;
    }
  };

  if (isMarketMode) {
    return <MarketModeView 
      onExit={() => handleToggleMode(false)} 
      activeListId={activeListId!} 
      activeStore={activeStore} 
      categoryOrder={categoryOrder}
      items={shoppingItems}
    />;
  }

  return (
    <>
      <div className="flex flex-col h-full w-full bg-background">
        <header className="border-b sticky top-0 z-40 bg-card">
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-shrink min-w-0">
                <div className="w-10 h-10 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-md flex-shrink-0"><ShoppingCart className="w-5 h-5" /></div>
                <div className="flex items-center gap-1 truncate">
                  <div className="truncate">
                    <p className="text-sm text-muted-foreground">Ciao, {user?.nickname || user?.email?.split('@')[0] || 'Utente'}</p>
                    <p className="font-semibold truncate">{activeList?.name || 'Nessuna lista'}</p>
                  </div>
                  {user && (<Button onClick={() => setIsNicknameDialogOpen(true)} variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"><Edit className="w-4 h-4" /></Button>)}
                </div>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                <Button onClick={handleLogout} variant="ghost" size="icon" title="Logout"><LogOut className="w-5 h-5" /></Button>
                <Link href="/admin"><Button variant="ghost" size="icon" title="Admin"><Settings className="w-5 h-5" /></Button></Link>
              </div>
            </div>
            {pendingSyncs > 0 && (<div className="flex items-center justify-center"><Badge variant="destructive">{pendingSyncs} azioni in attesa di sincronizzazione</Badge></div>)}
            <div className="flex items-center justify-between gap-2">
               <div className="flex-1">
                  <Select value={activeListId ? activeListId.toString() : ""} onValueChange={(value) => setActiveListId(Number(value))}>
                      <SelectTrigger className="h-12 rounded-full text-base">
                          <SelectValue placeholder="Seleziona una lista..." />
                      </SelectTrigger>
                      <SelectContent>
                          {lists.map(list => (<SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>))}
                      </SelectContent>
                  </Select>
               </div>
               <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => setIsAddListDialogOpen(true)} title="Crea nuova lista"><Plus className="w-5 h-5" /></Button>
                    {isOwner && activeList && (<ShareListDialog activeListId={activeList.id} listName={activeList.name} />)}
                    <ModeToggle isMarketMode={isMarketMode} onToggle={handleToggleMode} />
               </div>
            </div>
          </div>
        </header>

        {/* --- MODIFICA CHIAVE QUI --- */}
        <main className="flex-1 overflow-y-auto pb-28">
          {activeTab === 'lista' ? (
             <div className={cn("p-4", "lg:grid lg:grid-cols-3 lg:gap-8")}>
                <div className="lg:col-span-2">
                  <AddItemForm isMarketMode={false} activeListId={activeListId!} />
                  <ShoppingList isMarketMode={false} activeListId={activeListId!} activeStoreId={null} categoryOrder={[]} />
                </div>
                <div className="lg:col-span-1">
                  <SmartSuggestions activeListId={activeListId} />
                </div>
            </div>
          ) : renderContent()}
        </main>

        <nav className="bg-card border-t fixed bottom-0 left-0 right-0 h-20 px-2 pt-3 z-50 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-around items-start h-full">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center gap-1 w-16 h-16 transition-all duration-200 rounded-2xl`}>
                  <div className={cn("flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300", isActive ? "bg-secondary text-secondary-foreground" : "")}>
                    <IconComponent className={cn("w-6 h-6 transition-colors duration-200", !isActive && "text-muted-foreground")} />
                  </div>
                  <span className={cn("text-sm font-medium transition-colors duration-200", !isActive && "text-muted-foreground")}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {!isMarketMode && activeTab === "lista" && (
          <div className="fixed bottom-24 right-6 z-40">
            <Button onClick={() => document.getElementById('add-form')?.scrollIntoView({ behavior: 'smooth' })} className="h-14 w-14 rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-transform" aria-label="Aggiungi nuovo prodotto">
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        )}
      </div>
      
      {user && (<UpdateNicknameDialog user={user} open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen} />)}
      
      <Dialog open={isStoreSelectorOpen} onOpenChange={setIsStoreSelectorOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>In quale negozio ti trovi?</DialogTitle><DialogDescription>Abbiamo trovato questi supermercati vicino a te. Selezionane uno per ottimizzare la tua lista.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2 pt-4">
            {nearbyStores.map(store => (
              <Button key={store.id} variant="outline" className="justify-start h-auto py-3" onClick={() => handleStoreSelect(store)}>
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">{store.name}</p>
                    <p className="text-xs text-muted-foreground">{store.address}</p>
                  </div>
                </div>
              </Button>
            ))}
             <Button variant="ghost" onClick={() => { setIsStoreSelectorOpen(false); setActiveStore(null); setCategoryOrder([]); }}>Nessuno di questi</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAddListDialogOpen} onOpenChange={setIsAddListDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Crea una nuova lista</DialogTitle><DialogDescription>Inserisci un nome per la tua nuova lista della spesa.</DialogDescription></DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddListSubmit)} className="space-y-4 py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome della lista</FormLabel><FormControl><Input placeholder="Es: Spesa settimanale" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Annulla</Button></DialogClose>
                        <Button type="submit" disabled={createListMutation.isPending}>{createListMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crea Lista</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}