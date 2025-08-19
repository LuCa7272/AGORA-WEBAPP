// FILE: client/src/components/purchase-history.tsx

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, Package, BarChart3, Loader2 } from "lucide-react";
import { formatFrequencyText } from "@/lib/frequency-calculator";
import type { PurchaseHistory } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface PurchaseHistoryProps {
  activeListId: number;
}

export default function PurchaseHistory({ activeListId }: PurchaseHistoryProps) {
  const { data: history = [], isLoading } = useQuery<PurchaseHistory[]>({
    queryKey: ["history", activeListId], // Chiave dinamica
    queryFn: async () => {
        if (!activeListId) return [];
        const res = await apiRequest("GET", `/api/lists/${activeListId}/history`);
        return res.json();
    },
    enabled: !!activeListId,
  });

  const stats = {
    totalPurchases: history.length,
    avgFrequency: history.length > 0 
      ? history.reduce((sum, item) => sum + item.daysSinceAdded, 0) / history.length 
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--md-sys-color-primary)]" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="md3-card-elevated p-6 mb-6">
        <h2 className="md3-title-large mb-4 flex items-center">
          <div className="w-10 h-10 md3-secondary-container rounded-2xl flex items-center justify-center mr-3 md3-elevation-1">
            <BarChart3 className="w-5 h-5" />
          </div>
          Statistiche Acquisti
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center md3-primary-container p-4 rounded-2xl">
            <div className="md3-display-small font-bold mb-1">{stats.totalPurchases}</div>
            <div className="md3-body-medium opacity-80">Prodotti comprati</div>
          </div>
          <div className="text-center md3-tertiary-container p-4 rounded-2xl">
            <div className="md3-display-small font-bold mb-1">
              {stats.avgFrequency.toFixed(1)}
            </div>
            <div className="md3-body-medium opacity-80">Giorni medi</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="md3-title-medium flex items-center">
          <div className="w-8 h-8 md3-surface-container-high rounded-lg flex items-center justify-center mr-3">
            <Package className="w-4 h-4" />
          </div>
          Acquisti Recenti
        </h3>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 md3-surface-variant rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10" style={{ color: 'var(--on-surface-variant)' }} />
            </div>
            <h3 className="md3-headline-small mb-3">Nessun acquisto</h3>
            <p className="md3-body-large opacity-70">
              Lo storico degli acquisti per questa lista apparirà qui.
            </p>
          </div>
        ) : (
          history.map((purchase) => (
            <div
              key={purchase.id}
              className="md3-card-elevated p-4 mb-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="md3-title-medium mb-2">{purchase.itemName}</h4>
                  <div className="md3-body-small opacity-70">
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" />
                      Comprato: {format(new Date(purchase.datePurchased), "d MMM yyyy", { locale: it })}
                    </div>
                    <span>{purchase.daysSinceAdded} giorni dopo l'aggiunta</span>
                  </div>
                </div>
                <div className="text-right md3-tertiary-container p-3 rounded-2xl">
                  <div className="md3-body-medium font-medium">
                    {formatFrequencyText(purchase.daysSinceAdded)}
                  </div>
                  <div className="md3-label-small opacity-70">Tempo di acquisto</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}