// FILE: client/src/components/smart-suggestions.tsx (VERSIONE CORRETTA E COMPLETA)

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Plus, Sparkles, ChefHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Suggestion } from "@shared/schema";

interface AISuggestion {
  id: string;
  name: string;
  category: string;
  quantity?: string;
  reason: string;
  selected: boolean;
}

interface SmartSuggestionsProps {
  activeListId: number | null;
}

export default function SmartSuggestions({ activeListId }: SmartSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requirement, setRequirement] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/suggestions"],
  });

  const generateAISuggestionsMutation = useMutation({
    mutationFn: async (requirement: string) => {
      const response = await apiRequest("POST", "/api/ai-suggestions", { requirement });
      return response.json();
    },
    onSuccess: (data: AISuggestion[]) => {
      setAiSuggestions(data.map(item => ({ ...item, selected: true })));
      toast({
        title: "Lista generata",
        description: `${data.length} prodotti suggeriti dall'AI`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare la lista",
        variant: "destructive",
      });
    },
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/suggestions/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({
        title: "Suggerimenti generati",
        description: "Nuovi suggerimenti basati sui tuoi acquisti",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare suggerimenti",
        variant: "destructive",
      });
    },
  });

  const addSelectedItemsMutation = useMutation({
    mutationFn: async (items: AISuggestion[]) => {
      if (!activeListId) {
        throw new Error("Nessuna lista attiva selezionata. Impossibile aggiungere i prodotti.");
      }
      
      const selectedItems = items.filter(item => item.selected);
      const promises = selectedItems.map(item => 
        apiRequest("POST", `/api/lists/${activeListId}/items`, {
          name: item.name,
          category: item.category,
          listId: activeListId
        })
      );
      await Promise.all(promises);
      return selectedItems.length;
    },
    onSuccess: (count: number) => {
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      setAiSuggestions([]);
      setRequirement("");
      toast({
        title: "Prodotti aggiunti",
        description: `${count} prodotti aggiunti alla lista della spesa`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere i prodotti",
        variant: "destructive",
      });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!activeListId) {
         throw new Error("Seleziona una lista prima di aggiungere un suggerimento.");
      }
      await apiRequest("POST", `/api/suggestions/${id}/accept`, { listId: activeListId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      toast({
        title: "Suggerimento aggiunto",
        description: "Il prodotto è stato aggiunto alla lista",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere il suggerimento",
        variant: "destructive",
      });
    },
  });

  const handleGenerateList = () => {
    if (!requirement.trim()) {
      toast({
        title: "Campo richiesto",
        description: "Inserisci un'esigenza per generare la lista",
        variant: "destructive",
      });
      return;
    }
    generateAISuggestionsMutation.mutate(requirement.trim());
  };

  const toggleItemSelection = (id: string) => {
    setAiSuggestions(prev => 
      prev.map(item => 
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-secondary text-white";
    if (confidence >= 0.6) return "bg-accent text-white";
    return "bg-gray-500 text-white";
  };

  const getConfidenceText = (confidence: number) => {
    return `${Math.round(confidence * 100)}% probabilità`;
  };

  const selectedCount = aiSuggestions.filter(item => item.selected).length;

  return (
    <div className="p-4 space-y-6">
      <div className="md3-card-elevated p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 md3-primary-container rounded-3xl flex items-center justify-center md3-elevation-2">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h2 className="md3-headline-small">Assistente AI Spesa</h2>
            <p className="md3-body-medium opacity-70">Trasforma le tue esigenze in liste intelligenti</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block md3-body-medium font-medium mb-3">
              Descrivi la tua esigenza
            </label>
            <Textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="Es: Carbonara per 4 persone, Grigliata estiva per 8 persone, Colazione sana per una settimana, Aperitivo con amici..."
              className="min-h-[120px] rounded-xl border-[color:var(--outline)] focus:border-[color:var(--primary)] md3-body-large"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                color: 'var(--on-surface)'
              }}
              disabled={generateAISuggestionsMutation.isPending}
            />
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleGenerateList}
              disabled={generateAISuggestionsMutation.isPending || !requirement.trim()}
              className="md3-button-filled flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generateAISuggestionsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando lista...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Genera Lista AI
                </>
              )}
            </button>
          </div>

          <div className="border-t pt-4 mt-6">
            <p className="md3-body-medium opacity-70 mb-3">Esempi rapidi:</p>
            <div className="flex flex-wrap gap-2">
              {["Pasta aglio e olio x4", "Colazione sana settimana", "Aperitivo amici"].map((example) => (
                <button
                  key={example}
                  onClick={() => setRequirement(example)}
                  disabled={generateAISuggestionsMutation.isPending}
                  className="md3-button-tonal px-3 py-1 text-sm disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {aiSuggestions.length > 0 && (
        <div className="md3-card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md3-secondary-container rounded-lg flex items-center justify-center">
                <ChefHat className="w-4 h-4" />
              </div>
              <h3 className="md3-title-large">Lista Generata dall'AI</h3>
            </div>
            <div className="md3-secondary-container px-3 py-1 rounded-full">
              <span className="md3-label-medium">
                {selectedCount} di {aiSuggestions.length} selezionati
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {aiSuggestions.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 ${
                  item.selected 
                    ? 'md3-secondary-container md3-elevation-1' 
                    : 'md3-surface-container-high hover:md3-elevation-1'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggleItemSelection(item.id)}
                  className="w-5 h-5 rounded-md"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="md3-body-large font-medium capitalize">{item.name}</h3>
                    {item.quantity && (
                      <span className="md3-tertiary-container px-2 py-1 rounded-full md3-label-small">
                        {item.quantity}
                      </span>
                    )}
                    <span className="md3-surface-container px-2 py-1 rounded-full md3-label-small">
                      {item.category}
                    </span>
                  </div>
                  <p className="md3-body-medium opacity-70 mt-1">{item.reason}</p>
                </div>
              </div>
            ))}
            
            <div className="flex gap-3 pt-6 border-t border-[color:var(--outline-variant)] mt-4">
              <button
                  onClick={() => addSelectedItemsMutation.mutate(aiSuggestions)}
                  disabled={selectedCount === 0 || addSelectedItemsMutation.isPending}
                  className="md3-button-filled flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {addSelectedItemsMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Aggiungendo...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Aggiungi {selectedCount} prodotti alla lista
                    </>
                  )}
              </button>
              <button
                  className="md3-button-text disabled:opacity-50"
                  onClick={() => setAiSuggestions([])}
                  disabled={addSelectedItemsMutation.isPending}
                >
                  Annulla
                </button>
              </div>
            </div>
        </div>
      )}

      <div className="md3-card-elevated p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 md3-tertiary-container rounded-2xl flex items-center justify-center">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="md3-title-large">Suggerimenti Basati sulla Cronologia</h3>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => generateSuggestionsMutation.mutate()}
            disabled={generateSuggestionsMutation.isPending}
            className="md3-button-outlined w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generateSuggestionsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                Genera Suggerimenti dalla Cronologia
              </>
            )}
          </button>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="bg-white rounded-lg border p-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun suggerimento</h3>
                <p className="text-gray-500 mb-4">Genera suggerimenti basati sui tuoi acquisti precedenti</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 capitalize">{suggestion.itemName}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getConfidenceColor(suggestion.confidence)}`}>
                            {getConfidenceText(suggestion.confidence)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{suggestion.reasoning}</p>
                      </div>
                      
                      <Button
                        onClick={() => acceptSuggestionMutation.mutate(suggestion.id!)}
                        disabled={acceptSuggestionMutation.isPending}
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Aggiungi
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}