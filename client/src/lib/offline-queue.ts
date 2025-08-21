// FILE: client/src/lib/offline-queue.ts (AGGIORNATO PER GESTIRE LE CANCELLAZIONI)

import { apiRequest } from "./queryClient";

const OFFLINE_QUEUE_KEY = 'smartcart-offline-action-queue';

// --- MODIFICA 1/3: Definiamo i tipi di azione possibili ---
type ActionType = 'PURCHASE_ITEM' | 'DELETE_ITEM';

interface BaseAction {
  type: ActionType;
  payload: {
    itemId: number;
    // Aggiungiamo dati opzionali che potrebbero servire
    userId?: number;
    storeId?: number | null;
  };
  timestamp: number;
}

// Funzione generica per aggiungere un'azione alla coda
function addActionToQueue(action: BaseAction): void {
  const queue = getOfflineQueue();
  queue.push(action);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

// --- MODIFICA 2/3: Creiamo funzioni specifiche per ogni azione ---
export function addPurchaseToOfflineQueue(itemId: number, userId: number, storeId: number | null): void {
  addActionToQueue({
    type: 'PURCHASE_ITEM',
    payload: { itemId, userId, storeId },
    timestamp: Date.now(),
  });
  console.log(`[Offline] Azione ACQUISTO per item ${itemId} aggiunta alla coda.`);
}

export function addDeleteToOfflineQueue(itemId: number): void {
  addActionToQueue({
    type: 'DELETE_ITEM',
    payload: { itemId },
    timestamp: Date.now(),
  });
  console.log(`[Offline] Azione CANCELLA per item ${itemId} aggiunta alla coda.`);
}


// Recupera la coda da localStorage (la firma non cambia)
export function getOfflineQueue(): BaseAction[] {
  const storedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return storedQueue ? JSON.parse(storedQueue) : [];
}

function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// --- MODIFICA 3/3: Aggiorniamo il processore per gestire entrambi i tipi di azione ---
export async function processOfflineQueue(): Promise<{ success: number; failed: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`[Offline] Trovate ${queue.length} azioni in coda. Inizio sincronizzazione...`);

  let successCount = 0;
  const failedActions: BaseAction[] = [];

  for (const action of queue) {
    try {
      switch (action.type) {
        case 'PURCHASE_ITEM':
          await apiRequest("POST", `/api/items/${action.payload.itemId}/purchase`, {
            storeId: action.payload.storeId,
          });
          console.log(`[Offline] Sincronizzato ACQUISTO per item ${action.payload.itemId}`);
          break;
        
        case 'DELETE_ITEM':
          await apiRequest("DELETE", `/api/items/${action.payload.itemId}`);
          console.log(`[Offline] Sincronizzata CANCELLAZIONE per item ${action.payload.itemId}`);
          break;
      }
      successCount++;
    } catch (error) {
      console.error(`[Offline] Fallita sincronizzazione per azione ${action.type} su item ${action.payload.itemId}:`, error);
      failedActions.push(action);
    }
  }

  if (failedActions.length > 0) {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedActions));
  } else {
    clearOfflineQueue();
    console.log("[Offline] Coda di sincronizzazione svuotata con successo.");
  }

  return { success: successCount, failed: failedActions.length };
}