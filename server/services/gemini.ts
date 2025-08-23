import * as fs from "fs";
import * as yaml from 'js-yaml';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// --- GESTIONE CATEGORIE ---
let categories: string[] = [];

function getCategories(): string[] {
  if (categories.length === 0) {
    try {
      const fileContents = fs.readFileSync('server/config/categories.yaml', 'utf8');
      const loadedCategories = yaml.load(fileContents);
      if (Array.isArray(loadedCategories) && loadedCategories.every(i => typeof i === 'string')) {
        categories = loadedCategories as string[];
        console.log(`✅ Categorie caricate con successo da categories.yaml: ${categories.length} trovate.`);
      } else {
        throw new Error("Il file categories.yaml non è un array di stringhe valido.");
      }
    } catch (e) {
      console.error("Errore durante la lettura di server/config/categories.yaml:", e);
      // Fallback a una lista di default se il file manca o è corrotto
      categories = ['Frutta e Verdura', 'Carne e Pesce', 'Latticini e Uova', 'Pane e Cereali', 'Pasta e Riso', 'Condimenti e Conserve', 'Dolci e Snack', 'Bevande', 'Surgelati', 'Prodotti per la Casa', 'Cura Persona', 'Altri'];
      console.warn(`⚠️ Utilizzo della lista di categorie di fallback.`);
    }
  }
  return categories;
}

// Carica le categorie all'avvio del modulo
getCategories();

// --- FUNZIONE UNIFICATA ---

export async function processItemText(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const availableCategories = getCategories();
    const prompt = `Analizza il seguente testo da una lista della spesa. Estrai il nome pulito del prodotto, la sua quantità (se presente) e assegnarlo a una delle categorie fornite.

Testo: "${text}"

Categorie Disponibili:
${availableCategories.map(c => `- ${c}`).join('\n')}

Regole:
1. Estrai il nome del prodotto normalizzandolo (es. maiuscole, singolare/plurale).
2. Estrai la quantità come stringa (es. "6", "1.5L", "500g"). Se non c'è una quantità esplicita, il valore deve essere null.
3. Scegli la categoria più appropriata SOLO dalla lista "Categorie Disponibili".
4. Il nome del prodotto NON deve contenere la quantità.

Esempi:
- "6 uova" -> { "name": "Uova", "quantity": "6", "category": "Latticini e Uova" }
- "latte 1.5L" -> { "name": "Latte", "quantity": "1.5L", "category": "Latticini e Uova" }
- "Caffè" -> { "name": "Caffè", "quantity": null, "category": "Bevande" }

Rispondi SOLO con un oggetto JSON valido con questa esatta struttura:
{
  "name": "nome prodotto pulito",
  "quantity": "quantità o null",
  "category": "una delle categorie disponibili"
}`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        const result = response.text || '{}';
        const cleanedResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedResult);

        const name = parsed.name || text;
        const quantity = parsed.quantity || null;
        const category = availableCategories.includes(parsed.category) ? parsed.category : 'Altri';

        return { name, quantity, category };

    } catch (error) {
        console.error('Errore in processItemText con Gemini:', error);
        // Fallback in caso di errore AI
        return { name: text, quantity: null, category: 'Altri' };
    }
}

// Le altre funzioni (generateSmartSuggestions, etc.) rimangono qui se necessario, ma le funzioni di categorizzazione e estrazione sono ora unificate.
// Per pulizia, le funzioni non più utilizzate sono state rimosse.
