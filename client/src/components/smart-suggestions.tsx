import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Plus, Sparkles, ChefHat, Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Suggestion } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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

  // --- FIX: AGGIUNTA LA MUTAZIONE MANCANTE ---
  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/suggestions/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      toast({ title: "Suggerimenti generati", description: "Nuovi suggerimenti basati sui tuoi acquisti" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile generare suggerimenti", variant: "destructive" });
    },
  });

  const generateAISuggestionsMutation = useMutation({
    mutationFn: async (requirement: string) => {
      const response = await apiRequest("POST", "/api/ai-suggestions", { requirement });
      return response.json();
    },
    onSuccess: (data: AISuggestion[]) => {
      setAiSuggestions(data.map(item => ({ ...item, selected: true })));
      toast({ title: "Lista generata", description: `${data.length} prodotti suggeriti dall'AI` });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile generare la lista", variant: "destructive" });
    },
  });

  const addSelectedItemsMutation = useMutation({
    mutationFn: async (items: AISuggestion[]) => {
      if (!activeListId) throw new Error("Nessuna lista attiva selezionata.");
      const selectedItems = items.filter(item => item.selected);
      const promises = selectedItems.map(item => 
        apiRequest("POST", `/api/lists/${activeListId}/items`, { 
            name: item.name, 
            quantity: item.quantity || null,
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
      toast({ title: "Prodotti aggiunti", description: `${count} prodotti aggiunti alla lista` });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile aggiungere i prodotti", variant: "destructive" });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!activeListId) throw new Error("Seleziona una lista prima di aggiungere un suggerimento.");
      await apiRequest("POST", `/api/suggestions/${id}/accept`, { listId: activeListId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingItems", activeListId] });
      toast({ title: "Suggerimento aggiunto", description: "Il prodotto è stato aggiunto alla lista" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile aggiungere il suggerimento", variant: "destructive" });
    },
  });

  const handleGenerateList = () => {
    if (!requirement.trim()) {
      toast({ title: "Campo richiesto", description: "Inserisci un'esigenza per generare la lista", variant: "destructive" });
      return;
    }
    generateAISuggestionsMutation.mutate(requirement.trim());
  };

  const toggleItemSelection = (id: string) => {
    setAiSuggestions(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500 text-white";
    if (confidence >= 0.6) return "bg-yellow-500 text-black";
    return "bg-muted text-muted-foreground";
  };

  const getConfidenceText = (confidence: number) => `${Math.round(confidence * 100)}% prob.`;

  const selectedCount = aiSuggestions.filter(item => item.selected).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
              <Lightbulb className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Assistente AI Spesa</CardTitle>
              <CardDescription>Trasforma le tue esigenze in liste.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="Es: Carbonara per 4, Grigliata estiva, Colazione sana..."
            className="min-h-[100px]"
            disabled={generateAISuggestionsMutation.isPending}
          />
          <Button 
            onClick={handleGenerateList}
            disabled={generateAISuggestionsMutation.isPending || !requirement.trim()}
            className="w-full"
          >
            {generateAISuggestionsMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Genera Lista AI</>
            )}
          </Button>
        </CardContent>
      </Card>

      {aiSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><ChefHat className="w-5 h-5" /> Lista Generata</CardTitle>
              <Badge variant="secondary">{selectedCount} / {aiSuggestions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiSuggestions.map((item) => (
              <div 
                key={item.id} 
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all",
                  item.selected ? 'bg-secondary/10' : 'hover:bg-muted'
                )}
              >
                <Checkbox
                  id={`item-${item.id}`}
                  checked={item.selected}
                  onCheckedChange={() => toggleItemSelection(item.id)}
                  className="mt-1"
                />
                <div className="flex-1 grid gap-1">
                  <label htmlFor={`item-${item.id}`} className="font-medium capitalize cursor-pointer">{item.name}</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.quantity && <Badge variant="outline">{item.quantity}</Badge>}
                    <Badge variant="outline">{item.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-4 border-t mt-4">
              <Button
                  onClick={() => addSelectedItemsMutation.mutate(aiSuggestions)}
                  disabled={selectedCount === 0 || addSelectedItemsMutation.isPending}
                  className="flex-1"
                >
                  {addSelectedItemsMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aggiungendo...</>
                  ) : (
                    <><Plus className="w-4 h-4 mr-2" />Aggiungi {selectedCount} prodotti</>
                  )}
              </Button>
              <Button variant="ghost" onClick={() => setAiSuggestions([])} disabled={addSelectedItemsMutation.isPending}>Annulla</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Suggerimenti dalla Cronologia</CardTitle>
          <CardDescription>Basati sulla frequenza dei tuoi acquisti passati.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => generateSuggestionsMutation.mutate()}
            disabled={generateSuggestionsMutation.isPending}
            variant="outline"
            className="w-full"
          >
            {generateSuggestionsMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizzando...</>
            ) : (
              <><Lightbulb className="w-4 h-4 mr-2" />Genera Nuovi Suggerimenti</>
            )}
          </Button>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessun suggerimento disponibile. Prova a generarne di nuovi!</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{suggestion.itemName}</p>
                    <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs", getConfidenceColor(suggestion.confidence))}>{getConfidenceText(suggestion.confidence)}</Badge>
                    <Button
                      onClick={() => acceptSuggestionMutation.mutate(suggestion.id!)}
                      disabled={acceptSuggestionMutation.isPending}
                      size="sm"
                      variant="secondary"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}