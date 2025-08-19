import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Definiamo un tipo per la struttura di un prompt
type PromptTemplate = {
  description: string;
  notes?: string;
  version: string;
  parameters: Record<string, any>;
  prompt: string;
};

class PromptManager {
  private _prompts: Record<string, PromptTemplate> = {};

  constructor() {
    this._loadPrompts();
  }

  /**
   * Carica tutti i file .yaml dalla directory dei prompt e li mette in cache.
   * Viene eseguito una sola volta all'avvio del server.
   */
  private _loadPrompts() {
    const promptsDir = path.join(process.cwd(), 'server', 'config', 'prompts');
    try {
      const files = fs.readdirSync(promptsDir);
      files.forEach(file => {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(promptsDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const loadedPrompts = yaml.load(fileContent) as Record<string, PromptTemplate>;
          
          // Unisce i prompt caricati a quelli già in memoria
          Object.assign(this._prompts, loadedPrompts);
          console.log(`ðŸ“„ Prompt da '${file}' caricati con successo.`);
        }
      });
      console.log(`âœ… Totale di ${Object.keys(this._prompts).length} prompt caricati in memoria.`);
    } catch (error) {
      console.error('â Œ Errore fatale durante il caricamento dei prompt. Il server potrebbe non funzionare correttamente.', error);
      // In un'app di produzione, potresti voler far terminare il processo qui
      // process.exit(1);
    }
  }

  /**
   * Recupera un prompt formattato e i suoi parametri.
   * @param promptId L'ID univoco del prompt (la chiave nel file .yaml).
   * @param variables Un oggetto contenente le variabili da sostituire nel testo del prompt.
   * @returns Un oggetto con il prompt finale e i suoi parametri.
   */
  public getPrompt(promptId: string, variables: Record<string, any> = {}): { finalPrompt: string; parameters: Record<string, any> } {
    const template = this._prompts[promptId];

    if (!template) {
      throw new Error(`Prompt con ID '${promptId}' non trovato. Controlla i file .yaml.`);
    }

    // Sostituisce i placeholder {{variabile}} con i valori forniti
    const finalPrompt = template.prompt.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
      const value = variables[key];
      if (value === undefined || value === null) {
        console.warn(`Attenzione: La variabile '{{${key}}}' non è stata fornita per il prompt '${promptId}'.`);
        return placeholder; // Lascia il placeholder se la variabile non è definita
      }
      // Se la variabile è un oggetto o un array, la convertiamo in una stringa JSON
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });

    return {
      finalPrompt,
      parameters: template.parameters,
    };
  }
}

// Esportiamo un'istanza singleton, così viene creata una sola volta per tutta l'app
export const promptManager = new PromptManager();