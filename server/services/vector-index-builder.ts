import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

// Percorsi per la gestione dei file
const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const CARTELLA_PRODOTTI = path.join(DATA_DIR, 'prodotti');
const FILE_CACHE_PRODOTTI = path.join(DATA_DIR, 'cache_prodotti_gemini.json');
const FILE_INDICE_MAPPA = path.join(DATA_DIR, 'indice_mappa.json');

interface ProdottoOriginale {
  id: string;
  nome?: string;
  brand?: string;
  C4_SalesDenomination?: string;
  descrizione_tab?: string;
  product_url?: string;
  immagine_url?: string;
  [key: string]: any; // Per breadcrumbs e altri campi dinamici
}

interface ProdottoCache {
  product_details: {
    id: string;
    nome: string;
    marca: string;
    categoria?: string;
    prezzo?: number;
    disponibile?: boolean;
    product_url?: string;
    immagine_url?: string;
    denom_vendita?: string;
  };
  ai_result?: any;
}

class VectorIndexBuilder {
  constructor() {
    this.assicuratiCartelle();
  }

  private assicuratiCartelle() {
    // Crea le cartelle se non esistono
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CARTELLA_PRODOTTI)) {
      fs.mkdirSync(CARTELLA_PRODOTTI, { recursive: true });
    }
  }

  private caricaTuttiIProdotti(): ProdottoOriginale[] {
    const percorsoRicerca = path.join(CARTELLA_PRODOTTI, '*.json');
    const listaFileJson = glob.sync(percorsoRicerca);
    
    if (!listaFileJson.length) {
      console.log(`AVVISO: Nessun file .json trovato nella cartella '${CARTELLA_PRODOTTI}'.`);
      return [];
    }

    console.log(`📁 Trovati ${listaFileJson.length} file JSON nella cartella prodotti:`);
    listaFileJson.forEach(file => {
      console.log(`   - ${path.basename(file)}`);
    });
    
    const tuttiIProdotti: ProdottoOriginale[] = [];
    let totaleProdottiCaricati = 0;

    for (const filePath of listaFileJson) {
      try {
        const nomeFile = path.basename(filePath);
        console.log(`🔄 Processando file: ${nomeFile}`);
        
        const datiFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let prodottiFile = 0;
        
        if (Array.isArray(datiFile)) {
          tuttiIProdotti.push(...datiFile);
          prodottiFile = datiFile.length;
        } else if (datiFile && typeof datiFile === 'object') {
          tuttiIProdotti.push(datiFile);
          prodottiFile = 1;
        } else {
          console.log(`⚠️  File ${nomeFile} non contiene dati validi (né array né oggetto)`);
        }
        
        console.log(`   ✅ ${nomeFile}: ${prodottiFile} prodotti caricati`);
        totaleProdottiCaricati += prodottiFile;
        
      } catch (error) {
        console.error(`❌ Errore nel processare ${path.basename(filePath)}:`, error);
      }
    }

    console.log(`\n📊 RIEPILOGO CARICAMENTO:`);
    console.log(`   • File processati: ${listaFileJson.length}`);
    console.log(`   • Prodotti totali caricati: ${tuttiIProdotti.length}`);
    console.log(`   • Prodotti unici (dopo dedup): ${new Set(tuttiIProdotti.map(p => p.id)).size}`);
    
    return tuttiIProdotti;
  }

  private creaTestoCombinatoPerProdotto(prodotto: ProdottoOriginale): string {
    // Estrai breadcrumbs
    const breadcrumbsList: string[] = [];
    Object.keys(prodotto).forEach(key => {
      if (key.startsWith('breadcrumbs_') && key.endsWith('_htmlValue')) {
        const value = prodotto[key];
        if (typeof value === 'string' && value.trim()) {
          breadcrumbsList.push(value);
        }
      }
    });

    const categoriaRetailer = breadcrumbsList.slice(1).join(' > ');

    // Combina tutti i testi rilevanti
    const testoCompleto = [
      prodotto.nome || '',
      prodotto.brand || '',
      prodotto.C4_SalesDenomination || '',
      prodotto.descrizione_tab || '',
      categoriaRetailer
    ].filter(Boolean).join('. ');

    return testoCompleto;
  }

  private estraiDatiEsistenti(prodotto: ProdottoOriginale): any {
    // Estrai breadcrumbs per categoria
    const breadcrumbsList: string[] = [];
    Object.keys(prodotto).forEach(key => {
      if (key.startsWith('breadcrumbs_') && key.endsWith('_htmlValue')) {
        const value = prodotto[key];
        if (typeof value === 'string' && value.trim()) {
          breadcrumbsList.push(value);
        }
      }
    });

    // Usa l'ultimo breadcrumb come categoria, o fallback
    const categoria = breadcrumbsList[breadcrumbsList.length - 1] || "Alimentari";
    
    // Estrai prezzo se presente nei dati, altrimenti usa default
    // Prova diversi campi possibili per il prezzo
    let prezzo = 3.50; // default fallback
    
    if (prodotto.price_sales_value && typeof prodotto.price_sales_value === 'number') {
      prezzo = prodotto.price_sales_value;
    } else if (prodotto.price_sales_decimalPrice) {
      prezzo = parseFloat(prodotto.price_sales_decimalPrice);
    } else if (prodotto.impression_price) {
      prezzo = parseFloat(prodotto.impression_price);
    } else if (typeof prodotto.prezzo === 'number') {
      prezzo = prodotto.prezzo;
    } else if (typeof prodotto.price === 'number') {
      prezzo = prodotto.price;
    }
    
    // Assicurati che il prezzo sia valido
    if (isNaN(prezzo) || prezzo <= 0) {
      prezzo = 3.50;
    }
    
    // Crea parole chiave dai dati esistenti
    const paroleChiave = [
      prodotto.nome?.toLowerCase(),
      prodotto.brand?.toLowerCase(),
      categoria.toLowerCase()
    ].filter(Boolean);

    return {
      categoria: categoria,
      prezzo_stimato: Number(prezzo),
      parole_chiave: paroleChiave,
      disponibile: prodotto.disponibile !== false
    };
  }

  async costruisciTutto(): Promise<{ successo: boolean; messaggio: string; statistiche?: any }> {
    try {
      console.log("🏗️ Inizio costruzione indici vettoriali...");

      // Rimuovi file esistenti
      for (const fileDaRimuovere of [FILE_CACHE_PRODOTTI, FILE_INDICE_MAPPA]) {
        if (fs.existsSync(fileDaRimuovere)) {
          fs.unlinkSync(fileDaRimuovere);
          console.log(`Rimosso vecchio file: ${path.basename(fileDaRimuovere)}`);
        }
      }

      // Carica prodotti
      const prodotti = this.caricaTuttiIProdotti();
      if (!prodotti.length) {
        return {
          successo: false,
          messaggio: "Nessun prodotto trovato nella cartella prodotti. Carica prima i file JSON."
        };
      }

      console.log("📦 Processamento dati prodotti esistenti...");
      const mappaIndice: Record<string, number> = {};
      const cacheProdotti: Record<string, ProdottoCache> = {};

      // Processa ogni prodotto
      for (let i = 0; i < prodotti.length; i++) {
        const prodotto = prodotti[i];
        const productId = prodotto.id;

        if (!productId) {
          console.log(`Saltato prodotto senza ID alla posizione ${i}`);
          continue;
        }

        console.log(`Processando ${i + 1}/${prodotti.length}: ${prodotto.nome || productId}`);

        // Estrai dati esistenti senza AI
        const datiEstratti = this.estraiDatiEsistenti(prodotto);

        // Crea entry nella mappa indice
        mappaIndice[productId] = i;

        // Crea entry nella cache prodotti
        cacheProdotti[productId] = {
          product_details: {
            id: productId,
            nome: prodotto.nome || '',
            marca: prodotto.brand || '',
            categoria: datiEstratti.categoria || 'Alimentari',
            prezzo: datiEstratti.prezzo_stimato || 3.50,
            disponibile: datiEstratti.disponibile !== false,
            product_url: prodotto.product_url || '',
            immagine_url: prodotto.immagine_url || '',
            denom_vendita: prodotto.C4_SalesDenomination || ''
          },
          ai_result: datiEstratti
        };
      }

      // Salva i file
      console.log(`\n🔄 Salvataggio files...`);
      console.log(`   • Mappa indice: ${Object.keys(mappaIndice).length} prodotti`);
      console.log(`   • Cache prodotti: ${Object.keys(cacheProdotti).length} prodotti`);
      
      fs.writeFileSync(FILE_INDICE_MAPPA, JSON.stringify(mappaIndice, null, 2));
      console.log(`✅ Mappa indice salvata: ${Object.keys(mappaIndice).length} prodotti`);

      fs.writeFileSync(FILE_CACHE_PRODOTTI, JSON.stringify(cacheProdotti, null, 2));
      console.log(`✅ Cache prodotti salvata: ${Object.keys(cacheProdotti).length} prodotti`);

      console.log("🎉 PROCESSO DI PREPARAZIONE COMPLETATO!");

      return {
        successo: true,
        messaggio: "Indici vettoriali costruiti con successo",
        statistiche: {
          prodotti_processati: Object.keys(cacheProdotti).length,
          file_json_trovati: glob.sync(path.join(CARTELLA_PRODOTTI, '*.json')).length,
          cache_generata: fs.existsSync(FILE_CACHE_PRODOTTI),
          mappa_generata: fs.existsSync(FILE_INDICE_MAPPA)
        }
      };

    } catch (error: any) {
      console.error("❌ Errore nella costruzione degli indici:", error);
      return {
        successo: false,
        messaggio: `Errore: ${error.message}`
      };
    }
  }

  verificaStato(): { 
    cartellaEsiste: boolean; 
    fileJsonTrovati: number; 
    indiciEsistenti: boolean;
    esempiFile: string[];
  } {
    const cartellaEsiste = fs.existsSync(CARTELLA_PRODOTTI);
    const fileJsonTrovati = cartellaEsiste ? glob.sync(path.join(CARTELLA_PRODOTTI, '*.json')).length : 0;
    const indiciEsistenti = fs.existsSync(FILE_CACHE_PRODOTTI) && fs.existsSync(FILE_INDICE_MAPPA);
    
    // Ottieni esempi di file
    let esempiFile: string[] = [];
    if (cartellaEsiste) {
      const files = glob.sync(path.join(CARTELLA_PRODOTTI, '*.json')).slice(0, 3);
      esempiFile = files.map((f: string) => path.basename(f));
    }

    return {
      cartellaEsiste,
      fileJsonTrovati,
      indiciEsistenti,
      esempiFile
    };
  }
}

// Istanza singleton
export const vectorIndexBuilder = new VectorIndexBuilder();

// Funzioni di utilità per le API
export async function costruisciIndiciVettoriali() {
  return await vectorIndexBuilder.costruisciTutto();
}

export function verificaStatoCartellaProdotti() {
  return vectorIndexBuilder.verificaStato();
}