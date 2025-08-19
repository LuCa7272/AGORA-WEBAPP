import { useState, useEffect } from "react";
import { Settings, ArrowLeft, Database, Bot, Zap, ToggleLeft, RotateCcw, Activity, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "wouter";
import { VectorIndexManager } from "@/components/vector-index-manager";
import { DatabaseStatus } from "@/components/database-status";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"database" | "ai">("database");
  const [semanticScoring, setSemanticScoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenStats, setTokenStats] = useState({ totalTokens: 0, lastReset: null });
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [availableProviders, setAvailableProviders] = useState<Array<{provider: string, available: boolean, name: string}>>([]);

  // Carica lo stato dal localStorage
  useEffect(() => {
    const saved = localStorage.getItem('semanticScoringEnabled');
    if (saved) {
      setSemanticScoring(JSON.parse(saved));
    }
    loadTokenStats();
    loadAIProviderConfig();
  }, []);

  // Carica statistiche token
  const loadTokenStats = async () => {
    try {
      const response = await fetch('/api/config/token-stats');
      if (response.ok) {
        const data = await response.json();
        setTokenStats(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento statistiche token:', error);
    }
  };

  // Carica configurazione AI provider
  const loadAIProviderConfig = async () => {
    try {
      const response = await fetch('/api/config/ai-provider');
      if (response.ok) {
        const data = await response.json();
        setAiProvider(data.currentProvider);
        setAvailableProviders(data.availableProviders);
      }
    } catch (error) {
      console.error('Errore nel caricamento configurazione AI:', error);
    }
  };

  // Salva lo stato nel localStorage e sul server quando cambia
  const handleSemanticScoringChange = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      // Aggiorna il server
      const response = await fetch('/api/config/semantic-scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        setSemanticScoring(enabled);
        localStorage.setItem('semanticScoringEnabled', JSON.stringify(enabled));
      } else {
        throw new Error('Errore nella configurazione del server');
      }
    } catch (error) {
      console.error('Errore nel cambiare la configurazione:', error);
      // Non cambiare lo stato locale se c'è stato un errore
    } finally {
      setIsLoading(false);
    }
  };

  // Reset contatore token
  const handleResetTokens = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/config/token-stats/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        await loadTokenStats();
      } else {
        throw new Error('Errore nel reset dei token');
      }
    } catch (error) {
      console.error('Errore nel reset token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cambia AI provider
  const handleAIProviderChange = async (newProvider: "openai" | "gemini") => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/config/ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider })
      });
      
      if (response.ok) {
        setAiProvider(newProvider);
        console.log(`✅ AI Provider cambiato a ${newProvider.toUpperCase()}`);
        // Ricarica le statistiche dopo il cambio
        await loadTokenStats();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore nel cambio provider');
      }
    } catch (error) {
      console.error('Errore nel cambio AI provider:', error);
      // Non cambiare lo stato locale se c'è stato un errore
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: "database", label: "Database", icon: Database, description: "Gestione prodotti e indici" },
    { id: "ai", label: "AI Setup", icon: Bot, description: "Configurazione avanzata AI" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mr-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                <Settings className="text-white w-4 h-4" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Pannello Amministrativo</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="flex">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-4 text-center border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <IconComponent className="w-5 h-5 mx-auto mb-1" />
                <div className="font-medium">{tab.label}</div>
                <div className="text-xs text-gray-400 mt-1">{tab.description}</div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === "database" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Gestione Database</h2>
              <p className="text-gray-600 mb-6">
                Monitora lo stato del database prodotti e gestisci gli indici per il matching avanzato.
              </p>
            </div>
            
            <DatabaseStatus />
            <VectorIndexManager />
          </div>
        )}

        {activeTab === "ai" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configurazione Avanzata AI</h2>
              <p className="text-gray-600 mb-6">
                Configurazioni tecniche per l'intelligenza artificiale e sistema di matching.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {/* AI Provider Selection */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Cpu className="text-white w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle>Modello AI</CardTitle>
                      <CardDescription>
                        Scegli quale modello AI utilizzare per categorizzazione, suggerimenti e matching
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Provider AI Attivo</Label>
                      <RadioGroup
                        value={aiProvider}
                        onValueChange={(value: "openai" | "gemini") => handleAIProviderChange(value)}
                        disabled={isLoading}
                      >
                        {availableProviders.map((provider) => (
                          <div key={provider.provider} className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value={provider.provider} 
                              id={provider.provider}
                              disabled={!provider.available || isLoading}
                            />
                            <Label 
                              htmlFor={provider.provider} 
                              className={`flex items-center gap-3 cursor-pointer ${
                                !provider.available ? 'text-gray-400' : ''
                              }`}
                            >
                              <span className="font-medium">{provider.name}</span>
                              {provider.available ? (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                  Disponibile
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-gray-500">
                                  API Key Mancante
                                </Badge>
                              )}
                              {aiProvider === provider.provider && (
                                <Badge className="text-xs bg-blue-100 text-blue-700">
                                  In Uso
                                </Badge>
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    
                    {aiProvider === 'openai' && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-start gap-2">
                          <Bot className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="text-xs text-blue-700">
                            <p className="font-medium mb-1">OpenAI GPT-4o Attivo</p>
                            <p>• Modello: GPT-4o (più recente e performante)</p>
                            <p>• Supporto multimodale (testo e immagini)</p>
                            <p>• Ottimo per categorizzazione e matching semantico</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {aiProvider === 'gemini' && (
                      <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-2">
                          <Cpu className="w-4 h-4 text-purple-600 mt-0.5" />
                          <div className="text-xs text-purple-700">
                            <p className="font-medium mb-1">Google Gemini Attivo</p>
                            <p>• Modelli: Gemini 2.5-Flash e 2.5-Pro</p>
                            <p>• Veloce ed efficiente per elaborazioni rapide</p>
                            <p>• Ottimo per analisi semantica e suggerimenti</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Semantic Scoring Configuration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Bot className="text-white w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle>AI Semantic Scoring</CardTitle>
                      <CardDescription>
                        Usa il modello AI selezionato per valutare la qualità semantica dei match prodotto
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="semantic-scoring" className="text-sm font-medium">
                        Attiva Scoring Semantico
                      </Label>
                      <p className="text-xs text-gray-500">
                        Quando attivo, usa l'AI per valutare l'intenzione dell'utente e calcolare 
                        confidenze più realistiche basate su significato e contesto
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {semanticScoring && (
                        <Badge variant="outline" className="text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          AI Attivo
                        </Badge>
                      )}
                      <Switch
                        id="semantic-scoring"
                        checked={semanticScoring}
                        onCheckedChange={handleSemanticScoringChange}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  
                  {semanticScoring && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <Bot className="w-4 h-4 text-blue-600 mt-0.5" />
                        <div className="text-xs text-blue-700">
                          <p className="font-medium mb-1">Scoring Semantico Attivo</p>
                          <p>Il sistema userà OpenAI per analizzare l'intento di ogni ricerca e assegnare confidenze da 30% a 95% basate su:</p>
                          <ul className="mt-1 ml-2 space-y-0.5">
                            <li>• Corrispondenza semantica con l'intento dell'utente</li>
                            <li>• Qualità e rilevanza del prodotto trovato</li>
                            <li>• Soddisfazione del bisogno espresso nella ricerca</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!semanticScoring && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-2">
                        <ToggleLeft className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div className="text-xs text-gray-600">
                          <p className="font-medium mb-1">Sistema Standard</p>
                          <p>Usa il calcolo tradizionale basato su posizione, parole chiave e metadati prodotto (confidenze 70-95%)</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Token Usage Statistics */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <Activity className="text-white w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle>Utilizzo Token AI</CardTitle>
                        <CardDescription>
                          Monitora il consumo di token per le chiamate AI (OpenAI/Gemini)
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetTokens}
                      disabled={isLoading}
                      className="gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Token Totali</span>
                      </div>
                      <div className="text-2xl font-bold text-green-900">
                        {tokenStats.totalTokens.toLocaleString()}
                      </div>
                      <div className="text-xs text-green-600 mt-1">
                        Input + Output combinati
                      </div>
                    </div>
                    
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2 mb-2">
                        <RotateCcw className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Ultimo Reset</span>
                      </div>
                      <div className="text-sm text-blue-900">
                        {tokenStats.lastReset 
                          ? new Date(tokenStats.lastReset).toLocaleString('it-IT')
                          : 'Mai resettato'
                        }
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        Data ultimo azzeramento
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-1">Token utilizzati per:</p>
                      <ul className="space-y-0.5 ml-2">
                        <li>• Semantic scoring prodotti (quando attivo)</li>
                        <li>• Smart suggestions lista spesa</li>
                        <li>• Categorizzazione automatica prodotti</li>
                        <li>• Matching prodotti e-commerce</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <VectorIndexManager />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}