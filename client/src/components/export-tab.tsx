import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Store, 
  Bot, 
  ExternalLink, 
  Download, 
  Share, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ShoppingItem, EcommerceMatch } from "@shared/schema";

const platforms = [
  { id: "carrefour", name: "Carrefour", icon: "fas fa-shopping-cart", color: "border-primary bg-blue-50 text-primary" },
  { id: "esselunga", name: "Esselunga", icon: "fas fa-truck", color: "border-gray-200 text-gray-600" },
  { id: "coop", name: "Coop", icon: "fas fa-leaf", color: "border-gray-200 text-gray-600" },
  { id: "altri", name: "Altri", icon: "fas fa-plus", color: "border-gray-200 text-gray-600" },
];

export default function ExportTab() {
  const [selectedPlatform, setSelectedPlatform] = useState("carrefour");
  const [matchingMode, setMatchingMode] = useState<"auto" | "manual">("manual");
  const [selectedProducts, setSelectedProducts] = useState<{[itemName: string]: {productId: string, quantity: number}}>({});
  const [exportSettings, setExportSettings] = useState({
    includeDates: true,
    includeFrequency: true,
    includeHistory: false,
  });
  
  const { toast } = useToast();

  const { data: items = [] } = useQuery<ShoppingItem[]>({
    queryKey: ["/api/shopping-items"],
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery<EcommerceMatch[]>({
    queryKey: ["/api/ecommerce/matches", selectedPlatform],
    enabled: !!selectedPlatform,
  });

  const matchProductsMutation = useMutation({
    mutationFn: async () => {
      const itemNames = items.map(item => item.name);
      const response = await apiRequest("POST", "/api/ecommerce/match", {
        items: itemNames,
        platform: selectedPlatform,
      });
      return response.json();
    },
    onSuccess: () => {
      refetchMatches();
      toast({
        title: "Matching completato",
        description: "I prodotti sono stati associati al catalogo e-commerce",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eseguire il matching",
        variant: "destructive",
      });
    },
  });

  const generateCartMutation = useMutation({
    mutationFn: async () => {
      const itemNames = items.map(item => item.name);
      const response = await apiRequest("POST", "/api/ecommerce/cart/url", {
        items: itemNames,
        platform: selectedPlatform,
        selectedProducts: matchingMode === "manual" ? selectedProducts : undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast({
        title: "Carrello generato",
        description: "Apertura del sito e-commerce in corso...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare il carrello",
        variant: "destructive",
      });
    },
  });

  const exportXMLMutation = useMutation({
    mutationFn: async () => {
      const itemNames = items.map(item => item.name);
      const response = await apiRequest("POST", "/api/ecommerce/cart/xml", {
        items: itemNames,
        platform: selectedPlatform,
      });
      
      // Create blob and download
      const blob = new Blob([await response.text()], { type: "application/xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartcart-${selectedPlatform}-${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "XML scaricato",
        description: "Il file XML del carrello è stato scaricato",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile scaricare l'XML",
        variant: "destructive",
      });
    },
  });

  const getMatchIcon = (confidence: number) => {
    if (confidence >= 0.9) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (confidence >= 0.7) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getMatchStatus = (item: ShoppingItem) => {
    const itemMatches = matches.filter(m => m.originalItem.toLowerCase() === item.name.toLowerCase());
    if (itemMatches.length === 0) return { status: "unmatched", confidence: 0, product: "" };
    
    const bestMatch = itemMatches[0]; // Il primo è sempre il migliore
    if (bestMatch.confidence >= 0.9) return { status: "matched", confidence: bestMatch.confidence, product: bestMatch.matchedProduct };
    if (bestMatch.confidence >= 0.7) return { status: "partial", confidence: bestMatch.confidence, product: bestMatch.matchedProduct };
    return { status: "failed", confidence: bestMatch.confidence, product: bestMatch.matchedProduct };
  };

  return (
    <div className="p-4">
      {/* E-commerce Integration */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Store className="w-5 h-5 mr-2 text-primary" />
          Integrazione E-commerce
        </h2>
        <p className="text-gray-600 mb-4">
          Trasforma la tua lista in un carrello e-commerce con matching AI automatico
        </p>

        {/* Platform Selection */}
        <div className="space-y-3 mb-4">
          <label className="text-sm font-medium text-gray-700">Seleziona piattaforma:</label>
          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => {
                  if (platform.id === 'carrefour') {
                    setSelectedPlatform(platform.id);
                  }
                }}
                disabled={platform.id !== 'carrefour'}
                className={`p-3 border-2 rounded-lg font-medium transition-colors ${
                  platform.id === 'carrefour' ? (
                    selectedPlatform === platform.id
                      ? platform.color
                      : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
                  ) : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
                }`}
              >
                <i className={`${platform.icon} mr-2 ${platform.id !== 'carrefour' ? 'text-gray-400' : ''}`}></i>
                {platform.name}
                {platform.id !== 'carrefour' && (
                  <span className="text-xs text-gray-400 block">Non disponibile</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Matching Mode Selection */}
        <div className="space-y-3 mb-4">
          <label className="text-sm font-medium text-gray-700">Modalità matching:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMatchingMode("auto")}
              className={`p-3 border-2 rounded-lg font-medium transition-colors text-sm ${
                matchingMode === "auto"
                  ? "border-primary bg-blue-50 text-primary"
                  : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              <i className="fas fa-magic mr-2"></i>
              Automatico
              <div className="text-xs text-gray-500 mt-1">Aggiunge il prodotto consigliato</div>
            </button>
            <button
              onClick={() => setMatchingMode("manual")}
              className={`p-3 border-2 rounded-lg font-medium transition-colors text-sm ${
                matchingMode === "manual"
                  ? "border-primary bg-blue-50 text-primary"
                  : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              <i className="fas fa-hand-pointer mr-2"></i>
              Manuale
              <div className="text-xs text-gray-500 mt-1">Scegli tra 3 opzioni</div>
            </button>
          </div>
        </div>

        <Button
          onClick={() => matchProductsMutation.mutate()}
          disabled={matchProductsMutation.isPending || items.length === 0}
          className="w-full bg-primary text-white"
        >
          <Bot className="w-4 h-4 mr-2" />
          {matchProductsMutation.isPending ? "Matching in corso..." : 
           matchingMode === "auto" ? "Matching Automatico" : "Trova Opzioni Prodotti"}
        </Button>
      </div>

      {/* AI Matching Status */}
      {matches.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Bot className="w-4 h-4 mr-2 text-accent" />
            Matching AI Prodotti
          </h3>

          <div className="space-y-4">
            {items.map((item) => {
              const itemMatches = matches.filter(m => m.originalItem.toLowerCase() === item.name.toLowerCase() && m.platform === selectedPlatform);
              
              if (itemMatches.length === 0) {
                return (
                  <div key={item.id} className="p-3 border border-red-200 bg-red-50 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-sm text-red-600">Nessun prodotto trovato</div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h4 className="ml-2 font-medium text-gray-900">{item.name}</h4>
                    <span className="ml-auto text-sm text-green-600 font-medium">
                      {itemMatches.length} opzione{itemMatches.length > 1 ? 'i' : ''} trovate
                    </span>
                  </div>

                  {matchingMode === "auto" ? (
                    // Modalità Automatica - Mostra solo il prodotto consigliato
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {itemMatches[0].imageUrl ? (
                            <img
                              src={itemMatches[0].imageUrl}
                              alt={itemMatches[0].matchedProduct}
                              className="w-12 h-12 object-cover rounded-lg border"
                              onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No img</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h5 className="font-medium text-gray-900 text-sm">
                            {itemMatches[0].matchedProduct}
                          </h5>
                          <div className="flex items-center space-x-3 mt-1">
                            {itemMatches[0].price && (
                              <span className="text-sm font-bold text-green-600">
                                €{itemMatches[0].price.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Aggiunto automaticamente
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Modalità Manuale - Mostra tutte le opzioni
                    <div className="grid gap-3">
                      {itemMatches.map((match, index) => {
                        const isSelected = selectedProducts[item.name]?.productId === match.productId;
                        const selectedQuantity = selectedProducts[item.name]?.quantity || 1;
                        
                        return (
                          <div 
                            key={match.id} 
                            className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                              isSelected 
                                ? "bg-blue-50 border-blue-300" 
                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                            }`}
                            onClick={() => {
                              setSelectedProducts(prev => ({
                                ...prev,
                                [item.name]: { productId: match.productId!, quantity: 1 }
                              }));
                            }}
                          >
                            {/* Product Image */}
                            <div className="flex-shrink-0">
                              {match.imageUrl ? (
                                <img
                                  src={match.imageUrl}
                                  alt={match.matchedProduct}
                                  className="w-16 h-16 object-cover rounded-lg border"
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpolyline points="21,15 16,10 5,21"/%3E%3C/svg%3E';
                                  }}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <span className="text-gray-400 text-xs">No img</span>
                                </div>
                              )}
                            </div>

                            {/* Product Details */}
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h5 className="font-medium text-gray-900 text-sm leading-tight">
                                    {match.matchedProduct}
                                  </h5>
                                  {match.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                      {match.description}
                                    </p>
                                  )}
                                  {match.brand && (
                                    <p className="text-xs text-blue-600 mt-1 font-medium">
                                      {match.brand}
                                    </p>
                                  )}
                                  <div className="flex items-center mt-2 space-x-3">
                                    {match.price && (
                                      <span className="text-sm font-bold text-green-600">
                                        €{match.price.toFixed(2)}
                                      </span>
                                    )}
                                    {match.productUrl && (
                                      <a
                                        href={match.productUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Vedi su Carrefour →
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end ml-2">
                                  <span className="text-xs font-medium text-green-600">
                                    {Math.round(match.confidence * 100)}%
                                  </span>
                                  {index === 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mt-1">
                                      Consigliato
                                    </span>
                                  )}
                                  {isSelected && (
                                    <div className="mt-2 flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-xs text-gray-600">Qta:</span>
                                      <button
                                        onClick={() => {
                                          setSelectedProducts(prev => ({
                                            ...prev,
                                            [item.name]: { 
                                              productId: match.productId!, 
                                              quantity: Math.max(1, selectedQuantity - 1) 
                                            }
                                          }));
                                        }}
                                        className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center text-xs font-medium">{selectedQuantity}</span>
                                      <button
                                        onClick={() => {
                                          setSelectedProducts(prev => ({
                                            ...prev,
                                            [item.name]: { 
                                              productId: match.productId!, 
                                              quantity: selectedQuantity + 1 
                                            }
                                          }));
                                        }}
                                        className="w-6 h-6 bg-gray-200 rounded text-xs hover:bg-gray-300"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary of Selections */}
      {matchingMode === "manual" && Object.keys(selectedProducts).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <i className="fas fa-shopping-cart mr-2 text-blue-600"></i>
            Prodotti Selezionati
          </h4>
          <div className="space-y-2">
            {Object.entries(selectedProducts).map(([itemName, selection]) => {
              const match = matches.find(m => m.productId === selection.productId);
              return match ? (
                <div key={itemName} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div className="flex items-center space-x-2">
                    <img
                      src={match.imageUrl || ''}
                      alt={match.matchedProduct}
                      className="w-8 h-8 object-cover rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{match.matchedProduct}</div>
                      <div className="text-xs text-gray-600">per: {itemName}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Qta: {selection.quantity}</span>
                    {match.price && (
                      <span className="text-sm font-bold text-green-600">
                        €{(match.price * selection.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null;
            })}
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="font-medium text-gray-900">Totale stimato:</span>
              <span className="font-bold text-green-600">
                €{Object.entries(selectedProducts).reduce((total, [itemName, selection]) => {
                  const match = matches.find(m => m.productId === selection.productId);
                  return total + (match?.price || 0) * selection.quantity;
                }, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Export Actions */}
      <div className="space-y-3">
        <Button
          onClick={() => generateCartMutation.mutate()}
          disabled={generateCartMutation.isPending || items.length === 0 || 
            (matchingMode === "manual" && Object.keys(selectedProducts).length === 0)}
          className="w-full bg-primary text-white"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {generateCartMutation.isPending ? "Generando..." : `Vai al carrello ${platforms.find(p => p.id === selectedPlatform)?.name}`}
        </Button>

        <Button
          onClick={() => exportXMLMutation.mutate()}
          disabled={exportXMLMutation.isPending || items.length === 0}
          variant="secondary"
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          {exportXMLMutation.isPending ? "Generando..." : "Scarica XML carrello"}
        </Button>

        <Button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: "SmartCart - Lista Spesa",
                text: `Lista spesa con ${items.length} prodotti`,
                url: window.location.href,
              });
            } else {
              navigator.clipboard.writeText(
                items.map(item => `• ${item.name}`).join('\n')
              );
              toast({
                title: "Lista copiata",
                description: "La lista è stata copiata negli appunti",
              });
            }
          }}
          variant="outline"
          className="w-full"
        >
          <Share className="w-4 h-4 mr-2" />
          Condividi lista
        </Button>
      </div>

      {/* Export Settings */}
      <div className="bg-gray-50 rounded-lg p-4 mt-6">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          Impostazioni Export
        </h4>
        <div className="space-y-3">
          <label className="flex items-center">
            <Checkbox
              checked={exportSettings.includeDates}
              onCheckedChange={(checked) =>
                setExportSettings(prev => ({ ...prev, includeDates: !!checked }))
              }
            />
            <span className="ml-2 text-sm text-gray-700">Includi date di aggiunta</span>
          </label>
          <label className="flex items-center">
            <Checkbox
              checked={exportSettings.includeFrequency}
              onCheckedChange={(checked) =>
                setExportSettings(prev => ({ ...prev, includeFrequency: !!checked }))
              }
            />
            <span className="ml-2 text-sm text-gray-700">Includi dati di frequenza</span>
          </label>
          <label className="flex items-center">
            <Checkbox
              checked={exportSettings.includeHistory}
              onCheckedChange={(checked) =>
                setExportSettings(prev => ({ ...prev, includeHistory: !!checked }))
              }
            />
            <span className="ml-2 text-sm text-gray-700">Includi storico acquisti</span>
          </label>
        </div>
      </div>
    </div>
  );
}
