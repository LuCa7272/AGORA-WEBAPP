// FILE: server/services/openai.ts (VERSIONE CORRETTA E COMPLETA)

import OpenAI from "openai";
import { enhancedProductMatching, advancedMatcher } from './advanced-matching.js';

// Variabile per contenere l'istanza del client (inizialmente null)
let openai: OpenAI | null = null;

/**
 * Funzione "lazy" per ottenere l'istanza del client OpenAI.
 * La crea solo la prima volta che viene chiamata.
 */
export function getOpenAIClient(): OpenAI {
  if (openai) {
    return openai;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "default_key") {
    // Se la chiave non è valida, lancia un errore che blocca il server all'avvio.
    // In questo modo ci accorgiamo subito del problema.
    throw new Error(
      "OPENAI_API_KEY non è impostata o non è valida nel file .env. Impossibile avviare il servizio AI."
    );
  }

  console.log("✅ Inizializzazione del client OpenAI con la chiave API.");
  openai = new OpenAI({ apiKey });
  return openai;
}


/**
 * Funzione per tracciare l'utilizzo dei token
 */
export function trackTokenUsage(inputTokens: number, outputTokens: number, operation: string) {
  const totalTokens = inputTokens + outputTokens;
  
  // Incrementa il contatore globale
  if (!(global as any).TOTAL_TOKENS_USED) {
    (global as any).TOTAL_TOKENS_USED = 0;
  }
  (global as any).TOTAL_TOKENS_USED += totalTokens;
  
  console.log(`📊 Token usage - ${operation}: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total (Totale: ${(global as any).TOTAL_TOKENS_USED})`);
}

export interface ProductMatch {
  originalItem: string;
  matchedProduct: string;
  confidence: number;
  platform: string;
  productId?: string;
  productUrl?: string;
  imageUrl?: string;
  price?: number;
  category?: string;
  description?: string;
  brand?: string;
}

export interface SuggestionRequest {
  itemName: string;
  lastPurchaseDate: Date;
  averageFrequency: number;
  purchaseHistory: Array<{
    datePurchased: Date;
    daysSinceAdded: number;
  }>;
}

export interface SuggestionResponse {
  itemName: string;
  confidence: number;
  reasoning: string;
  category?: string;
}

/**
 * Interfaccia per la valutazione semantica dei prodotti
 */
export interface ProductEvaluation {
  confidence: number; // 0-100
  reasoning: string;
  semanticMatch: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface ProductForEvaluation {
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
}

/**
 * Valuta semanticamente quanto un prodotto corrisponde all'intento dell'utente
 */
export async function evaluateProductMatch(userQuery: string, product: ProductForEvaluation): Promise<ProductEvaluation> {
  try {
    const client = getOpenAIClient(); // Usa la funzione per ottenere il client
    const prompt = `
Analizza l'intento dell'utente dietro questa ricerca: "${userQuery}"

Valuta quanto questo prodotto soddisfa l'intento dell'utente:
- Nome: ${product.name}
- Marca: ${product.brand}
- Categoria: ${product.category}  
- Descrizione: ${product.description}
- Prezzo: €${product.price}

Considera:
1. Corrispondenza semantica: il prodotto corrisponde a quello che l'utente sta davvero cercando?
2. Qualità dell'intento: l'utente ha espresso una ricerca specifica o generica?
3. Soddisfazione del bisogno: questo prodotto risolverebbe il bisogno dell'utente?

Fornisci la risposta in formato JSON:
{
  "confidence": [numero da 30 a 95],
  "reasoning": "[spiegazione breve del perché questa confidenza]",
  "semanticMatch": "[excellent/good/fair/poor]"
}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3
    });

    if (response.usage) {
      trackTokenUsage(
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
        'Semantic Product Evaluation'
      );
    }

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      confidence: Math.max(30, Math.min(95, result.confidence || 70)),
      reasoning: result.reasoning || 'Valutazione automatica',
      semanticMatch: result.semanticMatch || 'good'
    };

  } catch (error) {
    console.error('Errore nella valutazione semantica:', error);
    return {
      confidence: 70,
      reasoning: 'Errore nella valutazione AI, usando valore predefinito',
      semanticMatch: 'good'
    };
  }
}

export async function generateSmartSuggestions(
  purchaseHistory: Array<{
    itemName: string;
    lastPurchaseDate?: Date;
    averageFrequency?: number;
    purchaseCount: number;
  }>
): Promise<SuggestionResponse[]> {
  try {
    const client = getOpenAIClient(); // Usa la funzione per ottenere il client
    const prompt = `
    Analizza questi dati di cronologia acquisti e suggerisci prodotti che l'utente potrebbe aver bisogno di comprare presto.
    Considera i pattern di frequenza, il tempo dall'ultimo acquisto e i fattori stagionali.
    
    Cronologia Acquisti:
    ${purchaseHistory.map((item: any) => `
    - ${item.itemName}: Ultimo acquisto ${item.lastPurchaseDate ? Math.floor((Date.now() - new Date(item.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24)) + ' giorni fa' : 'mai'}, Frequenza media: ${item.averageFrequency || 'sconosciuta'} giorni, Totale acquisti: ${item.purchaseCount}
    `).join('')}
    
    Rispondi con un oggetto JSON contenente un array di suggerimenti in questo formato:
    {
      "suggestions": [
        {
          "itemName": "string (nome prodotto in italiano)",
          "confidence": number (0-1),
          "reasoning": "string spiegando perché questo prodotto è suggerito (in italiano)",
          "category": "string (categoria in italiano, opzionale)"
        }
      ]
    }
    
    Suggerisci solo prodotti con confidenza > 0.6 e limita a 5 suggerimenti.
    Tutti i nomi prodotti, categorie e ragionamenti devono essere in italiano.
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Sei un assistente intelligente per la spesa che analizza i pattern di acquisto per suggerire prodotti di cui gli utenti potrebbero aver bisogno. Rispondi solo con JSON valido. Tutti i testi devono essere in italiano."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    if (response.usage) {
      trackTokenUsage(
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
        'Smart Suggestions Generation'
      );
    }

    const result = JSON.parse(response.choices[0].message.content || '{"suggestions": []}');
    console.log('AI suggestions response:', result);
    
    if (Array.isArray(result)) {
      return result;
    }
    if (result.suggestions && Array.isArray(result.suggestions)) {
      return result.suggestions;
    }
    console.warn('Unexpected AI response format:', result);
    return [];
  } catch (error) {
    console.error('Error generating smart suggestions:', error);
    return [];
  }
}

export async function matchProductsToEcommerce(
  items: string[] | any,
  platform: string = "carrefour",
  skip: number = 0
): Promise<ProductMatch[]> {
  console.log('matchProductsToEcommerce called with:', { items, platform });
  
  let itemsArray: string[];
  if (Array.isArray(items)) {
    itemsArray = items.map(item => (typeof item === 'object' && item.name) ? item.name : String(item));
  } else {
    itemsArray = [items?.name || String(items)];
  }
  
  console.log('Converted items to array:', itemsArray);
  
  if (advancedMatcher.isDatabaseAvailable()) {
    console.log('🚀 Usando sistema di matching avanzato con AI strutturata');
    try {
      const advancedResults = await enhancedProductMatching(itemsArray, platform, skip);
      if (advancedResults.length > 0) {
        console.log(`✅ Sistema avanzato ha trovato ${advancedResults.length} match di alta qualità`);
        return advancedResults;
      }
    } catch (error) {
      console.error('Errore nel sistema avanzato, fallback al sistema standard:', error);
    }
  } else {
    console.log('📦 Database prodotti non disponibile, usando sistema OpenAI standard');
    console.log('Stats sistema avanzato:', advancedMatcher.getStats());
  }
  
  try {
    const client = getOpenAIClient(); // Usa la funzione per ottenere il client
    const prompt = `
    Abbina questi prodotti generici della lista spesa a prodotti specifici disponibili su ${platform}.
    IMPORTANTE: Abbina SOLO prodotti che conosci esistere realmente su ${platform}. Se non sei sicuro, NON includerlo.
    
    Prodotti da abbinare:
    ${itemsArray.map(item => `- ${item}`).join('\n')}
    
    Rispondi con un oggetto JSON in questo formato:
    {
      "matches": [
        {
          "originalItem": "string",
          "matchedProduct": "string (nome prodotto specifico)",
          "confidence": number (0-1),
          "productId": "string (ID realistico)",
          "productUrl": "string (URL diretto)",
          "imageUrl": "string (URL immagine)",
          "price": number (prezzo in EUR)",
          "category": "string (categoria in italiano)"
        }
      ]
    }
    
    REGOLE: 
    - Se non conosci prodotti specifici reali su ${platform}, restituisci {"matches": []}
    - Non inventare nomi, brand, URL, ID, o immagini.
    - Tutti i testi in italiano.
    - Confidenze realistiche (0.3-0.95).
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Sei un esperto di e-commerce. Abbina prodotti generici SOLO a prodotti specifici reali su ${platform}. Se non ne conosci, restituisci una lista vuota. Rispondi solo con JSON.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    if (response.usage) {
      trackTokenUsage(
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
        'E-commerce Product Matching'
      );
    }

    const rawContent = response.choices[0].message.content || '{"matches": []}';
    console.log('OpenAI raw response:', rawContent);
    const result = JSON.parse(rawContent);

    // --- MODIFICA CHIAVE: Aggiungiamo il campo 'platform' ai risultati del fallback ---
    const matchesWithPlatform = (result.matches || []).map((match: any) => ({
        ...match,
        platform: platform, // <-- ECCO LA CORREZIONE!
    }));

    return matchesWithPlatform;
  } catch (error) {
    console.error('Error matching products:', error);
    return [];
  }
}

export async function categorizeItem(itemName: string): Promise<string> {
  try {
    const client = getOpenAIClient(); // Usa la funzione per ottenere il client
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Sei un esperto di categorizzazione. Categorizza i prodotti in categorie standard italiane. Rispondi con JSON contenente solo la categoria."
        },
        {
          role: "user",
          content: `Categorizza: "${itemName}". 
          DEVI usare SOLO una di queste categorie italiane: Condimenti, Conserve, Latticini, Carne, Pesce, Frutta, Verdura, Cereali, Bevande, Dolci, Surgelati, Igiene, Casa, Altri.
          Rispondi SOLO con JSON: {"category": "nome_categoria_italiana"}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    if (response.usage) {
      trackTokenUsage(
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
        'Item Categorization'
      );
    }

    const result = JSON.parse(response.choices[0].message.content || '{"category": "Altri"}');
    return result.category;
  } catch (error) {
    console.error('Error categorizing item:', error);
    return "Altri";
  }
}

export interface AIShoppingSuggestion {
  id: string;
  name: string;
  category: string;
  quantity?: string;
  reason: string;
  selected: boolean;
}

export async function generateAIShoppingList(requirement: string): Promise<AIShoppingSuggestion[]> {
  try {
    const client = getOpenAIClient(); // Usa la funzione per ottenere il client
    const prompt = `
    L'utente ha questa esigenza: "${requirement}"
    
    Genera una lista di prodotti necessari.
    
    Categorie disponibili: Frutta e Verdura, Latticini, Pane e Cereali, Bevande, Uova, Carne e Pesce, Dolci, Surgelati, Casa e Cura, Altri.

    Rispondi con un oggetto JSON:
    {
      "products": [
        {
          "id": "string",
          "name": "string (nome in italiano, minuscolo)",
          "category": "string (una delle categorie sopra)",
          "quantity": "string (opzionale)",
          "reason": "string (perché serve)"
        }
      ]
    }
    
    Genera 5-15 prodotti rilevanti. Tutti i testi in italiano.
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    const products = parsed.products || [];

    return products.map((product: any, index: number) => ({
      id: product.id || `ai-${Date.now()}-${index}`,
      name: product.name || 'prodotto sconosciuto',
      category: product.category || 'Altri',
      quantity: product.quantity,
      reason: product.reason || 'Suggerito dall\'AI',
      selected: true
    }));

  } catch (error) {
    console.error('Error generating AI shopping list:', error);
    throw new Error('Impossibile generare la lista AI');
  }
}