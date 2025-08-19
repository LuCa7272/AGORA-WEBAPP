// FILE: server/jobs/calculate-layouts.ts (NUOVO FILE)

import { db } from '../db';
import { purchase_events, stores } from '@shared/schema';
import { storage } from '../storage';
import { and, gte, asc, sql, eq } from 'drizzle-orm';

console.log("--- Avvio Job: Calcolo Layout Negozi ---");

// --- CONFIGURAZIONE ---
// Consideriamo gli eventi degli ultimi 30 giorni per mantenere i dati freschi.
const GIORNI_DA_CONSIDERARE = 30;
// Definiamo una "sessione di spesa". Se passano più di 2 ore tra un acquisto e l'altro
// dello stesso utente nello stesso negozio, la consideriamo una nuova visita.
const ORE_SESSIONE_SPESA = 2;

/**
 * Funzione principale del job.
 * Esegue l'intero processo di calcolo e salvataggio dei layout.
 */
async function run() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Inizio elaborazione...`);

  try {
    // 1. Recupera tutti gli eventi di acquisto recenti
    const eventi = await getRecentPurchaseEvents();
    if (eventi.length === 0) {
      console.log("Nessun evento di acquisto recente da analizzare. Uscita.");
      return;
    }
    console.log(`Trovati ${eventi.length} eventi di acquisto negli ultimi ${GIORNI_DA_CONSIDERARE} giorni.`);

    // 2. Raggruppa gli eventi per negozio
    const eventiPerNegozio = groupEventsByStore(eventi);
    const storeIds = Object.keys(eventiPerNegozio).map(Number);
    console.log(`Eventi distribuiti su ${storeIds.length} negozi unici.`);

    // 3. Itera su ogni negozio e calcola il layout
    for (const storeId of storeIds) {
      const eventiNegozio = eventiPerNegozio[storeId];
      console.log(`\n--- Analisi per Negozio ID: ${storeId} (${eventiNegozio.length} eventi) ---`);

      // 4. Calcola l'ordine delle categorie
      const ordineCategorie = calculateCategoryOrder(eventiNegozio);

      if (ordineCategorie.length > 0) {
        // 5. Salva il layout nel database
        await storage.upsertStoreLayout({
          storeId: storeId,
          categoryOrder: ordineCategorie,
        });
        console.log(`âœ… Layout salvato per negozio ${storeId}. Ordine: ${ordineCategorie.join(', ')}`);
      } else {
        console.log(`ðŸš« Dati insufficienti per calcolare il layout per il negozio ${storeId}.`);
      }
    }

  } catch (error) {
    console.error("â Œ Errore critico durante l'esecuzione del job:", error);
    process.exit(1); // Esce con un codice di errore
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n[${new Date().toISOString()}] Job completato con successo in ${duration.toFixed(2)} secondi.`);
  process.exit(0); // Esce con successo
}

/**
 * Recupera tutti gli eventi di acquisto dal database che sono avvenuti
 * negli ultimi `GIORNI_DA_CONSIDERARE`.
 */
async function getRecentPurchaseEvents() {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - GIORNI_DA_CONSIDERARE);

  return db.select()
    .from(purchase_events)
    .where(gte(purchase_events.timestamp, dataLimite.toISOString()))
    .orderBy(asc(purchase_events.userId), asc(purchase_events.timestamp));
}

/**
 * Raggruppa un array di eventi per il loro `storeId`.
 */
function groupEventsByStore(events: (typeof purchase_events.$inferSelect)[]) {
  return events.reduce((acc, event) => {
    if (!acc[event.storeId]) {
      acc[event.storeId] = [];
    }
    acc[event.storeId].push(event);
    return acc;
  }, {} as Record<number, (typeof purchase_events.$inferSelect)[]>);
}

/**
 * L'algoritmo principale per calcolare l'ordine delle categorie.
 * @param events Eventi di acquisto per un singolo negozio.
 * @returns Un array di stringhe con i nomi delle categorie in ordine.
 */
function calculateCategoryOrder(events: (typeof purchase_events.$inferSelect)[]): string[] {
  const sessioniPerUtente: Record<number, Date[][]> = {};
  
  // 1. Dividi gli acquisti di ogni utente in "sessioni"
  const eventiPerUtente = events.reduce((acc, event) => {
      if (!acc[event.userId]) acc[event.userId] = [];
      acc[event.userId].push(event);
      return acc;
  }, {} as Record<number, (typeof purchase_events.$inferSelect)[]>);

  const ordiniDiSessione: string[][] = [];

  for (const userId in eventiPerUtente) {
      const eventiUtente = eventiPerUtente[userId];
      let sessioneCorrente: (typeof purchase_events.$inferSelect)[] = [];

      for (const evento of eventiUtente) {
          if (sessioneCorrente.length === 0) {
              sessioneCorrente.push(evento);
              continue;
          }

          const ultimoTimestamp = new Date(sessioneCorrente[sessioneCorrente.length - 1].timestamp).getTime();
          const timestampCorrente = new Date(evento.timestamp).getTime();
          const oreTrascorse = (timestampCorrente - ultimoTimestamp) / (1000 * 60 * 60);

          if (oreTrascorse > ORE_SESSIONE_SPESA) {
              // Sessione terminata, analizzala e iniziane una nuova
              const ordineSessione = estraiOrdineDaSessione(sessioneCorrente);
              if (ordineSessione.length > 1) ordiniDiSessione.push(ordineSessione);
              sessioneCorrente = [evento];
          } else {
              sessioneCorrente.push(evento);
          }
      }
      // Analizza l'ultima sessione
      const ordineSessione = estraiOrdineDaSessione(sessioneCorrente);
      if (ordineSessione.length > 1) ordiniDiSessione.push(ordineSessione);
  }

  console.log(`Estratte ${ordiniDiSessione.length} sessioni di spesa valide.`);
  
  // 2. Calcola la posizione media per ogni categoria
  const posizioniCategorie: Record<string, number[]> = {};
  for (const ordine of ordiniDiSessione) {
      ordine.forEach((categoria, index) => {
          if (!posizioniCategorie[categoria]) posizioniCategorie[categoria] = [];
          posizioniCategorie[categoria].push(index);
      });
  }

  const posizioniMedie = Object.entries(posizioniCategorie).map(([categoria, posizioni]) => {
      const media = posizioni.reduce((a, b) => a + b, 0) / posizioni.length;
      return { categoria, media, visite: posizioni.length };
  });

  // 3. Filtra e ordina
  // Diamo più peso alle categorie visitate più spesso
  posizioniMedie.sort((a, b) => {
      if (a.visite !== b.visite) {
          return b.visite - a.visite; // Più visite prima
      }
      return a.media - b.media; // A parità di visite, posizione media più bassa prima
  });

  return posizioniMedie.map(item => item.categoria);
}


/**
 * Data una sessione di acquisti, restituisce l'ordine delle categorie uniche.
 */
function estraiOrdineDaSessione(sessione: (typeof purchase_events.$inferSelect)[]): string[] {
    const categorieUnicheViste = new Map<string, Date>();
    for (const evento of sessione) {
        if (!categorieUnicheViste.has(evento.categoryName)) {
            categorieUnicheViste.set(evento.categoryName, new Date(evento.timestamp));
        }
    }
    
    // Ordina le categorie in base al primo timestamp in cui sono apparse
    return Array.from(categorieUnicheViste.entries())
        .sort(([, timeA], [, timeB]) => timeA.getTime() - timeB.getTime())
        .map(([category]) => category);
}


// Esegui la funzione principale
run();