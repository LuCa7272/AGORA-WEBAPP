// FILE: server/services/advanced-matching.ts (VERSIONE COMPLETA CON MODIFICA)

import fs from 'fs';
import path from 'path';
// IMPORTANTE: Importiamo la nostra funzione centralizzata
import { getOpenAIClient } from './openai.js'; 
import { promptManager } from './prompt-manager.js';

// Percorsi per i file di dati (da caricare nella cartella server/data/)
const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const CACHE_PRODOTTI_FILE = path.join(DATA_DIR, 'cache_prodotti_gemini.json');
const INDICE_MAPPA_FILE = path.join(DATA_DIR, 'indice_mappa.json');

// Configurazione
const CANDIDATI_DA_RICERCA_VETTORIALE = 50;
const NUMERO_RISULTATI_FINALI = 5;

interface QueryStrutturata {
  soggetto: string;
  modificatori: string[];
}

interface ProdottoDettagli {
  id: string;
  nome: string;
  marca?: string;
  categoria?: string;
  prezzo?: number;
  disponibile?: boolean;
  product_url?: string;
  immagine_url?: string;
  denom_vendita?: string;
}

interface ProdottoCache {
  product_details: ProdottoDettagli;
  [key: string]: any;
}

class AdvancedProductMatcher {
  private cacheProdotti: Record<string, ProdottoCache> = {};
  private mappaIndice: Record<string, number> = {};
  private dataLoaded = false;

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(CACHE_PRODOTTI_FILE)) {
        const data = fs.readFileSync(CACHE_PRODOTTI_FILE, 'utf-8');
        this.cacheProdotti = JSON.parse(data);
        console.log(`Caricati ${Object.keys(this.cacheProdotti).length} prodotti dalla cache`);
      }
      if (fs.existsSync(INDICE_MAPPA_FILE)) {
        const data = fs.readFileSync(INDICE_MAPPA_FILE, 'utf-8');
        this.mappaIndice = JSON.parse(data);
        console.log(`Caricata mappa indice con ${Object.keys(this.mappaIndice).length} elementi`);
      }
      this.dataLoaded = Object.keys(this.cacheProdotti).length > 0;
      if (!this.dataLoaded) {
        console.log('Dati avanzati non disponibili, usando fallback a OpenAI standard');
      }
    } catch (error) {
      console.error('Errore nel caricamento dati avanzati:', error);
      this.dataLoaded = false;
    }
  }

private async fase1AnalizzaQuery(richiestaUtente: string): Promise<QueryStrutturata | null> {
    console.log('\nFASE 1: Analisi strutturata della query...');

    const { finalPrompt, parameters } = promptManager.getPrompt('advancedMatchingPhase1_AnalyzeQuery', {
      userQuery: richiestaUtente
    });

    try {
      // OTTENIAMO IL CLIENT QUI
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: parameters.model || "gpt-4o", // Usa il modello dal prompt o un fallback
        messages: [
          { role: "system", content: "Sei un assistente esperto nell'analisi di richieste di prodotti. Rispondi sempre con JSON valido." },
          { role: "user", content: finalPrompt }
        ],
        response_format: parameters.response_format || { type: "json_object" },
        temperature: parameters.temperature || 0.2,
      });

      const risultato = JSON.parse(response.choices[0].message.content || '{}');
      console.log(`-> Analisi Query: Soggetto='${risultato.soggetto}', Modificatori=${JSON.stringify(risultato.modificatori)}`);
      return risultato;
    } catch (error) {
      console.error('Errore durante la Fase 1:', error);
      return null;
    }
  }

  private fase2RicercaVettoriale(richiestaUtente: string): ProdottoCache[] {
    console.log('\nFASE 2: Simulazione ricerca vettoriale...');
    if (!this.dataLoaded) {
      console.log('-> Dati non disponibili per ricerca vettoriale');
      return [];
    }
    const mappaSemantica: Record<string, string[]> = { 'patatine': ['patatine', 'chips', 'cipster', 'snack', 'patate', 'fritte'], 'cipster': ['cipster', 'patatine', 'chips', 'snack', 'patate'], 'chips': ['chips', 'patatine', 'cipster', 'snack', 'patate'], 'pasta': ['pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'farfalle'], 'latte': ['latte', 'latticini', 'dairy'], 'carne': ['carne', 'manzo', 'pollo', 'maiale', 'vitello'], 'formaggio': ['formaggio', 'formaggi', 'cheese', 'parmigiano', 'gorgonzola', 'mozzarella'], 'pane': ['pane', 'panino', 'panini', 'bread', 'baguette'], 'acqua': ['acqua', 'water', 'minerale', 'naturale', 'frizzante'], 'biscotti': ['biscotti', 'cookies', 'dolci', 'frollini'], 'yogurt': ['yogurt', 'yougurt', 'latticini', 'dairy'] };
    const terminiRicerca = richiestaUtente.toLowerCase().split(' ');
    const candidati: Array<{ prodotto: ProdottoCache; score: number }> = [];
    const terminiEspansi = new Set(terminiRicerca);
    terminiRicerca.forEach(termine => { if (mappaSemantica[termine]) { mappaSemantica[termine].forEach(sinonimo => terminiEspansi.add(sinonimo)); } });
    const terminiFinali = Array.from(terminiEspansi);
    console.log(`-> Termini espansi semanticamente: ${terminiFinali.join(', ')}`);
    Object.values(this.cacheProdotti).forEach(prodotto => {
      const nome = prodotto.product_details?.nome?.toLowerCase() || '';
      const marca = prodotto.product_details?.marca?.toLowerCase() || '';
      const categoria = prodotto.product_details?.categoria?.toLowerCase() || '';
      const testo = `${nome} ${marca} ${categoria}`;
      let score = 0;
      terminiRicerca.forEach(termine => { if (testo.includes(termine)) { score += 2; } if (nome.includes(termine)) { score += 1; } });
      terminiFinali.forEach(termine => { if (termine.length > 2 && testo.includes(termine)) { score += 0.8; } if (termine.length > 2 && nome.includes(termine)) { score += 0.5; } });
      terminiRicerca.forEach(termine => { if (mappaSemantica[termine]) { mappaSemantica[termine].forEach(sinonimo => { if (categoria.includes(sinonimo)) { score += 0.3; } }); } });
      if (score > 0) { candidati.push({ prodotto, score }); }
    });
    candidati.sort((a, b) => b.score - a.score);
    const risultati = candidati.slice(0, CANDIDATI_DA_RICERCA_VETTORIALE).map(c => c.prodotto);
    console.log(`-> Trovati ${risultati.length} candidati semanticamente simili`);
    if (risultati.length > 0) { console.log(`-> Top 5 risultati: ${risultati.slice(0, 5).map(r => r.product_details?.nome).join(', ')}`); }
    return risultati;
  }

private async fase3RerankingStrutturato(queryStrutturata: QueryStrutturata, prodottiCandidati: ProdottoCache[], maxResults: number = NUMERO_RISULTATI_FINALI): Promise<string[]> {
    if (!prodottiCandidati.length) return [];
    console.log('\nFASE 3: Re-ranking con logica strutturata...');
    const dettagliSemplificati = prodottiCandidati.map(p => ({ id: p.product_details?.id, nome: p.product_details?.nome, marca: p.product_details?.marca, categoria: p.product_details?.categoria }));
    
    const { finalPrompt, parameters } = promptManager.getPrompt('advancedMatchingPhase3_Rerank', {
      subject: queryStrutturata.soggetto,
      modifiers: queryStrutturata.modificatori,
      candidateProducts: dettagliSemplificati,
      maxResults: maxResults
    });

    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: parameters.model || "gpt-4o",
        messages: [
          { role: "system", content: "Sei un assistente esperto nel ranking di prodotti che comprende l'intento dell'utente. PRIORITÃ€ ASSOLUTA: privilegia sempre la forma piÃ¹ diretta e naturale del prodotto cercato, evitando interpretazioni alternative o secondarie. Rispondi sempre con JSON valido seguendo rigorosamente le istruzioni." },
          { role: "user", content: finalPrompt }
        ],
        response_format: parameters.response_format || { type: "json_object" },
        temperature: parameters.temperature || 0.1,
      });

      const risultato = JSON.parse(response.choices[0].message.content || '{}');
      const idRaccomandati = risultato.prodotti_raccomandati || [];
      console.log(`-> Re-ranking completato. ID raccomandati: ${JSON.stringify(idRaccomandati)}`);
      return idRaccomandati;
    } catch (error) {
      console.error('Errore durante la Fase 3:', error);
      return [];
    }
  }

  async cercaAvanzato(richiestaUtente: string, skip: number = 0, limit: number = NUMERO_RISULTATI_FINALI): Promise<ProdottoDettagli[]> {
    console.log(`\n=== RICERCA AVANZATA: "${richiestaUtente}" ===`);
    const queryStrutturata = await this.fase1AnalizzaQuery(richiestaUtente);
    if (!queryStrutturata || !queryStrutturata.soggetto) { console.log('Non sono riuscito a capire il prodotto principale della ricerca.'); return []; }
    const prodottiCandidati = this.fase2RicercaVettoriale(richiestaUtente);
    if (!prodottiCandidati.length) { console.log('Non ho trovato nessun prodotto simile alla ricerca.'); return []; }
    const idRaccomandati = await this.fase3RerankingStrutturato(queryStrutturata, prodottiCandidati, skip + limit + 5);
    if (!idRaccomandati.length) { console.log('Dall\'analisi finale, nessun prodotto corrisponde perfettamente alla richiesta.'); return []; }
    const idPaginati = idRaccomandati.slice(skip, skip + limit);
    const risultatiFinali: ProdottoDettagli[] = [];
    for (const productId of idPaginati) { const prodotto = this.cacheProdotti[productId]; if (prodotto?.product_details) { risultatiFinali.push(prodotto.product_details); } }
    console.log(`\nâœ… Trovati ${risultatiFinali.length} prodotti con matching avanzato`);
    return risultatiFinali;
  }

  isDatabaseAvailable(): boolean { return this.dataLoaded; }
  caricaDatiSeNecessario() {
    console.log('ðŸ”„ Verifica necessitÃ  ricaricamento dati...');
    if (this.dataLoaded && Object.keys(this.cacheProdotti).length > 0) { console.log(`âœ… Dati giÃ  caricati: ${Object.keys(this.cacheProdotti).length} prodotti`); return; }
    console.log('ðŸ”„ Ricaricamento dati in corso...');
    this.loadData();
  }
  getStats() { return { prodottiCaricati: Object.keys(this.cacheProdotti).length, indiciCaricati: Object.keys(this.mappaIndice).length, dataLoaded: this.dataLoaded }; }
  
  // --- MODIFICA INIZIA QUI ---
  /**
   * Cerca un singolo prodotto nella cache in memoria tramite il suo ID (EAN).
   * Questo metodo è estremamente veloce in quanto non interroga il database SQL.
   * Verrà utilizzato dal nostro nuovo endpoint API per la scansione dei codici a barre.
   * @param ean L'ID/EAN del prodotto da cercare.
   * @returns I dettagli del prodotto se trovato, altrimenti null.
   */
  public findProductByEan(ean: string): ProdottoDettagli | null {
    // La chiave del nostro oggetto `cacheProdotti` è proprio l'ID/EAN.
    const cachedProduct = this.cacheProdotti[ean];
    
    // Controlliamo che il prodotto esista e abbia la struttura `product_details`
    if (cachedProduct && cachedProduct.product_details) {
      console.log(`ðŸ“¦ Trovato prodotto in cache per EAN ${ean}: ${cachedProduct.product_details.nome}`);
      return cachedProduct.product_details;
    }
    
    console.log(`ðŸ“¦ Prodotto non trovato in cache per EAN ${ean}`);
    return null;
  }
  // --- MODIFICA FINISCE QUI ---
}

export const advancedMatcher = new AdvancedProductMatcher();

export async function enhancedProductMatching(items: string[], platform: string = "carrefour", skip: number = 0): Promise<any[]> {
  const results = [];
  for (const item of items) {
    console.log(`\nðŸ”  Matching avanzato per: "${item}" (skip: ${skip})`);
    if (advancedMatcher.isDatabaseAvailable()) {
      const prodottiAvanzati = await advancedMatcher.cercaAvanzato(item, skip, 3);
      if (prodottiAvanzati.length > 0) {
        for (let i = 0; i < Math.min(prodottiAvanzati.length, 3); i++) {
          const prodotto = prodottiAvanzati[i];
          const confidence = await calculateAdvancedConfidence(item, prodotto, i, prodottiAvanzati.length);
          results.push({ 
            originalItem: item, 
            matchedProduct: prodotto.nome, 
            confidence: confidence, 
            productId: prodotto.id, 
            productUrl: prodotto.product_url || generateProductUrl(prodotto.id, platform), 
            imageUrl: prodotto.immagine_url || generateImageUrl(prodotto.id, platform), 
            price: prodotto.prezzo || estimatePrice(item), 
            category: prodotto.categoria || "Alimentari", 
            description: prodotto.denom_vendita || prodotto.nome, 
            brand: prodotto.marca || "",
            platform: platform, // <-- CORREZIONE APPLICATA
          });
        }
        continue;
      }
    }
    console.log(`-> Nessun match trovato per "${item}" - skippo prodotto`);
  }
  return results;
}

async function calculateAdvancedConfidence(originalItem: string, prodotto: ProdottoDettagli, position: number, totalResults: number): Promise<number> {
  const isSemanticScoringEnabled = checkSemanticScoringEnabled();
  if (isSemanticScoringEnabled) { return await calculateSemanticConfidence(originalItem, prodotto, position); }
  else { return calculateTraditionalConfidence(originalItem, prodotto, position, totalResults); }
}

function calculateTraditionalConfidence(originalItem: string, prodotto: ProdottoDettagli, position: number, totalResults: number): number {
  let confidence = 0.85;
  const positionBonus = (totalResults - position) / totalResults * 0.1;
  confidence += positionBonus;
  const itemWords = originalItem.toLowerCase().split(' ');
  const productName = prodotto.nome?.toLowerCase() || '';
  const matchingWords = itemWords.filter(word => word.length > 2 && productName.includes(word)).length;
  const wordMatchBonus = (matchingWords / itemWords.length) * 0.1;
  confidence += wordMatchBonus;
  if (prodotto.marca && prodotto.marca.trim() !== '') { confidence += 0.03; }
  if (prodotto.prezzo && prodotto.prezzo > 0) { confidence += 0.02; }
  return Math.max(0.70, Math.min(0.95, confidence));
}

function checkSemanticScoringEnabled(): boolean { return (global as any).SEMANTIC_SCORING_ENABLED || false; }


async function calculateSemanticConfidence(originalItem: string, prodotto: ProdottoDettagli, position: number, totalResults: number): Promise<number> {
  const isSemanticScoringEnabled = checkSemanticScoringEnabled();
  
  if (isSemanticScoringEnabled) {
    try {
      // La funzione 'evaluateProductMatch' ora usa internamente il PromptManager
      const { evaluateProductMatch } = await import('./openai.js');
      console.log(`Ã°Å¸Â§  Valutazione semantica per "${originalItem}" Ã¢â€ â€™ "${prodotto.nome}"`);
      
      const evaluation = await evaluateProductMatch(originalItem, { 
          name: prodotto.nome || '', 
          brand: prodotto.marca || '', 
          category: prodotto.categoria || '', 
          description: prodotto.denom_vendita || '', 
          price: prodotto.prezzo || 0 
      });
      
      console.log(`Ã°Å¸Â§  Risultato AI: ${evaluation.confidence}% (${evaluation.reasoning})`);
      return Math.max(0.30, Math.min(0.95, evaluation.confidence / 100));

    } catch (error) {
      console.error('Errore nel semantic scoring, fallback al sistema tradizionale:', error);
      return calculateTraditionalConfidence(originalItem, prodotto, position, totalResults);
    }
  } else {
    return calculateTraditionalConfidence(originalItem, prodotto, position, totalResults);
  }
}

function generateProductUrl(productId: string, platform: string): string {
  switch (platform.toLowerCase()) {
    case 'carrefour': return `https://www.carrefour.it/prodotti/${productId}`;
    case 'esselunga': return `https://www.esselunga.it/prodotti/${productId}`;
    case 'coop': return `https://www.coopshop.it/product/${productId}`;
    default: return `https://www.${platform}.it/prodotti/${productId}`;
  }
}

function generateImageUrl(productId: string, platform: string): string {
  switch (platform.toLowerCase()) {
    case 'carrefour': return `https://static.carrefour.it/images/products/${productId}.jpg`;
    case 'esselunga': return `https://www.esselunga.it/images/products/${productId}.jpg`;
    case 'coop': return `https://www.coopshop.it/images/${productId}.jpg`;
    default: return `https://www.${platform}.it/images/${productId}.jpg`;
  }
}

function estimatePrice(item: string): number {
  const itemLower = item.toLowerCase();
  if (itemLower.includes('carne') || itemLower.includes('manzo')) return 8.50;
  if (itemLower.includes('formaggio') || itemLower.includes('parmigiano')) return 12.00;
  if (itemLower.includes('pasta') || itemLower.includes('spaghetti')) return 1.20;
  if (itemLower.includes('latte')) return 1.30;
  if (itemLower.includes('pane') || itemLower.includes('panino')) return 2.50;
  return 3.50;
}