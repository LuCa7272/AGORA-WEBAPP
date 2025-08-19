// Servizio unificato per gestire diversi provider AI (OpenAI e Gemini)

// Import delle funzioni OpenAI
import { 
  categorizeItem as categorizeItemOpenAI,
  generateSmartSuggestions as generateSmartSuggestionsOpenAI,
  generateAIShoppingList as generateAIShoppingListOpenAI,
  matchProductsToEcommerce as matchProductsToEcommerceOpenAI,
  evaluateProductMatch as evaluateProductMatchOpenAI
} from './openai.js';

// Import delle funzioni Gemini
import {
  categorizeItemGemini,
  generateSmartSuggestionsGemini,
  generateAIShoppingListGemini,
  matchProductsToEcommerceGemini,
  evaluateProductMatchGemini
} from './gemini.js';

export type AIProvider = 'openai' | 'gemini';

// Ottieni il provider AI corrente dalle variabili globali
function getCurrentAIProvider(): AIProvider {
  return (global as any).AI_PROVIDER || 'openai';
}

// Imposta il provider AI corrente
export function setAIProvider(provider: AIProvider): void {
  (global as any).AI_PROVIDER = provider;
  console.log(`🤖 AI Provider impostato su: ${provider.toUpperCase()}`);
}

// Verifica se un provider è disponibile
export function isProviderAvailable(provider: AIProvider): boolean {
  switch (provider) {
    case 'openai':
      return !!(process.env.OPENAI_API_KEY);
    case 'gemini':
      return !!(process.env.GEMINI_API_KEY);
    default:
      return false;
  }
}

// Ottieni informazioni sui provider disponibili
export function getAvailableProviders(): { provider: AIProvider, available: boolean, name: string }[] {
  return [
    {
      provider: 'openai',
      available: isProviderAvailable('openai'),
      name: 'OpenAI (GPT-4o)'
    },
    {
      provider: 'gemini',
      available: isProviderAvailable('gemini'),
      name: 'Google Gemini (2.5-Flash/Pro)'
    }
  ];
}

// Funzioni unificate che delegano al provider corrente
export async function categorizeItem(itemName: string): Promise<string> {
  const provider = getCurrentAIProvider();
  
  switch (provider) {
    case 'gemini':
      if (isProviderAvailable('gemini')) {
        return await categorizeItemGemini(itemName);
      }
      // Fallback a OpenAI se Gemini non disponibile
      console.warn('⚠️ Gemini non disponibile, fallback a OpenAI');
      return await categorizeItemOpenAI(itemName);
    
    case 'openai':
    default:
      return await categorizeItemOpenAI(itemName);
  }
}

export async function generateSmartSuggestions(itemStats: any[]): Promise<any[]> {
  const provider = getCurrentAIProvider();
  
  switch (provider) {
    case 'gemini':
      if (isProviderAvailable('gemini')) {
        return await generateSmartSuggestionsGemini(itemStats);
      }
      console.warn('⚠️ Gemini non disponibile, fallback a OpenAI');
      return await generateSmartSuggestionsOpenAI(itemStats);
    
    case 'openai':
    default:
      return await generateSmartSuggestionsOpenAI(itemStats);
  }
}

export async function generateAIShoppingList(requirement: string): Promise<any[]> {
  const provider = getCurrentAIProvider();
  
  switch (provider) {
    case 'gemini':
      if (isProviderAvailable('gemini')) {
        return await generateAIShoppingListGemini(requirement);
      }
      console.warn('⚠️ Gemini non disponibile, fallback a OpenAI');
      return await generateAIShoppingListOpenAI(requirement);
    
    case 'openai':
    default:
      return await generateAIShoppingListOpenAI(requirement);
  }
}

export async function matchProductsToEcommerce(items: string[], platform: string, skip: number = 0): Promise<any[]> {
  const provider = getCurrentAIProvider();
  
  switch (provider) {
    case 'gemini':
      if (isProviderAvailable('gemini')) {
        return await matchProductsToEcommerceGemini(items, platform);
      }
      console.warn('⚠️ Gemini non disponibile, fallback a OpenAI');
      return await matchProductsToEcommerceOpenAI(items, platform, skip);
    
    case 'openai':
    default:
      return await matchProductsToEcommerceOpenAI(items, platform, skip);
  }
}

export async function evaluateProductMatch(userQuery: string, product: any): Promise<{confidence: number, reasoning: string}> {
  const provider = getCurrentAIProvider();
  
  switch (provider) {
    case 'gemini':
      if (isProviderAvailable('gemini')) {
        return await evaluateProductMatchGemini(userQuery, product);
      }
      console.warn('⚠️ Gemini non disponibile, fallback a OpenAI');
      return await evaluateProductMatchOpenAI(userQuery, product);
    
    case 'openai':
    default:
      return await evaluateProductMatchOpenAI(userQuery, product);
  }
}