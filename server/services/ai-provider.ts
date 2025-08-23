import {
    processItemText as processItemTextOpenAI,
    generateAIShoppingList as generateAIShoppingListOpenAI,
    generateSmartSuggestions as generateSmartSuggestionsOpenAI,
    matchProductsToEcommerce as matchProductsToEcommerceOpenAI,
    evaluateProductMatch as evaluateProductMatchOpenAI
} from './openai.js';

import {
    processItemText as processItemTextGemini,
    // generateAIShoppingList as generateAIShoppingListGemini, // Assuming these exist in gemini.ts
    // generateSmartSuggestions as generateSmartSuggestionsGemini,
    // matchProductsToEcommerce as matchProductsToEcommerceGemini,
    // evaluateProductMatch as evaluateProductMatchGemini
} from './gemini.js';

export type AIProvider = 'openai' | 'gemini';

// --- PROVIDER MANAGEMENT ---

export function isProviderAvailable(provider: AIProvider): boolean {
    switch (provider) {
        case 'openai': return !!process.env.OPENAI_API_KEY;
        case 'gemini': return !!process.env.GEMINI_API_KEY;
        default: return false;
    }
}

function getCurrentAIProvider(): AIProvider {
    if ((global as any).AI_PROVIDER) return (global as any).AI_PROVIDER;
    if (isProviderAvailable('gemini')) return 'gemini';
    return 'openai';
}

export function setAIProvider(provider: AIProvider): void {
    (global as any).AI_PROVIDER = provider;
    console.log(`🤖 AI Provider set to: ${provider.toUpperCase()}`);
}

export function getAvailableProviders(): { provider: AIProvider, available: boolean, name: string }[] {
    return [
        { provider: 'openai', available: isProviderAvailable('openai'), name: 'OpenAI (GPT-4o)' },
        { provider: 'gemini', available: isProviderAvailable('gemini'), name: 'Google Gemini (2.5-Flash/Pro)' }
    ];
}

// --- UNIFIED AI FUNCTIONS ---

async function execute<T>(geminiFn: () => Promise<T>, openaiFn: () => Promise<T>): Promise<T> {
    const provider = getCurrentAIProvider();
    switch (provider) {
        case 'gemini':
            if (isProviderAvailable('gemini')) return await geminiFn();
            console.warn('⚠️ Gemini not available, falling back to OpenAI');
            if (isProviderAvailable('openai')) return await openaiFn();
            break;
        case 'openai':
            if (isProviderAvailable('openai')) return await openaiFn();
            break;
    }
    throw new Error("Nessun provider AI valido è configurato o disponibile.");
}

export async function processItem(text: string): Promise<{ name: string; quantity: string | null; category: string }> {
    return execute(
        () => processItemTextGemini(text),
        () => processItemTextOpenAI(text)
    );
}

export async function generateAIShoppingList(requirement: string): Promise<any[]> {
    // @ts-ignore
    return execute(
        () => generateAIShoppingListGemini(requirement), // Assuming this will be created in gemini.ts
        () => generateAIShoppingListOpenAI(requirement)
    );
}

export async function generateSmartSuggestions(itemStats: any[]): Promise<any[]> {
    // @ts-ignore
    return execute(
        () => generateSmartSuggestionsGemini(itemStats), // Assuming this will be created in gemini.ts
        () => generateSmartSuggestionsOpenAI(itemStats)
    );
}

export async function matchProductsToEcommerce(items: string[], platform: string, skip: number = 0): Promise<any[]> {
    // @ts-ignore
    return execute(
        () => matchProductsToEcommerceGemini(items, platform), // Assuming this will be created in gemini.ts
        () => matchProductsToEcommerceOpenAI(items, platform, skip)
    );
}

export async function evaluateProductMatch(userQuery: string, product: any): Promise<{confidence: number, reasoning: string}> {
    // @ts-ignore
    return execute(
        () => evaluateProductMatchGemini(userQuery, product), // Assuming this will be created in gemini.ts
        () => evaluateProductMatchOpenAI(userQuery, product)
    );
}