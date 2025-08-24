import * as fs from "fs";
import * as yaml from 'js-yaml';

// Importiamo le funzioni specifiche con un alias
import {
    processItem as processItemOpenAI,
    generateAIShoppingList as generateAIShoppingListOpenAI,
    // ... altre funzioni di OpenAI
} from './openai.js';

import {
    processItem as processItemGemini,
    generateAIShoppingList as generateAIShoppingListGemini,
} from './gemini.js';

import {
    processItem as processItemLMStudio,
    generateAIShoppingList as generateAIShoppingListLMStudio, // <-- IMPORTIAMO LA NUOVA FUNZIONE
} from './lm-studio.js';

export type AIProvider = 'openai' | 'gemini' | 'lm-studio';

// --- AI ROUTING CONFIGURATION (invariato) ---
interface AIRoutingConfig {
    processItem?: AIProvider;
    generateAIShoppingList?: AIProvider;
    generateSmartSuggestions?: AIProvider;
    matchProductsToEcommerce?: AIProvider;
    evaluateProductMatch?: AIProvider;
    default: AIProvider;
    [key: string]: AIProvider | undefined;
}
let aiRoutingConfig: AIRoutingConfig;
function loadAIRoutingConfig(): AIRoutingConfig {
    try {
        const configPath = 'server/config/ai-routing.yaml';
        const fileContents = fs.readFileSync(configPath, 'utf8');
        const loadedConfig = yaml.load(fileContents) as AIRoutingConfig;
        if (!loadedConfig.default) {
            loadedConfig.default = 'openai';
        }
        return loadedConfig;
    } catch (e) {
        console.error(`Errore durante la lettura di server/config/ai-routing.yaml:`, e);
        return { default: 'openai' };
    }
}
aiRoutingConfig = loadAIRoutingConfig();
console.log('🤖 Configurazione AI caricata:', aiRoutingConfig);

// --- PROVIDER MANAGEMENT (invariato) ---
export function isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
        case 'openai': return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'default_key';
        case 'gemini': return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'default_key';
        case 'lm-studio': return process.env.LM_STUDIO_ENABLED === 'true';
        default: return false;
    }
}
export function getAvailableProviders(): { provider: AIProvider, available: boolean, name: string }[] {
    return [
        { provider: 'openai', available: isProviderAvailable('openai'), name: 'OpenAI (GPT-4o)' },
        { provider: 'gemini', available: isProviderAvailable('gemini'), name: 'Google Gemini (1.5 Flash/Pro)' },
        { provider: 'lm-studio', available: isProviderAvailable('lm-studio'), name: 'LM Studio (Locale)' }
    ];
}

// --- FUNZIONI DI ROUTING ---

export async function processItem(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    const configuredProvider = aiRoutingConfig.processItem || aiRoutingConfig.default;
    const fallbackProviders: AIProvider[] = ['openai', 'gemini', 'lm-studio'].filter(p => p !== configuredProvider);

    try {
        if (isProviderAvailable(configuredProvider)) {
            console.log(`🧠 Tentativo di processare l'item con il provider configurato: ${configuredProvider}`);
            switch (configuredProvider) {
                case 'openai': return await processItemOpenAI(text);
                case 'gemini': return await processItemGemini(text);
                case 'lm-studio': return await processItemLMStudio(text);
            }
        }
    } catch (error) { console.error(`❌ Errore con il provider ${configuredProvider}:`, error); }

    for (const provider of fallbackProviders) {
        try {
            if (isProviderAvailable(provider)) {
                console.warn(`⚠️ Fallback al provider: ${provider}`);
                switch (provider) {
                    case 'openai': return await processItemOpenAI(text);
                    case 'gemini': return await processItemGemini(text);
                    case 'lm-studio': return await processItemLMStudio(text);
                }
            }
        } catch (error) { console.error(`❌ Errore con il provider di fallback ${provider}:`, error); }
    }
    throw new Error("Nessun provider AI è stato in grado di processare la richiesta.");
}

export async function generateAIShoppingList(requirement: string): Promise<any[]> {
    const configuredProvider = aiRoutingConfig.generateAIShoppingList || aiRoutingConfig.default;
    const fallbackProviders: AIProvider[] = ['openai', 'gemini', 'lm-studio'].filter(p => p !== configuredProvider); // <-- AGGIUNTO LM-STUDIO

    try {
        if (isProviderAvailable(configuredProvider)) {
            console.log(`🧠 Tentativo di generare la lista con il provider configurato: ${configuredProvider}`);
            switch (configuredProvider) {
                case 'openai': return await generateAIShoppingListOpenAI(requirement);
                case 'gemini': return await generateAIShoppingListGemini(requirement);
                case 'lm-studio': return await generateAIShoppingListLMStudio(requirement); // <-- AGGIUNTO CASO LM-STUDIO
            }
        }
    } catch (error) { console.error(`❌ Errore con il provider ${configuredProvider}:`, error); }

    for (const provider of fallbackProviders) {
        try {
            if (isProviderAvailable(provider)) {
                console.warn(`⚠️ Fallback al provider per la generazione lista: ${provider}`);
                switch (provider) {
                    case 'openai': return await generateAIShoppingListOpenAI(requirement);
                    case 'gemini': return await generateAIShoppingListGemini(requirement);
                    case 'lm-studio': return await generateAIShoppingListLMStudio(requirement); // <-- AGGIUNTO CASO LM-STUDIO
                }
            }
        } catch (error) { console.error(`❌ Errore con il provider di fallback ${provider}:`, error); }
    }
    throw new Error("Nessun provider AI è stato in grado di generare la lista.");
}

// Esportiamo le altre funzioni come prima
export {
    generateSmartSuggestions,
    matchProductsToEcommerce,
    evaluateProductMatch
} from './openai';