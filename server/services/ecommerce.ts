import xml2js from 'xml2js';
import type { EcommerceMatch } from '@shared/schema';

export interface CartItem {
  name: string;
  productId?: string;
  quantity: number;
  price?: number;
  category?: string;
}

export interface EcommerceCart {
  platform: string;
  items: CartItem[];
  totalItems: number;
  estimatedTotal?: number;
}

export function generateCartXML(cart: EcommerceCart): string {
  const builder = new xml2js.Builder({
    rootName: 'shoppingCart',
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  });

  const cartData = {
    '$': {
      platform: cart.platform,
      generated: new Date().toISOString(),
      totalItems: cart.totalItems.toString()
    },
    metadata: {
      estimatedTotal: cart.estimatedTotal || 0,
      currency: 'EUR',
      generatedBy: 'SmartCart'
    },
    items: {
      item: cart.items.map(item => ({
        '$': {
          id: item.productId || generateProductId(item.name)
        },
        name: item.name,
        quantity: item.quantity,
        price: item.price || 0,
        category: item.category || 'Altri'
      }))
    }
  };

  return builder.buildObject(cartData);
}

export function createEcommerceCart(
  items: string[],
  matches: EcommerceMatch[],
  platform: string
): EcommerceCart {
  const cartItems: CartItem[] = items.map(itemName => {
    const match = matches.find(m => 
      m.originalItem.toLowerCase() === itemName.toLowerCase() && 
      m.platform === platform
    );

    return {
      name: match?.matchedProduct || itemName,
      productId: match?.productId || undefined,
      quantity: 1,
      price: match?.price || undefined,
      category: extractCategoryFromMetadata(match?.metadata)
    };
  });

  const estimatedTotal = cartItems.reduce((sum, item) => 
    sum + (item.price || 0) * item.quantity, 0
  );

  return {
    platform,
    items: cartItems,
    totalItems: cartItems.length,
    estimatedTotal: estimatedTotal > 0 ? estimatedTotal : undefined
  };
}

export function generateAmazonCartUrl(cart: EcommerceCart): string {
  // Generate Amazon cart URL (simplified)
  const baseUrl = 'https://www.amazon.it/gp/aws/cart/add.html';
  const params = cart.items.map((item, index) => {
    return `ASIN.${index + 1}=${item.productId || 'B000000000'}&Quantity.${index + 1}=${item.quantity}`;
  }).join('&');

  return `${baseUrl}?${params}`;
}

export function generateCarrefourUrl(cart: EcommerceCart): string {
  // Generate Carrefour cart URL
  const baseUrl = 'https://www.carrefour.it/cart/add';
  const params = cart.items.map((item, index) => {
    return `id.${index + 1}=${item.productId || 'C000000000'}&qty.${index + 1}=${item.quantity}`;
  }).join('&');

  return `${baseUrl}?${params}`;
}

export function generateEsselungaUrl(cart: EcommerceCart): string {
  // Generate Esselunga cart URL (simplified)
  const baseUrl = 'https://www.esselunga.it/commerce/nav/auth/login.do';
  return baseUrl; // Would need real integration
}

function generateProductId(itemName: string): string {
  // Generate a mock product ID based on item name
  const hash = itemName.toLowerCase().replace(/\s+/g, '').substring(0, 8);
  return `SC${hash.padEnd(8, '0').toUpperCase()}`;
}

function extractCategoryFromMetadata(metadata: any): string | undefined {
  if (metadata && typeof metadata === 'object') {
    return metadata.category || metadata.productCategory;
  }
  return undefined;
}
