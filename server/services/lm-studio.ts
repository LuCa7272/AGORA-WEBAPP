// FILE: server/services/lm-studio.ts

import * as fs from "fs";
import * as yaml from 'js-yaml';
import OpenAI from "openai";
import { promptManager } from './prompt-manager.js';

// --- CLIENT SETUP ---
let lmStudioClient: OpenAI | null = null;

export function getLMStudioClient(): OpenAI {
  if (lmStudioClient) return lmStudioClient;
  
  const apiKey = "lm-studio"; 
  
  console.log("✅ Inizializzazione del client per LM Studio.");
  lmStudioClient = new OpenAI({
    apiKey,
    baseURL: "http://localhost:1234/v1"
  });
  return lmStudioClient;
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

// --- FUNZIONI SPECIFICHE PER LM STUDIO ---

export async function processItem(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const availableCategories = getCategories();
    const client = getLMStudioClient();
    
    const { finalPrompt, parameters } = promptManager.getPrompt('processShoppingListItem', {
      text: text,
      categories: availableCategories.join('\n- '),
    });

    try {
        const response = await client.chat.completions.create({
            model: "local-model",
            messages: [
                { role: "system", content: "Sei un assistente che estrae dati e risponde solo in formato JSON."},
                { role: "user", content: finalPrompt }
            ],
            temperature: parameters.temperature || 0.1,
        });

        const content = response.choices[0].message.content || '{}';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
        const name = result.name || text;
        const quantity = result.quantity || null;
        const category = availableCategories.includes(result.category) ? result.category : 'Altri';
        return { name, quantity, category };

    } catch (error: any) {
        console.error('Errore in processItem con LM Studio:', error);
        if (error.code === 'ECONNREFUSED') {
            throw new Error("Impossibile connettersi al server LM Studio. Assicurati che sia in esecuzione su http://localhost:1234.");
        }
        return { name: text, quantity: null, category: 'Altri' };
    }
}

// --- NUOVA IMPLEMENTAZIONE PER LA GENERAZIONE LISTA ---
export async function generateAIShoppingList(requirement: string): Promise<any[]> {
  try {
    const client = getLMStudioClient();
    const availableCategories = getCategories();

    // --- MODIFICA INIZIA QUI ---
    // Aggiungiamo la logica per estrarre il numero di persone
    const peopleMatch = requirement.match(/\bper\s+(\d+)\b/i);
    const peopleCount = peopleMatch ? peopleMatch[1] : "non specificato";
    console.log(`👨‍👩‍👧‍👦 Numero di persone estratto dalla richiesta (LM Studio): ${peopleCount}`);
    // --- MODIFICA FINISCE QUI ---

    const { finalPrompt, parameters } = promptManager.getPrompt('generateListFromRequirement', {
      requirement: requirement,
      // --- MODIFICA INIZIA QUI ---
      // Passiamo la nuova variabile al prompt manager
      peopleCount: peopleCount,
      // --- MODIFICA FINISCE QUI ---
      categories: availableCategories.join('\n- ')
    });

    const response = await client.chat.completions.create({
      model: "local-model",
      messages: [{ role: "user", content: finalPrompt }],
      temperature: parameters.temperature || 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from LM Studio');
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    
    return (parsed.products || []).map((p: any, i: number) => ({ ...p, id: p.id || `ai-${Date.now()}-${i}`, selected: true }));

  } catch (error: any) {
      console.error('Error generating AI shopping list with LM Studio:', error);
      if (error.code === 'ECONNREFUSED') {
          throw new Error("Impossibile connettersi al server LM Studio.");
      }
      throw new Error('Impossibile generare la lista AI con LM Studio');
  }
}

// --- STUBS PER LE FUNZIONI RIMANENTI ---
export async function generateSmartSuggestions(history: any[]): Promise<any[]> { 
    return []; 
}
export async function matchProductsToEcommerce(items: string[], platform: string, skip: number = 0): Promise<any[]> { 
    return []; 
}
export async function evaluateProductMatch(userQuery: string, product: any): Promise<any> { 
    return { confidence: 0, reasoning: 'Non implementato per LM Studio' }; 
}