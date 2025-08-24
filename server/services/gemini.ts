import * as fs from "fs";
import * as yaml from 'js-yaml';
import { GoogleGenAI } from "@google/genai";
import { promptManager } from './prompt-manager.js';

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
      categories = ['Frutta e Verdura', 'Carne e Pesce', 'Latticini e Uova', 'Pane e Cereali', 'Pasta e Riso', 'Condimenti e Conserve', 'Dolci e Snack', 'Bevande', 'Surgelati', 'Prodotti per la Casa', 'Cura Persona', 'Altri'];
      console.warn(`⚠️  Utilizzo della lista di categorie di fallback.`);
    }
  }
  return categories;
}

getCategories();

// --- FUNZIONI SPECIFICHE PER GEMINI ---

export async function processItem(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const availableCategories = getCategories();
    const { finalPrompt } = promptManager.getPrompt('processShoppingListItem', {
      text: text,
      categories: availableCategories.join('\n- '),
    });

    try {
        const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const responseText = response.text();
        const cleanedResult = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedResult);

        const name = parsed.name || text;
        const quantity = parsed.quantity || null;
        const category = availableCategories.includes(parsed.category) ? parsed.category : 'Altri';

        return { name, quantity, category };
    } catch (error) {
        console.error('Errore in processItem con Gemini:', error);
        return { name: text, quantity: null, category: 'Altri' };
    }
}

// --- NUOVA FUNZIONE IMPLEMENTATA PER GEMINI ---
export async function generateAIShoppingList(requirement: string): Promise<any[]> {
  try {
    const availableCategories = getCategories();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-pro" }); // Usiamo un modello più potente per questo task

    const { finalPrompt } = promptManager.getPrompt('generateListFromRequirement', {
      requirement: requirement,
      categories: availableCategories.join('\n- ')
    });

    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const content = response.text();

    if (!content) throw new Error('No response from Gemini');
    
    const cleanedResult = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedResult);
    
    return (parsed.products || []).map((p: any, i: number) => ({ ...p, id: p.id || `ai-${Date.now()}-${i}`, selected: true }));

  } catch (error) {
    console.error('Error generating AI shopping list with Gemini:', error);
    throw new Error('Impossibile generare la lista AI con Gemini');
  }
}