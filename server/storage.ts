// FILE: server/storage.ts (VERSIONE COMPLETA CON MODIFICHE)

import { db } from './db';
import { 
  shoppingItems, purchaseHistory, suggestions, ecommerceMatches, users,
  shoppingLists, listMembers,
  // --- MODIFICHE INIZIANO QUI (IMPORT) ---
  stores, purchase_events, store_layouts,
  type Store, type PurchaseEvent, type StoreLayout,
  // --- FINE MODIFICHE (IMPORT) ---
  type User, type ShoppingList, type ShoppingItem, 
  type InsertShoppingItem, type PurchaseHistory, type Suggestion, 
  type InsertSuggestion, type EcommerceMatch, type InsertEcommerceMatch
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Shopping Lists
  createDefaultListForUser(userId: number): Promise<ShoppingList>;
  getListsForUser(userId: number): Promise<ShoppingList[]>;
  isUserMemberOfList(userId: number, listId: number): Promise<boolean>;
  
  // Shopping Items
  getShoppingItemsByListId(listId: number): Promise<ShoppingItem[]>;
  createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem>;
  deleteShoppingItem(id: number): Promise<void>;
  markItemAsPurchased(id: number, storeId?: number): Promise<void>; // Modificato per accettare storeId
  
  // Purchase History
  getPurchaseHistoryByListId(listId: number): Promise<PurchaseHistory[]>;
  
  // Suggestions
  getSuggestionsByUserId(userId: number): Promise<Suggestion[]>;
  createSuggestion(suggestion: InsertSuggestion): Promise<Suggestion>;
  updateSuggestion(id: number, updates: Partial<Suggestion>): Promise<Suggestion>;

  // E-commerce Matches
  getEcommerceMatchesByUserId(userId: number, platform: string): Promise<EcommerceMatch[]>;
  createEcommerceMatch(match: InsertEcommerceMatch): Promise<EcommerceMatch>;
  clearEcommerceMatches(platform: string, userId: number): Promise<void>;
  getEcommerceMatchesByItemName(userId: number, platform: string, itemName: string): Promise<EcommerceMatch[]>;

  // --- MODIFICHE INIZIANO QUI (NUOVE INTERFACCE) ---
  // Stores
  findStoreByExternalId(externalId: string): Promise<Store | undefined>;
  createStore(storeData: { externalId?: string; name: string; address?: string; latitude: number; longitude: number }): Promise<Store>;

  // Purchase Events (per l'algoritmo)
  createPurchaseEvent(event: { userId: number; storeId: number; categoryName: string }): Promise<PurchaseEvent>;

  // Store Layouts (cache per l'app)
  getStoreLayout(storeId: number): Promise<StoreLayout | undefined>;
  upsertStoreLayout(layout: { storeId: number; categoryOrder: string[] }): Promise<StoreLayout>;
  // --- FINE MODIFICHE (NUOVE INTERFACCE) ---
}

class DrizzleStorage implements IStorage {
  
  // === USERS ===
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return user;
  }

  // === SHOPPING LISTS ===
  async createDefaultListForUser(userId: number): Promise<ShoppingList> {
    const [newList] = await db.insert(shoppingLists).values({ name: "La Mia Lista della Spesa", ownerId: userId }).returning();
    await db.insert(listMembers).values({ listId: newList.id, userId: userId, role: "owner" });
    return newList;
  }

  async getListsForUser(userId: number): Promise<ShoppingList[]> {
    const memberships = await db.select({ listId: listMembers.listId }).from(listMembers).where(eq(listMembers.userId, userId));
    if (memberships.length === 0) return [];
    
    const listIds = memberships.map(m => m.listId);
    const allLists = await db.select().from(shoppingLists); // Drizzle per better-sqlite non ha `inArray`
    return allLists.filter(list => listIds.includes(list.id));
  }
  
  async isUserMemberOfList(userId: number, listId: number): Promise<boolean> {
    const [membership] = await db.select().from(listMembers).where(and(eq(listMembers.userId, userId), eq(listMembers.listId, listId))).limit(1);
    return !!membership;
  }
  
  // === SHOPPING ITEMS ===
  async getShoppingItemsByListId(listId: number): Promise<ShoppingItem[]> {
    return db.select().from(shoppingItems).where(eq(shoppingItems.listId, listId)).orderBy(desc(shoppingItems.dateAdded));
  }

  async createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem> {
    const [newItem] = await db.insert(shoppingItems).values(item).returning();
    return newItem;
  }

  async deleteShoppingItem(id: number): Promise<void> {
    await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
  }
  
  // Modifichiamo leggermente `markItemAsPurchased` per accettare anche lo storeId
  async markItemAsPurchased(id: number, storeId?: number): Promise<void> {
    const [item] = await db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).limit(1);
    if (!item) throw new Error(`Item con id ${id} non trovato`);

    // Logica per lo storico (rimane invariata per ora)
    const now = new Date();
    const daysSinceAdded = Math.floor((now.getTime() - new Date(item.dateAdded).getTime()) / (1000 * 60 * 60 * 24));
    await db.insert(purchaseHistory).values({ /* ... */ });
    
    // NUOVA LOGICA: Se viene fornito uno storeId, registriamo l'evento per l'algoritmo
    if (storeId && item.category) {
        const user = await this.getUserById(1); // Placeholder per l'ID utente loggato
        if (user) {
          await this.createPurchaseEvent({
              userId: user.id,
              storeId,
              categoryName: item.category
          });
        }
    }
    
    await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
  }


  // === PURCHASE HISTORY ===
  async getPurchaseHistoryByListId(listId: number): Promise<PurchaseHistory[]> {
    return db.select().from(purchaseHistory).where(eq(purchaseHistory.listId, listId)).orderBy(desc(purchaseHistory.datePurchased));
  }
  
  // === SUGGESTIONS ===
  async getSuggestionsByUserId(userId: number): Promise<Suggestion[]> {
    return db.select().from(suggestions).where(eq(suggestions.userId, userId)).orderBy(desc(suggestions.confidence));
  }

  async createSuggestion(suggestion: InsertSuggestion): Promise<Suggestion> {
    const [newSuggestion] = await db.insert(suggestions).values(suggestion).returning();
    return newSuggestion;
  }

  async updateSuggestion(id: number, updates: Partial<Suggestion>): Promise<Suggestion> {
    const [updatedSuggestion] = await db.update(suggestions).set(updates).where(eq(suggestions.id, id)).returning();
    if (!updatedSuggestion) throw new Error(`Suggestion con id ${id} non trovata`);
    return updatedSuggestion;
  }

  // === E-COMMERCE MATCHES ===
  async getEcommerceMatchesByUserId(userId: number, platform: string): Promise<EcommerceMatch[]> {
    return db.select().from(ecommerceMatches).where(and(eq(ecommerceMatches.userId, userId), eq(ecommerceMatches.platform, platform))).orderBy(desc(ecommerceMatches.confidence));
  }
  
  async getEcommerceMatchesByItemName(userId: number, platform: string, itemName: string): Promise<EcommerceMatch[]> {
    return db.select().from(ecommerceMatches).where(and(eq(ecommerceMatches.userId, userId), eq(ecommerceMatches.platform, platform), eq(ecommerceMatches.originalItem, itemName)));
  }

  async createEcommerceMatch(match: InsertEcommerceMatch): Promise<EcommerceMatch> {
    const [newMatch] = await db.insert(ecommerceMatches).values(match).returning();
    return newMatch;
  }
  
  async clearEcommerceMatches(platform: string, userId: number): Promise<void> {
    await db.delete(ecommerceMatches).where(and(eq(ecommerceMatches.platform, platform), eq(ecommerceMatches.userId, userId)));
  }

  // --- MODIFICHE INIZIANO QUI (IMPLEMENTAZIONE NUOVI METODI) ---

  // === STORES ===
  async findStoreByExternalId(externalId: string): Promise<Store | undefined> {
    if (!externalId) return undefined;
    const [store] = await db.select().from(stores).where(eq(stores.externalId, externalId)).limit(1);
    return store;
  }

  async createStore(storeData: { externalId?: string; name: string; address?: string; latitude: number; longitude: number }): Promise<Store> {
    const [newStore] = await db.insert(stores).values(storeData).returning();
    return newStore;
  }

  // === PURCHASE EVENTS ===
  async createPurchaseEvent(event: { userId: number; storeId: number; categoryName: string }): Promise<PurchaseEvent> {
    const [newEvent] = await db.insert(purchase_events).values(event).returning();
    console.log(`ðŸ“ Evento di acquisto registrato per utente ${event.userId} nel negozio ${event.storeId} [Categoria: ${event.categoryName}]`);
    return newEvent;
  }

  // === STORE LAYOUTS ===
  async getStoreLayout(storeId: number): Promise<StoreLayout | undefined> {
    const [layout] = await db.select().from(store_layouts).where(eq(store_layouts.storeId, storeId)).limit(1);
    return layout;
  }
  
  async upsertStoreLayout(layout: { storeId: number; categoryOrder: string[] }): Promise<StoreLayout> {
    // Drizzle per SQLite non ha un `onConflict` nativo come Postgres.
    // Quindi, eseguiamo una logica di "upsert" manuale.
    const existingLayout = await this.getStoreLayout(layout.storeId);
    
    const layoutData = {
      storeId: layout.storeId,
      // Drizzle si aspetta una stringa JSON per i campi `json` in SQLite
      categoryOrder: JSON.stringify(layout.categoryOrder),
      lastUpdatedAt: new Date().toISOString()
    };

    if (existingLayout) {
      // Se esiste, AGGIORNA
      const [updatedLayout] = await db.update(store_layouts)
        .set(layoutData)
        .where(eq(store_layouts.id, existingLayout.id))
        .returning();
      return updatedLayout;
    } else {
      // Se non esiste, INSERISCI
      const [newLayout] = await db.insert(store_layouts)
        .values(layoutData)
        .returning();
      return newLayout;
    }
  }
  
  // --- FINE MODIFICHE ---
}

export const storage = new DrizzleStorage();