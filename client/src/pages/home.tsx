import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText, History, Lightbulb, ShoppingCart, Settings, Plus, LogOut, Loader2,
  Store as StoreIcon, Edit, Share2, X as XIcon, User, Globe, ArrowLeft, Trash2
} from "lucide-react";
import { Link } from "wouter";

// Componenti UI Shadcn
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Componenti App
import ShoppingList from "@/components/shopping-list";
import AddItemForm from "@/components/add-item-form";
import PurchaseHistory from "@/components/purchase-history";
import SmartSuggestions from "@/components/smart-suggestions";
import ProductMatching from "@/components/product-matching";
import { ShoppingCartView } from "@/components/shopping-cart";
import { UpdateNicknameDialog } from "@/components/update-nickname-dialog";
import { ShareListDialog } from "@/components/ShareListDialog";

// Hooks e Libs
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { processOfflineQueue, getOfflineQueue } from "@/lib/offline-queue";
import { cn } from "@/lib/utils";
import type { ShoppingList as ShoppingListType, Store, ShoppingItem, EcommerceMatch } from "@shared/schema";

// --- MODIFICA 1: Definiamo un tipo per lo stato delle selezioni manuali ---
export type ManualSelections = { [itemName: string]: { productId: string; quantity: number } };

// Funzione helper per calcolare la distanza
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Raggio della Terra in metri
  const radLat1 = lat1 * Math.PI/180;
  const radLat2 = lat2 * Math.PI/180;
  const deltaLat = (lat2-lat1) * Math.PI/180;
  const deltaLon = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(radLat1) * Math.cos(radLat2) *
            Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metri
}

const newListSchema = z.object({
  name: z.string().min(1, "Il nome della lista è obbligatorio.").max(50, "Il nome non può superare i 50 caratteri."),
});
type NewListFormValues = z.infer<typeof newListSchema>;

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
  const activeItems = items.filter(i => !i.isCompleted);
  const completedItemsCount = items.length - activeItems.length;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50">
      <header className="border-b sticky top-0 z-40 bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={onExit} className="flex-shrink-0">
            <XIcon className="w-5 h-5" />
          </Button>
          <div className="text-center truncate">
            <p className="text-sm font-medium text-muted-foreground">Modalità Spesa</p>
            {activeStore ? (
              <p className="font-semibold flex items-center justify-center gap-1.5 truncate"><StoreIcon size={14}/>{activeStore.name}</p>
            ) : (
              <p className="font-semibold flex items-center justify-center gap-1.5 text-muted-foreground"><StoreIcon size={14}/>Ordinamento Standard</p>
            )}
          </div>
          <div className="text-sm font-semibold bg-green-500 text-white rounded-full px-3 py-1 w-20 text-center flex-shrink-0">
            {completedItemsCount} / {items.length}
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
  
  // Stati di navigazione e flusso
  const [activeTab, setActiveTab] = useState<'lista' | 'acquista'>("lista");
  const [shoppingFlow, setShoppingFlow] = useState<'selection' | 'matching' | 'cart'>('selection');
  const [isMarketMode, setIsMarketMode] = useState(false);

  // --- MODIFICA 2: "Solleviamo" lo stato delle selezioni qui ---
  const [manualSelections, setManualSelections] = useState<ManualSelections>({});

  // Stati di dati
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [proposedStore, setProposedStore] = useState<Store | null>(null);

  // Stati UI (dialoghi, caricamenti)
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [isAddListDialogOpen, setIsAddListDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const form = useForm<NewListFormValues>({ resolver: zodResolver(newListSchema), defaultValues: { name: "" } });

  const { data: lists = [], isLoading: isLoadingLists } = useQuery<ShoppingListType[]>({
    queryKey: ["lists"],
    queryFn: () => apiRequest("GET", "/api/lists").then(res => res.json()),
    enabled: !!user,
  });

  const { data: shoppingItems = [] } = useQuery<ShoppingItem[]>({
    queryKey: ["shoppingItems", activeListId],
    queryFn: () => apiRequest("GET", `/api/lists/${activeListId}/items`).then(res => res.json()),
    enabled: !!activeListId,
  });
  
  const { data: ecommerceMatches = [] } = useQuery<EcommerceMatch[]>({
    queryKey: ['/api/ecommerce/matches', 'carrefour'],
    enabled: !!user && !!activeListId,
  });

  const createListMutation = useMutation({
    mutationFn: (newList: NewListFormValues): Promise<ShoppingListType> => apiRequest("POST", "/api/lists", newList).then(res => res.json()),
    onSuccess: (newList) => {
        toast({ title: "Lista creata!", description: `La lista "${newList.name}" è stata creata.` });
        queryClient.invalidateQueries({ queryKey: ['lists'] });
        setActiveListId(newList.id);
        setIsAddListDialogOpen(false);
        form.reset();
    },
    onError: (error: any) => toast({ title: "Errore", description: error.message, variant: "destructive" })
  });
  
  const deleteListMutation = useMutation({
    mutationFn: () => {
      if (!activeListId) throw new Error("Nessuna lista selezionata.");
      return apiRequest("DELETE", `/api/lists/${activeListId}`);
    },
    onSuccess: () => {
      toast({ title: "Lista eliminata", description: "La lista è stata rimossa con successo." });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setActiveListId(null); 
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
    setShoppingFlow('selection');
    setManualSelections({}); // Resetta le selezioni quando cambia la lista
  }, [activeListId]);

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
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }));
      const userCoords = position.coords;
      
      const foundStores: Store[] = await apiRequest("POST", "/api/check-in", { latitude: userCoords.latitude, longitude: userCoords.longitude }).then(res => res.json());
      
      if (foundStores.length === 0) {
        toast({ title: "Nessun negozio trovato nelle vicinanze", description: "Entro in modalità spesa standard.", duration: 5000 });
        setActiveStore(null);
        setCategoryOrder([]);
        setIsMarketMode(true);
        return;
      }
      
      const storesWithDistance = foundStores.map(store => ({
        ...store,
        distance: haversineDistance(userCoords.latitude, userCoords.longitude, store.latitude, store.longitude)
      }));

      const veryCloseStore = storesWithDistance.find(store => store.distance <= 50);

      if (veryCloseStore) {
        setProposedStore(veryCloseStore);
        setIsConfirmationDialogOpen(true);
      } else {
        setNearbyStores(storesWithDistance);
        setIsStoreSelectorOpen(true);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore GPS", description: error.message || "Impossibile ottenere la posizione." });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleStoreSelect = async (store: Store) => {
    setIsStoreSelectorOpen(false);
    setIsConfirmationDialogOpen(false);
    setProposedStore(null);
    setActiveStore(store);
    toast({ title: `Check-in effettuato!`, description: `Ottimizzazione per ${store.name}.` });
    try {
      const { categoryOrder: newOrder } = await apiRequest("GET", `/api/stores/${store.id}/layout`).then(res => res.json());
      if (newOrder?.length > 0) {
        setCategoryOrder(newOrder);
        toast({ title: "Lista ottimizzata!" });
      } else {
        setCategoryOrder([]);
      }
      setIsMarketMode(true);
    } catch (error) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare il layout del negozio." });
    }
  };
  
  const handleNoStoreSelect = () => {
      setIsStoreSelectorOpen(false);
      setActiveStore(null);
      setCategoryOrder([]);
      setIsMarketMode(true);
  }

  const exitMarketModeAndReset = () => {
    setIsMarketMode(false);
    setActiveStore(null);
    setCategoryOrder([]);
    setProposedStore(null);
    setActiveTab('lista');
  }

  const renderShoppingFlow = () => {
    if (isCheckingIn) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
          <h2 className="text-xl font-semibold">Ricerca negozi...</h2>
          <p className="text-muted-foreground mt-2">Stiamo usando il GPS per trovare i supermercati più vicini a te.</p>
        </div>
      );
    }
  
    switch (shoppingFlow) {
      case 'selection':
        return (
          <div className="p-4 md:p-6 space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Come vuoi fare la spesa?</h1>
              <p className="text-muted-foreground mt-2">Scegli un'opzione per iniziare.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card onClick={handleCheckIn} className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <StoreIcon className="w-6 h-6"/>
                  </div>
                  <CardTitle>In Negozio</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>Entra in modalità spesa, ottimizzata per il layout del negozio in cui ti trovi per un acquisto veloce e guidato.</CardDescription>
                </CardContent>
              </Card>
              <Card onClick={() => setShoppingFlow('matching')} className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group">
                <CardHeader className="flex-row items-center gap-4 space-y-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Globe className="w-6 h-6"/>
                  </div>
                  <CardTitle>Compra Online</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>Trasforma la tua lista in un carrello e-commerce. Il sistema troverà i prodotti per te sul sito del supermercato.</CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 'matching':
        return (
          <ProductMatching 
            activeListId={activeListId}
            onNavigateToCart={() => setShoppingFlow('cart')}
            onBack={() => setShoppingFlow('selection')}
            // --- MODIFICA 3: Passiamo lo stato e la funzione per aggiornarlo ---
            manualSelections={manualSelections}
            onManualSelectionsChange={setManualSelections}
          />
        );
      case 'cart':
        return <ShoppingCartView activeListId={activeListId} onBack={() => setShoppingFlow('matching')} />;
      default:
        return null;
    }
  };

  if (isMarketMode && activeListId) {
    return <MarketModeView 
      onExit={exitMarketModeAndReset}
      activeListId={activeListId} 
      activeStore={activeStore} 
      categoryOrder={categoryOrder}
      items={shoppingItems}
    />;
  }

  return (
    <>
      <div className="flex flex-col h-full w-full bg-background">
        <header className="border-b sticky top-0 z-40 bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Select value={activeListId ? activeListId.toString() : ""} onValueChange={(value) => setActiveListId(Number(value))}>
                <SelectTrigger className="h-12 rounded-full text-base font-semibold max-w-xs">
                  <SelectValue placeholder="Seleziona lista..." />
                </SelectTrigger>
                <SelectContent>
                  {lists.map(list => (<SelectItem key={list.id} value={list.id.toString()}>{list.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => setIsAddListDialogOpen(true)} title="Crea nuova lista"><Plus className="w-5 h-5" /></Button>
              {isOwner && activeList && (<ShareListDialog activeListId={activeList.id} listName={activeList.name} />)}
            </div>
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user?.nickname?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || <User />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{user?.nickname || user?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => setIsNicknameDialogOpen(true)}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Modifica Nickname</span>
                    </DropdownMenuItem>
                    <Link href="/admin">
                      <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Pannello Admin</span>
                      </DropdownMenuItem>
                    </Link>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {isOwner && (
                    <DropdownMenuItem onSelect={() => setIsDeleteDialogOpen(true)} className="text-red-600 focus:bg-red-50 focus:text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Elimina Lista</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {pendingSyncs > 0 && (<div className="flex items-center justify-center mt-2"><Badge variant="destructive">{pendingSyncs} azioni in attesa di sincronizzazione</Badge></div>)}
        </header>

        <main className="flex-1 overflow-y-auto pb-28">
          {isLoadingLists || isAuthLoading ? (
            <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : !activeListId ? (
            <div className="text-center py-16 px-4">
              <h3 className="text-xl font-semibold mb-3">Benvenuto!</h3>
              <p className="text-muted-foreground">Crea la tua prima lista per iniziare.</p>
            </div>
          ) : activeTab === 'lista' ? (
            <Tabs defaultValue="list" className="p-4">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="list" className="h-7">Lista Attiva</TabsTrigger>
                <TabsTrigger value="suggestions" className="h-7">Suggerimenti</TabsTrigger>
                <TabsTrigger value="history" className="h-7">Storico</TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-3">
                <div className="space-y-4">
                  <AddItemForm isMarketMode={false} activeListId={activeListId} />
                  <ShoppingList isMarketMode={false} activeListId={activeListId} activeStoreId={null} categoryOrder={[]} />
                </div>
              </TabsContent>
              <TabsContent value="suggestions" className="mt-3">
                <SmartSuggestions activeListId={activeListId} />
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <PurchaseHistory activeListId={activeListId} />
              </TabsContent>
            </Tabs>
          ) : (
            renderShoppingFlow()
          )}
        </main>

        <nav className="bg-card border-t fixed bottom-0 left-0 right-0 h-20 px-2 pt-3 z-50 [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex justify-around items-start h-full">
            <button onClick={() => setActiveTab('lista')} className="flex flex-col items-center justify-center gap-1 w-24 h-16 transition-all duration-200 rounded-2xl">
              <div className={cn("flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300", activeTab === 'lista' && "bg-secondary text-secondary-foreground")}>
                <FileText className={cn("w-6 h-6 transition-colors duration-200", activeTab !== 'lista' && "text-muted-foreground")} />
              </div>
              <span className={cn("text-sm font-medium transition-colors duration-200", activeTab !== 'lista' && "text-muted-foreground")}>Lista</span>
            </button>
            <button onClick={() => setActiveTab('acquista')} className="flex flex-col items-center justify-center gap-1 w-24 h-16 transition-all duration-200 rounded-2xl">
              <div className={cn("flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300", activeTab === 'acquista' && "bg-secondary text-secondary-foreground")}>
                <ShoppingCart className={cn("w-6 h-6 transition-colors duration-200", activeTab !== 'acquista' && "text-muted-foreground")} />
              </div>
              <span className={cn("text-sm font-medium transition-colors duration-200", activeTab !== 'acquista' && "text-muted-foreground")}>Acquista</span>
            </button>
          </div>
        </nav>
      </div>
      
      {user && (<UpdateNicknameDialog user={user} open={isNicknameDialogOpen} onOpenChange={setIsNicknameDialogOpen} />)}
      
      <Dialog open={isStoreSelectorOpen} onOpenChange={setIsStoreSelectorOpen}>
        <DialogContent className="max-w-lg w-full top-0 translate-y-0 mt-8 mb-4 flex flex-col">
          <DialogHeader><DialogTitle>In quale negozio ti trovi?</DialogTitle><DialogDescription>Abbiamo trovato questi supermercati vicino a te. Selezionane uno per ottimizzare la tua lista.</DialogDescription></DialogHeader>
          <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2 pt-4 pr-4">
                {nearbyStores.map(store => (
                  <Button key={store.id} variant="outline" className="justify-start h-auto py-3" onClick={() => handleStoreSelect(store)}>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="font-semibold">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.address}</p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={handleNoStoreSelect}>Nessuno di questi / Salta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isConfirmationDialogOpen} onOpenChange={setIsConfirmationDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conferma Negozio</DialogTitle><DialogDescription>Sembra che tu sia da **{proposedStore?.name}**. Vuoi usare il layout di questo negozio per ottimizzare la tua lista?</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsConfirmationDialogOpen(false); setIsStoreSelectorOpen(true); }}>No, scegli da una lista</Button>
            <Button onClick={() => proposedStore && handleStoreSelect(proposedStore)}>
              Sì, conferma
            </Button>
          </DialogFooter>
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
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. La lista "<strong>{activeList?.name}</strong>" e tutti i prodotti al suo interno verranno eliminati definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteListMutation.mutate()} 
              disabled={deleteListMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteListMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}