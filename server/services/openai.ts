import * as fs from "fs";
import * as yaml from 'js-yaml';
import OpenAI from "openai";
import { enhancedProductMatching, advancedMatcher } from './advanced-matching.js';
import { promptManager } from './prompt-manager.js';

// --- CLIENT SETUP (invariato) ---
let openai: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
  if (openai) return openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "default_key") {
    throw new Error("OPENAI_API_KEY non è impostata o non è valida nel file .env.");
  }
  console.log("✅ Inizializzazione del client OpenAI.");
  openai = new OpenAI({ apiKey });
  return openai;
}

// --- CATEGORY MANAGEMENT (invariato) ---
let categories: string[] = [];
function getCategories(): string[] {
  if (categories.length === 0) {
    try {
      const fileContents = fs.readFileSync('server/config/categories.yaml', 'utf8');
      const loadedCategories = yaml.load(fileContents);
      if (Array.isArray(loadedCategories) && loadedCategories.every(i => typeof i === 'string')) {
        categories = loadedCategories as string[];
      } else {
        throw new Error("Il file categories.yaml non è un array di stringhe valido.");
      }
    } catch (e) {
      console.error("Errore durante la lettura di server/config/categories.yaml:", e);
      categories = ['Frutta e Verdura', 'Carne e Pesce', 'Latticini e Uova', 'Pane e Cereali', 'Pasta e Riso', 'Condimenti e Conserve', 'Dolci e Snack', 'Bevande', 'Surgelati', 'Prodotti per la Casa', 'Cura Persona', 'Altri'];
    }
  }
  return categories;
}
getCategories();

// --- processItem (invariato) ---
export async function processItem(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const availableCategories = getCategories();
    const client = getOpenAIClient();
    const { finalPrompt, parameters } = promptManager.getPrompt('processShoppingListItem', {
      text: text,
      categories: availableCategories.join('\n- '),
    });
    try {
        const response = await client.chat.completions.create({
            model: parameters.model || "gpt-4o",
            messages: [
                { role: "system", content: "Sei un assistente che estrae dati strutturati dal testo. Rispondi solo con JSON valido."}, 
                { role: "user", content: finalPrompt }
            ],
            response_format: parameters.response_format || { type: "json_object" },
            temperature: parameters.temperature || 0.1,
        });
        const result = JSON.parse(response.choices[0].message.content || '{}');
        const name = result.name || text;
        const quantity = result.quantity || null;
        const category = availableCategories.includes(result.category) ? result.category : 'Altri';
        return { name, quantity, category };
    } catch (error) {
        console.error('Errore in processItem con OpenAI:', error);
        return { name: text, quantity: null, category: 'Altri' };
    }
}

// --- generateAIShoppingList (MODIFICATO) ---
export async function generateAIShoppingList(requirement: string): Promise<any[]> {
  try {
    const client = getOpenAIClient();
    const availableCategories = getCategories();

    // --- NUOVA LOGICA: ESTRAZIONE NUMERO PERSONE ---
    const peopleMatch = requirement.match(/\bper\s+(\d+)\b/i);
    const peopleCount = peopleMatch ? peopleMatch[1] : "non specificato";
    console.log(`👤 Numero di persone estratto dalla richiesta: ${peopleCount}`);

    const { finalPrompt, parameters } = promptManager.getPrompt('generateListFromRequirement', {
      requirement: requirement,
      peopleCount: peopleCount, // Passiamo la nuova variabile
      categories: availableCategories.join('\n- ')
    });

    const response = await client.chat.completions.create({
      model: parameters.model || "gpt-4o",
      messages: [{ role: "user", content: finalPrompt }],
      response_format: parameters.response_format,
      temperature: parameters.temperature,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content);
    return (parsed.products || []).map((p: any, i: number) => ({ ...p, id: p.id || `ai-${Date.now()}-${i}`, selected: true }));

  } catch (error) {
    console.error('Error generating AI shopping list:', error);
    throw new Error('Impossibile generare la lista AI');
  }
}

// --- OTHER AI FUNCTIONS (invariato) ---
export async function generateSmartSuggestions(history: any[]): Promise<any[]> {
  if (history.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const { finalPrompt, parameters } = promptManager.getPrompt('generateFromHistory', {
    purchaseHistory: JSON.stringify(history, null, 2),
    currentDate: new Date().toISOString().split('T')[0],
  });

  try {
    const response = await client.chat.completions.create({
      model: parameters.model || "gpt-4o",
      messages: [
        { role: "system", content: "Sei un assistente che analizza la cronologia degli acquisti per suggerire prodotti da ricomprare. Rispondi solo con JSON valido." },
        { role: "user", content: finalPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: parameters.temperature || 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("Nessun contenuto nella risposta di OpenAI.");
      return [];
    }

    const parsed = JSON.parse(content);
    return parsed.suggestions || [];

  } catch (error) {
    console.error('Errore durante la generazione dei suggerimenti intelligenti:', error);
    return []; // Ritorna un array vuoto in caso di errore
  }
}
export async function matchProductsToEcommerce(items: string[], platform: string, skip: number = 0): Promise<any[]> { console.log('matchProductsToEcommerce not fully implemented in openai.ts'); return []; }
export async function evaluateProductMatch(userQuery: string, product: any): Promise<any> { console.log('evaluateProductMatch not fully implemented in openai.ts'); return { confidence: 50, reasoning: 'Not implemented' }; }