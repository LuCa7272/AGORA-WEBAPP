// FILE: server/storage.ts

import { db } from './db';
import { 
  shoppingItems, purchaseHistory, suggestions, ecommerceMatches, users,
  shoppingLists, listMembers, invitations,
  stores, purchase_events, store_layouts,
  type Store, type PurchaseEvent, type StoreLayout,
  type User, type ShoppingList, type ShoppingItem, 
  type InsertShoppingItem, type PurchaseHistory, type Suggestion, 
  type InsertSuggestion, type EcommerceMatch, type InsertEcommerceMatch,
  type Invitation, type InsertInvitation
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  findUserByEmail(email: string): Promise<User | undefined>;

  // Shopping Lists
  createDefaultListForUser(userId: number): Promise<ShoppingList>;
  createList(userId: number, name: string): Promise<ShoppingList>;
  getListsForUser(userId: number): Promise<ShoppingList[]>;
  isUserMemberOfList(userId: number, listId: number, roles?: Array<'owner' | 'editor' | 'viewer'>): Promise<boolean>;
  
  // List Members & Invitations
  addListMember(listId: number, userId: number, role: 'editor' | 'viewer'): Promise<void>;
  createInvitation(listId: number, inviterId: number, inviteeEmail: string, token: string, expiresAt: Date): Promise<Invitation>;
  findInvitationByToken(token: string): Promise<Invitation | undefined>;
  updateInvitationStatus(tokenId: number, status: 'accepted' | 'expired'): Promise<void>;

  // Shopping Items
  getShoppingItemsByListId(listId: number): Promise<ShoppingItem[]>;
  createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem>;
  updateShoppingItem(id: number, data: Partial<Omit<ShoppingItem, 'id'>>): Promise<ShoppingItem>;
  deleteShoppingItem(id: number): Promise<void>;
  clearShoppingList(listId: number): Promise<void>;
  markItemAsPurchased(id: number, userId: number, storeId?: number): Promise<void>;
  
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

  // Stores
  findStoreByExternalId(externalId: string): Promise<Store | undefined>;
  createStore(storeData: { externalId?: string; name: string; address?: string; latitude: number; longitude: number }): Promise<Store>;

  // Purchase Events
  createPurchaseEvent(event: { userId: number; storeId: number; categoryName: string }): Promise<PurchaseEvent>;

  // Store Layouts
  getStoreLayout(storeId: number): Promise<StoreLayout | undefined>;
  upsertStoreLayout(layout: { storeId: number; categoryOrder: string[] }): Promise<StoreLayout>;
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
  
  async findUserByEmail(email: string): Promise<User | undefined> {
    return this.getUserByEmail(email);
  }

  // === SHOPPING LISTS ===
  async createDefaultListForUser(userId: number): Promise<ShoppingList> {
    return this.createList(userId, "La Mia Lista della Spesa");
  }

  async createList(userId: number, name: string): Promise<ShoppingList> {
    const [newList] = await db.insert(shoppingLists).values({ name, ownerId: userId }).returning();
    await db.insert(listMembers).values({ listId: newList.id, userId: userId, role: "owner" });
    return newList;
  }

  async getListsForUser(userId: number): Promise<ShoppingList[]> {
    const memberships = await db.select({ listId: listMembers.listId }).from(listMembers).where(eq(listMembers.userId, userId));
    if (memberships.length === 0) return [];
    
    const listIds = memberships.map(m => m.listId);
    
    const allLists = await db.select().from(shoppingLists); 
    return allLists.filter(list => listIds.includes(list.id));
  }
  
  async isUserMemberOfList(userId: number, listId: number, roles?: Array<'owner' | 'editor' | 'viewer'>): Promise<boolean> {
    const conditions = [
        eq(listMembers.userId, userId),
        eq(listMembers.listId, listId)
    ];

    const [membership] = await db.select().from(listMembers).where(and(...conditions)).limit(1);
    
    if (!membership) return false;

    if (roles && roles.length > 0) {
        return roles.includes(membership.role as any);
    }
    
    return !!membership;
  }

  // === LIST MEMBERS & INVITATIONS ===
  async addListMember(listId: number, userId: number, role: 'editor' | 'viewer' = 'editor'): Promise<void> {
    const isAlreadyMember = await this.isUserMemberOfList(userId, listId);
    if (!isAlreadyMember) {
        await db.insert(listMembers).values({ listId, userId, role });
    }
  }
  
  async createInvitation(listId: number, inviterId: number, inviteeEmail: string, token: string, expiresAt: Date): Promise<Invitation> {
      const [newInvitation] = await db.insert(invitations).values({
          listId,
          inviterId,
          inviteeEmail,
          token,
          expiresAt
      }).returning();
      return newInvitation;
  }

  async findInvitationByToken(token: string): Promise<Invitation | undefined> {
      const [invitation] = await db.select().from(invitations).where(
          and(
              eq(invitations.token, token),
              eq(invitations.status, 'pending'),
              gte(invitations.expiresAt, new Date())
          )
      ).limit(1);
      return invitation;
  }

  async updateInvitationStatus(tokenId: number, status: 'accepted' | 'expired'): Promise<void> {
      await db.update(invitations).set({ status }).where(eq(invitations.id, tokenId));
  }

  // === SHOPPING ITEMS ===
  async getShoppingItemsByListId(listId: number): Promise<ShoppingItem[]> {
    return db.select().from(shoppingItems).where(eq(shoppingItems.listId, listId)).orderBy(desc(shoppingItems.dateAdded));
  }

  async createShoppingItem(item: InsertShoppingItem): Promise<ShoppingItem> {
    const [newItem] = await db.insert(shoppingItems).values(item).returning();
    return newItem;
  }
  
  async updateShoppingItem(id: number, data: Partial<Omit<ShoppingItem, 'id'>>): Promise<ShoppingItem> {
    const [updatedItem] = await db.update(shoppingItems).set(data).where(eq(shoppingItems.id, id)).returning();
    if (!updatedItem) {
      throw new Error(`Prodotto con ID ${id} non trovato.`);
    }
    return updatedItem;
  }

  async deleteShoppingItem(id: number): Promise<void> {
    await db.delete(shoppingItems).where(eq(shoppingItems.id, id));
  }
  
  async clearShoppingList(listId: number): Promise<void> {
    await db.delete(shoppingItems).where(eq(shoppingItems.listId, listId));
  }
  
  async markItemAsPurchased(id: number, userId: number, storeId?: number): Promise<void> {
    const [item] = await db.select().from(shoppingItems).where(eq(shoppingItems.id, id)).limit(1);
    if (!item) {
      throw new Error(`Prodotto con ID ${id} non trovato.`);
    }

    const now = new Date();
    const daysSinceAdded = Math.floor((now.getTime() - new Date(item.dateAdded).getTime()) / (1000 * 60 * 60 * 24));
    
    await db.insert(purchaseHistory).values({
      listId: item.listId,
      itemName: item.name,
      originalItemId: item.id,
      dateAdded: item.dateAdded,
      datePurchased: now.toISOString(),
      daysSinceAdded: daysSinceAdded,
      category: item.category,
    });

    if (storeId && item.category) {
      await this.createPurchaseEvent({
          userId: userId,
          storeId: storeId,
          categoryName: item.category
      });
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
    console.log(`Event in-store registrato per utente ${event.userId} nel negozio ${event.storeId} [Categoria: ${event.categoryName}]`);
    return newEvent;
  }

  // === STORE LAYOUTS ===
  async getStoreLayout(storeId: number): Promise<StoreLayout | undefined> {
    const [layout] = await db.select().from(store_layouts).where(eq(store_layouts.storeId, storeId)).limit(1);
    return layout;
  }
  
  async upsertStoreLayout(layout: { storeId: number; categoryOrder: string[] }): Promise<StoreLayout> {
    const existingLayout = await this.getStoreLayout(layout.storeId);
    
    const layoutData = {
      storeId: layout.storeId,
      categoryOrder: JSON.stringify(layout.categoryOrder),
      lastUpdatedAt: new Date().toISOString()
    };

    if (existingLayout) {
      const [updatedLayout] = await db.update(store_layouts)
        .set(layoutData)
        .where(eq(store_layouts.id, existingLayout.id))
        .returning();
      return updatedLayout;
    } else {
      const [newLayout] = await db.insert(store_layouts)
        .values(layoutData)
        .returning();
      return newLayout;
    }
  }
}

export const storage = new DrizzleStorage();