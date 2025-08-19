import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Database, FileText, Zap } from 'lucide-react';

interface DatabaseStats {
  prodottiCaricati: number;
  indiciCaricati: number;
  dataLoaded: boolean;
}

export function DatabaseStatus() {
  const { data: stats, isLoading } = useQuery<DatabaseStats>({
    queryKey: ['/api/database/stats'],
    refetchInterval: 30000, // Ricarica ogni 30 secondi
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 animate-pulse" />
            <span className="text-sm text-muted-foreground">Controllo database...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isAdvancedAvailable = stats?.dataLoaded || false;
  const prodottiCount = stats?.prodottiCaricati || 0;
  const indiciCount = stats?.indiciCaricati || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Stato Database AI Avanzato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isAdvancedAvailable ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Badge variant="default" className="bg-green-500">
                Sistema Avanzato Attivo
              </Badge>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <Badge variant="secondary">
                Sistema Standard
              </Badge>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-sm font-medium">{prodottiCount}</div>
              <div className="text-xs text-muted-foreground">Prodotti caricati</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-sm font-medium">{indiciCount}</div>
              <div className="text-xs text-muted-foreground">Indici vettoriali</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="text-sm text-muted-foreground">
          {isAdvancedAvailable ? (
            <div className="space-y-2">
              <p className="font-medium text-green-700">✅ Sistema AI avanzato attivo</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Analisi strutturata delle query (soggetto + modificatori)</li>
                <li>Ricerca vettoriale semantica</li>
                <li>Re-ranking intelligente con confidenza 98%</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-yellow-700">⚠️ Database prodotti non caricato</p>
              <p className="text-xs">
                Sistema usa OpenAI standard con confidenza 85%. 
                Per attivare il sistema avanzato, carica i file di dati nella cartella server/data/
              </p>
            </div>
          )}
        </div>

        {/* Files needed */}
        {!isAdvancedAvailable && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium mb-2">File necessari:</h4>
            <ul className="text-xs space-y-1">
              <li>📄 <code>cache_prodotti_gemini.json</code></li>
              <li>📄 <code>indice_mappa.json</code></li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Posiziona questi file in <code>server/data/</code> e riavvia l'applicazione.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}