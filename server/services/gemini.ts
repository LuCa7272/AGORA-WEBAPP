import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Token tracking function (replicata da openai.ts)
function trackTokenUsage(inputTokens: number, outputTokens: number, operation: string) {
  const totalTokens = inputTokens + outputTokens;
  
  // Incrementa il contatore globale
  if (!(global as any).TOTAL_TOKENS_USED) {
    (global as any).TOTAL_TOKENS_USED = 0;
  }
  (global as any).TOTAL_TOKENS_USED += totalTokens;
  
  console.log(`📊 Token usage - ${operation}: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total (Totale: ${(global as any).TOTAL_TOKENS_USED})`);
}

export async function categorizeItemGemini(itemName: string): Promise<string> {
  try {
    const prompt = `Categorizza questo prodotto alimentare italiano in una delle seguenti categorie esatte:
    
Categorie disponibili:
- Frutta e Verdura
- Carne e Pesce  
- Latticini e Uova
- Pane e Cereali
- Pasta e Riso
- Condimenti e Conserve
- Dolci e Snack
- Bevande
- Surgelati
- Prodotti per la Casa
- Cura Persona
- Altri

Prodotto: "${itemName}"

Rispondi solo con il nome esatto della categoria.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const result = response.text || "Altri";

    // Traccia utilizzo token (Gemini non fornisce conteggi precisi, uso stime)
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(result.length / 4);
    trackTokenUsage(estimatedInputTokens, estimatedOutputTokens, 'Gemini Item Categorization');

    return result.trim();
  } catch (error) {
    console.error('Errore nella categorizzazione Gemini:', error);
    return "Altri";
  }
}

export async function generateSmartSuggestionsGemini(itemStats: any[]): Promise<any[]> {
  try {
    const prompt = `Analizza lo storico degli acquisti e suggerisci 3-5 prodotti che l'utente potrebbe aver bisogno di comprare.

Storico acquisti:
${itemStats.map(item => 
  `- ${item.itemName}: acquistato ${item.purchaseCount} volte, ultima volta ${Math.floor((Date.now() - new Date(item.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))} giorni fa, frequenza media ogni ${Math.round(item.averageFrequency || 0)} giorni`
).join('\n')}

Regole:
1. Suggerisci solo prodotti che l'utente compra regolarmente ma non ha comprato di recente
2. Considera la frequenza media di acquisto
3. Dai priorità ai prodotti essenziali
4. Categorizza correttamente ogni suggerimento
5. Fornisci una spiegazione logica per ogni suggerimento

Rispondi SOLO con un array JSON valido, senza markdown o testo aggiuntivo:
[
{
  "itemName": "nome prodotto",
  "category": "categoria appropriata", 
  "confidence": 0.85,
  "reasoning": "spiegazione del suggerimento"
}
]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    const result = response.text || '[]';
    
    // Traccia utilizzo token
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(result.length / 4);
    trackTokenUsage(estimatedInputTokens, estimatedOutputTokens, 'Gemini Smart Suggestions');

    try {
      // Pulisci il risultato dai markdown tags se presenti
      const cleanedResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedResult);
    } catch (parseError) {
      console.error('Errore nel parsing delle suggerimenti Gemini:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Errore nella generazione suggerimenti Gemini:', error);
    return [];
  }
}

export async function generateAIShoppingListGemini(requirement: string): Promise<any[]> {
  try {
    const prompt = `Genera una lista della spesa basata su questa richiesta: "${requirement}"

Analizza la richiesta e crea una lista di prodotti specifici necessari.

Esempi di richieste:
- "Cena romantica per 2 persone" → ingredienti per piatti romantici
- "Colazione sana per una settimana" → prodotti per colazioni equilibrate  
- "Aperitivo con amici" → snack, bevande, stuzzichini
- "Pranzo veloce per ufficio" → ingredienti per pasti rapidi

Rispondi SOLO con un array JSON valido, senza markdown o testo aggiuntivo:
[
{
  "itemName": "nome prodotto specifico",
  "category": "categoria appropriata", 
  "priority": "alta|media|bassa",
  "reasoning": "perché è necessario per questa richiesta"
}
]

Suggerisci 5-10 prodotti concreti e specifici. Rispondi SOLO con il JSON, nient'altro.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    const result = response.text || '[]';
    
    // Traccia utilizzo token
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(result.length / 4);
    trackTokenUsage(estimatedInputTokens, estimatedOutputTokens, 'Gemini AI Shopping List');

    try {
      // Pulisci il risultato dai markdown tags se presenti
      const cleanedResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedResult);
    } catch (parseError) {
      console.error('Errore nel parsing della lista Gemini:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Errore nella generazione lista AI Gemini:', error);
    return [];
  }
}

export async function matchProductsToEcommerceGemini(items: string[], platform: string): Promise<any[]> {
  try {
    const prompt = `Abbina questi prodotti generici a prodotti specifici disponibili su ${platform}:

Prodotti da abbinare: ${items.join(', ')}

IMPORTANTE: Abbina SOLO se sei sicuro che il prodotto esista realmente su ${platform}. Se non sei sicuro o non conosci prodotti specifici, restituisci un array vuoto [].

Per ogni prodotto che riesci ad abbinare con certezza, fornisci:
- Nome prodotto specifico
- Marca probabile
- Prezzo stimato realistico (€)
- Categoria appropriata
- Confidenza del match (0.3-0.95)

Rispondi SOLO con un array JSON valido, senza markdown o testo aggiuntivo:
[
{
  "originalItem": "prodotto originale",
  "matchedProduct": "nome prodotto specifico",
  "brand": "marca",
  "price": prezzo_numerico,
  "category": "categoria",
  "confidence": 0.85,
  "description": "descrizione breve"
}
]

Se non conosci prodotti specifici reali, restituisci semplicemente: []`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    const result = response.text || '[]';
    
    // Traccia utilizzo token
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(result.length / 4);
    trackTokenUsage(estimatedInputTokens, estimatedOutputTokens, 'Gemini E-commerce Matching');

    try {
      // Pulisci il risultato dai markdown tags se presenti
      const cleanedResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const matches = JSON.parse(cleanedResult);
      
      // Aggiungi URL e immagini simulate per ogni match
      return matches.map((match: any) => ({
        ...match,
        productId: `GEMINI_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        productUrl: `https://www.${platform}.it/prodotti/${match.matchedProduct?.toLowerCase().replace(/\s+/g, '-')}`,
        imageUrl: `https://static.${platform}.it/images/products/placeholder.jpg`
      }));
    } catch (parseError) {
      console.error('Errore nel parsing del matching Gemini:', parseError);
      console.error('Risultato grezzo:', result);
      return [];
    }
  } catch (error) {
    console.error('Errore nel matching e-commerce Gemini:', error);
    return [];
  }
}

export async function evaluateProductMatchGemini(userQuery: string, product: any): Promise<{confidence: number, reasoning: string}> {
  try {
    const prompt = `Valuta quanto bene questo prodotto corrisponde alla richiesta dell'utente.

Richiesta utente: "${userQuery}"
Prodotto:
- Nome: ${product.name}
- Marca: ${product.brand || 'N/A'}
- Categoria: ${product.category || 'N/A'}
- Descrizione: ${product.description || 'N/A'}
- Prezzo: €${product.price || 'N/A'}

Considera:
1. Similitudine semantica tra richiesta e nome prodotto
2. Compatibilità di marca e categoria
3. Appropriatezza del prezzo
4. Qualità della descrizione

Rispondi SOLO con un oggetto JSON valido, senza markdown o testo aggiuntivo:
{
  "confidence": numero_da_30_a_95,
  "reasoning": "spiegazione breve della valutazione"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const result = response.text || '{"confidence": 50, "reasoning": "Valutazione non disponibile"}';
    
    // Traccia utilizzo token
    const estimatedInputTokens = Math.ceil(prompt.length / 4);
    const estimatedOutputTokens = Math.ceil(result.length / 4);
    trackTokenUsage(estimatedInputTokens, estimatedOutputTokens, 'Gemini Semantic Scoring');

    try {
      // Pulisci il risultato dai markdown tags se presenti
      const cleanedResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanedResult);
    } catch (parseError) {
      console.error('Errore nel parsing della valutazione Gemini:', parseError);
      console.error('Risultato grezzo:', result);
      return { confidence: 50, reasoning: "Errore nella valutazione" };
    }
  } catch (error) {
    console.error('Errore nella valutazione prodotto Gemini:', error);
    return { confidence: 50, reasoning: "Errore nella valutazione" };
  }
}