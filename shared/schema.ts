// FILE: shared/schema.ts (VERSIONE COMPLETA CON MODIFICHE)

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =================================================================
// TABELLA UTENTI
// Contiene le informazioni di base degli utenti, inclusi i dati per la verifica email.
// =================================================================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password"), // Opzionale per i social login
  provider: text("provider").notNull().default("local"), // 'local', 'google', etc.
  providerId: text("provider_id"), // ID univoco dal provider social
  isEmailVerified: integer("is_email_verified", { mode: 'boolean' }).notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationTokenExpires: integer("email_verification_token_expires", { mode: 'timestamp' }), // Timestamp Unix
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLA LISTE DELLA SPESA
// Ogni riga rappresenta una lista della spesa che puÃ² essere condivisa.
// =================================================================
export const shoppingLists = sqliteTable("shopping_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLA MEMBRI DELLA LISTA (TABELLA PIVOT)
// Collega utenti e liste, definendo i permessi di ciascun utente su una lista.
// =================================================================
export const listMembers = sqliteTable("list_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => shoppingLists.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("viewer"),
});


// --- MODIFICHE INIZIANO QUI: NUOVE TABELLE PER LA GEOLOCALIZZAZIONE E I LAYOUT ---

// =================================================================
// TABELLA PUNTI VENDITA (STORES)
// Memorizza le informazioni sui supermercati fisici identificati.
// =================================================================
export const stores = sqliteTable("stores", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // ID univoco proveniente da un servizio esterno (es. Google Places ID) per evitare duplicati.
    externalId: text("external_id").unique(),
    name: text("name").notNull(), // Es. "Esselunga - Viale Papiniano"
    address: text("address"), // Indirizzo completo
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLA EVENTI DI ACQUISTO
// Registra ogni singolo 'check' di un prodotto in un negozio specifico.
// Questa è la fonte dati per l'algoritmo di calcolo del layout.
// =================================================================
export const purchase_events = sqliteTable("purchase_events", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    storeId: integer("store_id").notNull().references(() => stores.id),
    // Usiamo il nome della categoria direttamente, più semplice per l'algoritmo.
    categoryName: text("category_name").notNull(), 
    // Il timestamp esatto dell'acquisto (lo swipe in-app).
    timestamp: text("timestamp").notNull().$defaultFn(() => new Date().toISOString()),
});

// =================================================================
// TABELLA LAYOUT DEI NEGOZI (CACHE)
// Contiene i risultati pre-calcolati dall'algoritmo offline per un recupero istantaneo.
// =================================================================
export const store_layouts = sqliteTable("store_layouts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeId: integer("store_id").notNull().unique().references(() => stores.id),
    // Un array di stringhe in formato JSON che rappresenta l'ordine delle categorie.
    // Es: '["Frutta e Verdura", "Panetteria", "Carne e Pesce", ...]'
    categoryOrder: text("category_order", { mode: 'json' }).notNull().$defaultFn(() => '[]'),
    // Data dell'ultimo aggiornamento del layout.
    lastUpdatedAt: text("last_updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// --- FINE MODIFICHE ---


// =================================================================
// TABELLE ESISTENTI MODIFICATE
// Ora collegate a una 'listId' invece che direttamente a un utente.
// =================================================================
export const shoppingItems = sqliteTable("shopping_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id").notNull().references(() => shoppingLists.id), // MODIFICA CHIAVE
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
    listId: integer("list_id").notNull().references(() => shoppingLists.id), // MODIFICA CHIAVE
    itemName: text("item_name").notNull(),
    originalItemId: integer("original_item_id"),
    dateAdded: text("date_added").notNull(),
    datePurchased: text("date_purchased").notNull().$defaultFn(() => new Date().toISOString()),
    daysSinceAdded: integer("days_since_added").notNull(),
    category: text("category"),
});

// Le tabelle 'suggestions' e 'ecommerceMatches' possono rimanere legate all'utente
// o essere legate alla lista. Per semplicitÃ , le leghiamo all'utente che le genera.
export const suggestions = sqliteTable("suggestions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    itemName: text("item_name").notNull(),
    category: text("category"),
    confidence: real("confidence").notNull(),
    reasoning: text("reasoning").notNull(),
    lastSuggested: text("last_suggested").notNull().$defaultFn(() => new Date().toISOString()),
    isAccepted: integer("is_accepted", { mode: 'boolean' }).notNull().default(false),
});

export const ecommerceMatches = sqliteTable("ecommerce_matches", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
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
// SCHEMI ZOD (NON MODIFICATI SIGNIFICATIVAMENTE)
// =================================================================
export const insertShoppingItemSchema = createInsertSchema(shoppingItems, {
    dateAdded: z.string().optional(),
}).pick({
  listId: true, // Aggiunto listId
  name: true,
  category: true,
});

export const insertPurchaseHistorySchema = createInsertSchema(purchaseHistory, {
    dateAdded: z.string(),
    datePurchased: z.string().optional(),
}).pick({
  listId: true, // Aggiunto listId
  itemName: true,
  originalItemId: true,
  dateAdded: true,
  daysSinceAdded: true,
  category: true,
});

export const insertSuggestionSchema = createInsertSchema(suggestions).pick({
  userId: true, // Aggiunto userId
  itemName: true,
  category: true,
  confidence: true,
  reasoning: true,
});

export const insertEcommerceMatchSchema = createInsertSchema(ecommerceMatches).pick({
  userId: true, // Aggiunto userId
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

// Tipi inferiti (aggiornati automaticamente)
export type User = typeof users.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ListMember = typeof listMembers.$inferSelect;
export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type InsertShoppingItem = z.infer<typeof insertShoppingItemSchema>;
export type PurchaseHistory = typeof purchaseHistory.$inferSelect;
export type InsertPurchaseHistory = z.infer<typeof insertPurchaseHistorySchema>;
export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type EcommerceMatch = typeof ecommerceMatches.$inferSelect;
export type InsertEcommerceMatch = z.infer<typeof insertEcommerceMatchSchema>;

// --- MODIFICHE INIZIANO QUI: TIPI PER LE NUOVE TABELLE ---
export type Store = typeof stores.$inferSelect;
export type PurchaseEvent = typeof purchase_events.$inferSelect;
export type StoreLayout = typeof store_layouts.$inferSelect;
// --- FINE MODIFICHE ---