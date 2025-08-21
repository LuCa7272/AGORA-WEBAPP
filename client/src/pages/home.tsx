// FILE: client/pages/home.tsx

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, History, Brain, Zap, ShoppingBasket, ShoppingCart, Settings, Plus, LogOut, Loader2,
  MapPin, Store as StoreIcon, Edit, Share2 // Aggiunta icona Share2
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
import { ShareListDialog } from "@/components/ShareListDialog"; // NUOVO IMPORT

import { useAuth } from "@/hooks/use-auth";
import type { ShoppingList as ShoppingListType, Store } from "@shared/schema";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { processOfflineQueue, getOfflineQueue } from "@/lib/offline-queue";
import { Badge } from "@/components/ui/badge";

const MOCK_COORDINATES = {
  latitude: 45.4582,
  longitude: 9.1633,
};

export default function Home() {
  const { user, logout, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"lista" | "storico" | "suggerimenti" | "matching" | "carrello">("lista");
  const [isMarketMode, setIsMarketMode] = useState(false);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [isStoreSelectorOpen, setIsStoreSelectorOpen] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);

  const { data: lists = [], isLoading: isLoadingLists } = useQuery<ShoppingListType[]>({
    queryKey: ["lists"],
    queryFn: async () => {
        if (!user) return [];
        const res = await apiRequest("GET", "/api/lists");
        return res.json();
    },
    enabled: !!user,
  });
  
  // Trova l'oggetto completo della lista attiva per ottenere il nome e l'ownerId
  const activeList = lists.find(list => list.id === activeListId);
  // Controlla se l'utente corrente è il proprietario della lista attiva
  const isOwner = user && activeList && user.id === activeList.ownerId;

  useEffect(() => {
    if (lists && lists.length > 0 && !activeListId) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);
  
  useEffect(() => {
    const trySync = async () => {
      if (isAuthLoading || !isAuthenticated) {
        console.log("[Sync] In attesa di autenticazione prima di sincronizzare...");
        return;
      }

      if (!navigator.onLine) {
        console.log("[Sync] Offline, sincronizzazione rimandata.");
        setPendingSyncs(getOfflineQueue().length);
        return;
      }
      
      const result = await processOfflineQueue();
      if (result.success > 0) {
        toast({
          title: "Sincronizzazione completata!",
          description: `${result.success} azioni offline sono state salvate.`,
        });
        queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
        queryClient.invalidateQueries({ queryKey: ["history", activeListId] });
      }
      setPendingSyncs(getOfflineQueue().length);
    };

    trySync();

    window.addEventListener('online', trySync);
    window.addEventListener('offline', () => setPendingSyncs(getOfflineQueue().length));

    return () => {
      window.removeEventListener('online', trySync);
      window.removeEventListener('offline', () => setPendingSyncs(getOfflineQueue().length));
    };
  }, [activeListId, queryClient, toast, isAuthenticated, isAuthLoading]);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logout effettuato con successo." });
  };
  
  const getRealGpsPosition = (): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("La geolocalizzazione non è supportata dal browser."));
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(new Error(error.message || "Impossibile ottenere la posizione."))
      );
    });
  };

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    toast({ title: "Ricerca GPS in corso...", description: "Richiesta della tua posizione." });

    try {
      let coords: { latitude: number, longitude: number };
      
      const realCoords = await getRealGpsPosition();
      coords = realCoords;

      if (import.meta.env.DEV) {
        console.warn("DEV MODE: Sovrascrivo le coordinate GPS con quelle di test.");
        toast({ title: "Modalita' Sviluppo", description: "Utilizzo coordinate di test." });
        coords = MOCK_COORDINATES;
      }

      const res = await apiRequest("POST", "/api/check-in", {
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      const foundStores: Store[] = await res.json();

      if (foundStores.length === 0) {
        toast({
          title: "Nessun negozio trovato nelle vicinanze",
          description: "Modalita' Market attivata senza ordinamento. Gli acquisti non saranno salvati nelle statistiche.",
          duration: 5000,
        });
        setActiveStore(null);
        setCategoryOrder([]);
      } else if (foundStores.length === 1) {
        await handleStoreSelect(foundStores[0]);
      } else {
        setNearbyStores(foundStores);
        setIsStoreSelectorOpen(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore GPS",
        description: error.message || "Impossibile ottenere la posizione.",
      });
      setIsMarketMode(false);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleStoreSelect = async (store: Store) => {
    setIsStoreSelectorOpen(false);
    setActiveStore(store);
    toast({
      title: `Check-in effettuato!`,
      description: `Ottimizzazione della lista per ${store.name}.`,
    });

    try {
      const res = await apiRequest("GET", `/api/stores/${store.id}/layout`);
      const data = await res.json();
      if (data.categoryOrder && data.categoryOrder.length > 0) {
        setCategoryOrder(data.categoryOrder);
        toast({ title: "Lista ottimizzata!", description: "Le categorie sono state riordinate." });
      } else {
        console.log("Nessun layout personalizzato trovato per questo negozio.");
      }
    } catch (error) {
      console.error("Errore nel caricare il layout del negozio:", error);
      toast({ variant: "destructive", title: "Errore", description: "Impossibile caricare il layout del negozio." });
    }
  };

  const handleToggleMode = (newMode: boolean) => {
    if (isCheckingIn) return;
    setIsMarketMode(newMode);

    if (newMode) {
      if (navigator.onLine) {
        handleCheckIn();
      } else {
        toast({
          title: "Modalita' Market Offline",
          description: "La lista non puo' essere ottimizzata. Verra' usata la categorizzazione standard.",
        });
        setActiveStore(null);
        setCategoryOrder([]);
      }
    } else {
      setActiveStore(null);
      setCategoryOrder([]);
    }
  };

  const tabs = [
    { id: "lista", label: "Lista", icon: FileText },
    { id: "storico", label: "Storico", icon: History },
    { id: "suggerimenti", label: "Smart", icon: Brain },
    { id: "matching", label: "Matching", icon: Zap },
    { id: "carrello", label: "Carrello", icon: ShoppingBasket },
  ] as const;

  const scrollToAddForm = () => {
    const addFormElement = document.getElementById("add-form");
    if (addFormElement) {
      addFormElement.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => { document.getElementById("add-input")?.focus(); }, 300);
    }
  };

  const getUserDisplayName = () => {
      if (!user) return "";
      if (user.nickname && user.nickname.trim() !== "") {
          return user.nickname;
      }
      return user.email.split('@')[0];
  };

  const renderContent = () => {
    if (isLoadingLists || isAuthLoading) { 
      return (
        <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    if (!activeListId || !lists || lists.length === 0) {
      return (
        <div className="text-center py-16 px-4">
          <h3 className="md3-headline-small mb-3">Nessuna lista trovata</h3>
          <p className="md3-body-large text-[color:var(--md-sys-color-on-surface-variant)]">
            Crea la tua prima lista per iniziare.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case "lista":
        return (
          <>
            <AddItemForm isMarketMode={isMarketMode} activeListId={activeListId} />
            <ShoppingList
              isMarketMode={isMarketMode}
              activeListId={activeListId}
              activeStoreId={activeStore?.id ?? null}
              categoryOrder={categoryOrder}
            />
          </>
        );
      case "storico":
        return <PurchaseHistory activeListId={activeListId} />;
      case "suggerimenti":
        return <SmartSuggestions activeListId={activeListId} />;
      case "matching":
        return <ProductMatching activeListId={activeListId} onNavigateToCart={() => setActiveTab("carrello")} />;
      case "carrello":
        return <ShoppingCartView activeListId={activeListId} />;
      default:
        return <div className="p-4">Sezione in costruzione.</div>;
    }
  };
  
  return (
    <>
      <div className="flex flex-col h-full w-full md3-surface">
        <header className={`md3-elevation-1 sticky top-0 z-40 transition-colors duration-300 ${isMarketMode ? 'md3-tertiary-container' : 'md3-surface-container'}`}>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-shrink min-w-0">
                  <div className="w-10 h-10 md3-primary-container rounded-2xl flex items-center justify-center md3-elevation-1 flex-shrink-0">
                      <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1 truncate">
                    <div className="truncate">
                        <p className="md3-label-medium text-[color:var(--md-sys-color-on-surface-variant)]">Ciao,</p>
                        <p className="md3-body-large font-bold truncate">
                          {getUserDisplayName()}
                        </p>
                    </div>
                    {user && (
                      <button 
                        onClick={() => setIsNicknameDialogOpen(true)} 
                        className="p-1 rounded-full text-[color:var(--md-sys-color-on-surface-variant)] hover:bg-black/10 flex-shrink-0"
                        title="Modifica nickname"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
              </div>
              <div className="flex items-center space-x-1 flex-shrink-0">
                  <button onClick={handleLogout} className="md3-button-text p-2 rounded-full" title="Logout">
                      <LogOut className="w-5 h-5" />
                  </button>
                  <Link href="/admin">
                      <button className="md3-button-text p-2 rounded-full" title="Admin">
                          <Settings className="w-5 h-5" />
                      </button>
                  </Link>
              </div>
            </div>
            {pendingSyncs > 0 && (
                <div className="flex items-center justify-center">
                    <Badge variant="destructive">
                        {pendingSyncs} azioni in attesa di sincronizzazione
                    </Badge>
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
               <div className="flex-1">
                  {lists && lists.length > 0 && activeListId && (
                      <Select
                          value={activeListId.toString()}
                          onValueChange={(value) => setActiveListId(Number(value))}
                      >
                          <SelectTrigger className="h-12 md3-surface-container-high rounded-full border-none md3-title-medium">
                              <SelectValue placeholder="Seleziona una lista..." />
                          </SelectTrigger>
                          <SelectContent>
                              {lists.map(list => (
                                  <SelectItem key={list.id} value={list.id.toString()}>
                                      {list.name}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  )}
               </div>
               
               {/* --- INTEGRAZIONE DEL COMPONENTE SHARE --- */}
               <div className="flex items-center gap-2">
                    {isOwner && activeList && (
                        <ShareListDialog activeListId={activeList.id} listName={activeList.name} />
                    )}
                    <ModeToggle isMarketMode={isMarketMode} onToggle={handleToggleMode} />
               </div>
            </div>
            {isMarketMode && (
                <div className="flex items-center justify-center gap-2 text-sm text-[color:var(--md-sys-color-on-tertiary-container)] bg-black/10 px-3 py-1 rounded-full animate-in fade-in duration-500">
                    {activeStore ? (
                        <>
                            <StoreIcon size={14} />
                            <span>{activeStore.name}</span>
                        </>
                    ) : (
                        <span>Modalita' Market Generica</span>
                    )}
                </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24">{renderContent()}</main>

        <nav className="md3-navigation-bar">
          <div className="flex justify-around items-start h-full">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1 w-16 h-16 transition-all duration-200 md3-ripple rounded-2xl`}
                >
                  <div className={`flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300 ${isActive ? "md3-secondary-container" : ""}`}>
                    <IconComponent className={`w-6 h-6 transition-colors duration-200 ${isActive ? "text-[color:var(--md-sys-color-on-secondary-container)]" : "text-[color:var(--md-sys-color-on-surface-variant)]"}`} />
                  </div>
                  <span className={`md3-label-medium transition-colors duration-200 ${isActive ? "text-[color:var(--md-sys-color-on-surface)] font-bold" : "text-[color:var(--md-sys-color-on-surface-variant)]"}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {!isMarketMode && activeTab === "lista" && (
          <div className="fixed bottom-24 right-6 z-40">
            <button
              onClick={scrollToAddForm}
              className="md3-fab flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              aria-label="Aggiungi nuovo prodotto"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
      
      {user && (
        <UpdateNicknameDialog 
          user={user} 
          open={isNicknameDialogOpen} 
          onOpenChange={setIsNicknameDialogOpen} 
        />
      )}
      
      <Dialog open={isStoreSelectorOpen} onOpenChange={setIsStoreSelectorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>In quale negozio ti trovi?</DialogTitle>
            <DialogDescription>
              Abbiamo trovato questi supermercati vicino a te. Selezionane uno per ottimizzare la tua lista.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-4">
            {nearbyStores.map(store => (
              <Button
                key={store.id}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleStoreSelect(store)}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="font-semibold">{store.name}</p>
                    <p className="text-xs text-muted-foreground">{store.address}</p>
                  </div>
                </div>
              </Button>
            ))}
             <Button variant="ghost" onClick={() => {
                setIsStoreSelectorOpen(false);
                setActiveStore(null);
                setCategoryOrder([]);
             }}>Nessuno di questi / Continua senza negozio</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}