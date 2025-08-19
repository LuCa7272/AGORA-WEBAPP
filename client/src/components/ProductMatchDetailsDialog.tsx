import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, ExternalLink } from "lucide-react";
import type { EcommerceMatch } from "@shared/schema";

interface ProductMatchDetailsDialogProps {
  match: EcommerceMatch;
}

export function ProductMatchDetailsDialog({ match }: ProductMatchDetailsDialogProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!match.imageUrl) {
    // Se non c'è immagine, mostra un placeholder non interattivo
    return (
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-md flex-shrink-0" />
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="relative flex-shrink-0"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          // Usiamo data-state per un selettore CSS robusto
          data-state={isHovered ? 'hover' : 'closed'}
        >
          <img
            src={match.imageUrl}
            alt={match.matchedProduct}
            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer transition-opacity"
            loading="lazy"
          />
          {/* Questo overlay ora è controllato dallo stato di React */}
          <div 
            className={`absolute inset-0 bg-black/50 transition-opacity rounded-md flex items-center justify-center pointer-events-none ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Eye className="h-5 w-5 text-white" />
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{match.matchedProduct}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <img
            src={match.imageUrl}
            alt={match.matchedProduct}
            className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
          />
          <div className="space-y-2 text-sm">
            <p><strong>Marca:</strong> {match.brand || 'Non disponibile'}</p>
            <p><strong>Categoria:</strong> {match.category || 'Non disponibile'}</p>
            <p><strong>Prezzo Stimato:</strong> €{match.price?.toFixed(2) || 'N/A'}</p>
            <p><strong>Confidenza Match:</strong> {(match.confidence * 100).toFixed(0)}%</p>
            {match.description && (
              <p><strong>Descrizione:</strong> {match.description}</p>
            )}
          </div>
          {match.productUrl && (
            <Button asChild variant="outline" className="w-full">
              <a href={match.productUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Visualizza Scheda Prodotto
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}