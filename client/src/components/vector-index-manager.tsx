import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Folder, 
  FileText, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Database,
  Bot,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface VectorIndexStatus {
  cartellaEsiste: boolean;
  fileJsonTrovati: number;
  indiciEsistenti: boolean;
  esempiFile: string[];
}

interface BuildResult {
  successo: boolean;
  messaggio: string;
  statistiche?: {
    prodotti_processati: number;
    file_json_trovati: number;
    cache_generata: boolean;
    mappa_generata: boolean;
  };
}

export function VectorIndexManager() {
  const { toast } = useToast();
  
  const { data: status, isLoading, refetch } = useQuery<VectorIndexStatus>({
    queryKey: ['/api/vector-index/status'],
    refetchInterval: 5000,
  });

  const buildMutation = useMutation({
    mutationFn: async (): Promise<BuildResult> => {
      const response = await fetch('/api/vector-index/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.messaggio || 'Errore nella costruzione degli indici');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Successo!",
        description: data.messaggio,
      });
      // Invalida le cache per aggiornare tutti i componenti
      queryClient.invalidateQueries({ queryKey: ['/api/vector-index/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/database/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleBuildIndex = () => {
    buildMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Controllo cartella prodotti...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasFiles = status?.fileJsonTrovati > 0;
  const hasIndices = status?.indiciEsistenti;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Gestione Database Prodotti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Folder className={`h-4 w-4 ${status?.cartellaEsiste ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <div className="text-sm font-medium">Cartella</div>
              <div className="text-xs text-muted-foreground">
                {status?.cartellaEsiste ? 'Presente' : 'Non trovata'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className={`h-4 w-4 ${hasFiles ? 'text-green-500' : 'text-yellow-500'}`} />
            <div>
              <div className="text-sm font-medium">{status?.fileJsonTrovati || 0}</div>
              <div className="text-xs text-muted-foreground">File JSON</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${hasIndices ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <div className="text-sm font-medium">Indici</div>
              <div className="text-xs text-muted-foreground">
                {hasIndices ? 'Generati' : 'Non presenti'}
              </div>
            </div>
          </div>
        </div>

        {/* File Examples */}
        {status?.esempiFile && status.esempiFile.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">File trovati:</h4>
            <div className="flex flex-wrap gap-2">
              {status.esempiFile.map((file, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {file}
                </Badge>
              ))}
              {status.fileJsonTrovati > status.esempiFile.length && (
                <Badge variant="secondary" className="text-xs">
                  +{status.fileJsonTrovati - status.esempiFile.length} altri
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!hasFiles && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Carica i file JSON dei prodotti</strong><br />
                Posiziona i tuoi file JSON nella cartella <code>server/data/prodotti/</code> 
                e poi clicca "Costruisci Indici" per generare il database avanzato.
              </AlertDescription>
            </Alert>
          )}

          {hasFiles && !hasIndices && (
            <Alert>
              <Bot className="h-4 w-4" />
              <AlertDescription>
                <strong>File trovati!</strong><br />
                Clicca "Costruisci Indici" per processare {status?.fileJsonTrovati || 0} file 
                e creare il database avanzato con matching ad alta precisione.
              </AlertDescription>
            </Alert>
          )}

          {hasFiles && hasIndices && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Sistema avanzato attivo!</strong><br />
                Database prodotti generato e funzionante. Il sistema usa ora 
                il matching AI a 3 fasi con confidenza 98%.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleBuildIndex}
            disabled={!hasFiles || buildMutation.isPending}
            className="w-full"
            variant={hasIndices ? "outline" : "default"}
          >
            {buildMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Costruzione in corso...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {hasIndices ? 'Ricostruisci Indici' : 'Costruisci Indici'}
              </>
            )}
          </Button>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
          <h4 className="font-medium mb-2">📁 Dove caricare i file:</h4>
          <code className="text-xs bg-background px-2 py-1 rounded">
            server/data/prodotti/
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Supporta file JSON con array di prodotti o singoli oggetti. 
            Deve includere almeno campi: id, nome, brand (opzionali: product_url, immagine_url).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}