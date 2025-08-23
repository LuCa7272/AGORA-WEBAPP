import * as fs from "fs";
import * as yaml from 'js-yaml';
import OpenAI from "openai";
import { enhancedProductMatching, advancedMatcher } from './advanced-matching.js';

// --- CLIENT SETUP ---
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

// --- CATEGORY MANAGEMENT ---
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

// --- UNIFIED AI FUNCTION ---
export async function processItemText(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const availableCategories = getCategories();
    const client = getOpenAIClient();
    const prompt = `Analizza il seguente testo da una lista della spesa. Estrai il nome pulito del prodotto, la sua quantità (se presente) e assegnalo a una delle categorie fornite.

Testo: "${text}"

Categorie Disponibili:
${availableCategories.map(c => `- ${c}`).join('\n')}

Regole:
1. Estrai il nome del prodotto normalizzandolo (es. maiuscole, singolare/plurale).
2. Estrai la quantità come stringa (es. "6", "1.5L", "500g"). Se non c'è una quantità esplicita, il valore deve essere null.
3. Scegli la categoria più appropriata SOLO dalla lista "Categorie Disponibili".
4. Il nome del prodotto NON deve contenere la quantità.

Rispondi SOLO con un oggetto JSON valido con questa esatta struttura:
{
  "name": "nome prodotto pulito",
  "quantity": "quantità o null",
  "category": "una delle categorie disponibili"
}`;

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Sei un assistente che estrae dati strutturati dal testo. Rispondi solo con JSON valido."}, 
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        const name = result.name || text;
        const quantity = result.quantity || null;
        const category = availableCategories.includes(result.category) ? result.category : 'Altri';

        return { name, quantity, category };

    } catch (error) {
        console.error('Errore in processItemText con OpenAI:', error);
        return { name: text, quantity: null, category: 'Altri' };
    }
}

// --- OTHER AI FUNCTIONS ---
// NOTE: These functions are kept for other parts of the application.

export async function generateAIShoppingList(requirement: string): Promise<any[]> {
  try {
    const client = getOpenAIClient();
    const prompt = `L'utente ha questa esigenza: "${requirement}". Genera una lista di prodotti necessari. Categorie disponibili: ${getCategories().join(', ')}. Rispondi con un oggetto JSON: {"products": [{"id": "string", "name": "string", "category": "string", "quantity": "string", "reason": "string"}]}. Genera 5-15 prodotti.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
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

// Stub for other functions to ensure they exist
export async function generateSmartSuggestions(history: any[]): Promise<any[]> { console.log('generateSmartSuggestions not fully implemented in openai.ts'); return []; }
export async function matchProductsToEcommerce(items: string[], platform: string, skip: number = 0): Promise<any[]> { console.log('matchProductsToEcommerce not fully implemented in openai.ts'); return []; }
export async function evaluateProductMatch(userQuery: string, product: any): Promise<any> { console.log('evaluateProductMatch not fully implemented in openai.ts'); return { confidence: 50, reasoning: 'Not implemented' }; }
