// FILE: shared/schema.ts

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================================================================
// TABELLA UTENTI (INVARIATA)
// =================================================================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  nickname: text("nickname"),
  hashedPassword: text("hashed_password"),
  provider: text("provider").notNull().default("local"),
  providerId: text("provider_id"),
  isEmailVerified: integer("is_email_verified", { mode: 'boolean' }).notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpires: integer("email_verification_token_expires", { mode: 'timestamp' }),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLA LISTE DELLA SPESA (INVARIATA)
// =================================================================
export const shoppingLists = sqliteTable("shopping_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// NUOVA TABELLA: MEMBRI DELLA LISTA (TABELLA PIVOT)
// Collega utenti e liste, definendo i permessi di ciascun utente su una lista.
// =================================================================
export const listMembers = sqliteTable("list_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("viewer"),
});

// =================================================================
// NUOVA TABELLA: INVITI
// Memorizza gli inviti pendenti inviati via email.
// =================================================================
export const invitations = sqliteTable("invitations", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
    inviterId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    inviteeEmail: text("invitee_email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status", { enum: ["pending", "accepted", "expired"] }).notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLE ESISTENTI
// =================================================================
export const stores = sqliteTable("stores", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id").unique(),
    name: text("name").notNull(),
    address: text("address"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const purchase_events = sqliteTable("purchase_events", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    storeId: integer("store_id").notNull().references(() => stores.id, { onDelete: 'cascade' }),
    categoryName: text("category_name").notNull(),
    timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
});

export const store_layouts = sqliteTable("store_layouts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().unique().references(() => stores.id, { onDelete: 'cascade' }),
    categoryOrder: text("category_order", { mode: 'json' }).notNull().$defaultFn(() => '[]'),
    lastUpdatedAt: text("last_updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const shoppingItems = sqliteTable("shopping_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  category: text("category"),
  dateAdded: text("date_added").notNull().$defaultFn(() => new Date().toISOString()),
  isCompleted: integer("is_completed", { mode: 'boolean' }).notNull().default(false),
  purchaseCount: integer("purchase_count").notNull().default(0),
  averageFrequency: real("average_frequency"),
  lastPurchaseDate: text("last_purchase_date"),
});

export const purchaseHistory = sqliteTable("purchase_history", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    listId: integer("list_id").notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
    itemName: text("item_name").notNull(),
    originalItemId: integer("original_item_id"),
    dateAdded: text("date_added").notNull(),
    datePurchased: text("date_purchased").notNull().$defaultFn(() => new Date().toISOString()),
    daysSinceAdded: integer("days_since_added").notNull(),
    category: text("category"),
});

export const suggestions = sqliteTable("suggestions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    itemName: text("item_name").notNull(),
    category: text("category"),
    confidence: real("confidence").notNull(),
    reasoning: text("reasoning").notNull(),
    lastSuggested: text("last_suggested").notNull().$defaultFn(() => new Date().toISOString()),
    isAccepted: integer("is_accepted", { mode: 'boolean' }).notNull().default(false),
});

export const ecommerceMatches = sqliteTable("ecommerce_matches", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    originalItem: text("original_item").notNull(),
    matchedProduct: text("matched_product").notNull(),
    platform: text("platform").notNull(),
    productId: text("product_id"),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    confidence: real("confidence").notNull(),
    price: real("price"),
    category: text("category"),
    metadata: text("metadata", { mode: 'json' }),
    description: text("description"),
    brand: text("brand"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// SCHEMI ZOD E TIPI
// =================================================================
export const insertShoppingItemSchema = createInsertSchema(shoppingItems, {
    dateAdded: z.string().optional(),
}).pick({
  listId: true,
  name: true,
  category: true,
});

export const insertPurchaseHistorySchema = createInsertSchema(purchaseHistory, {
    dateAdded: z.string(),
    datePurchased: z.string().optional(),
}).pick({
  listId: true,
  itemName: true,
  originalItemId: true,
  dateAdded: true,
  daysSinceAdded: true,
  category: true,
});

export const insertSuggestionSchema = createInsertSchema(suggestions).pick({
  userId: true,
  itemName: true,
  category: true,
  confidence: true,
  reasoning: true,
});

export const insertEcommerceMatchSchema = createInsertSchema(ecommerceMatches).pick({
  userId: true,
  originalItem: true,
  matchedProduct: true,
  platform: true,
  productId: true,
  productUrl: true,
  imageUrl: true,
  confidence: true,
  price: true,
  category: true,
  metadata: true,
  description: true,
  brand: true,
});

// Tipi inferiti
export type User = typeof users.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ListMember = typeof listMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type InsertShoppingItem = z.infer<typeof insertShoppingItemSchema>;
export type PurchaseHistory = typeof purchaseHistory.$inferSelect;
export type InsertPurchaseHistory = z.infer<typeof insertPurchaseHistorySchema>;
export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type EcommerceMatch = typeof ecommerceMatches.$inferSelect;
export type InsertEcommerceMatch = z.infer<typeof insertEcommerceMatchSchema>;
export type Store = typeof stores.$inferSelect;
export type PurchaseEvent = typeof purchase_events.$inferSelect;
export type StoreLayout = typeof store_layouts.$inferSelect;