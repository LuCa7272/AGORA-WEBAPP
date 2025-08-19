// FILE: server/routes.ts (VERSIONE ASSOLUTAMENTE COMPLETA)

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertShoppingItemSchema,
  insertPurchaseHistorySchema,
  insertSuggestionSchema,
  insertEcommerceMatchSchema,
  shoppingItems // Importato per il nuovo middleware
} from "@shared/schema";
import { advancedMatcher } from './services/advanced-matching.js';
import { generateSmartSuggestions, matchProductsToEcommerce, categorizeItem, generateAIShoppingList } from "./services/ai-provider";
import { generateCartXML, createEcommerceCart, generateCarrefourUrl, generateEsselungaUrl } from "./services/ecommerce";
// --- MODIFICA 1/5: IMPORTIAMO IL NUOVO SERVIZIO DI GEOLOCALIZZAZIONE ---
import { geolocationService } from './services/geolocationService.js';

// ===== NUOVI IMPORT PER L'AUTENTICAZIONE =====
import session from "express-session";
import bcrypt from "bcrypt";
import passport from "./auth";
import { users, type User, type PurchaseHistory, type ShoppingItem } from "@shared/schema"; // Aggiunto ShoppingItem
import { eq } from "drizzle-orm";
import { db } from './db';
import crypto from 'crypto';
import { sendVerificationEmail } from './services/email';

// Middleware per verificare se l'utente è autenticato e verificato
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User;
  if (req.isAuthenticated() && user.isEmailVerified) {
    return next();
  }
  if (req.isAuthenticated() && !user.isEmailVerified) {
    return res.status(403).json({ message: "Accesso negato. L'email non è stata verificata." });
  }
  res.status(401).json({ message: "Accesso non autorizzato. Effettua il login." });
};

// Middleware per verificare che l'utente sia membro della lista richiesta
const isListMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listIdParam = req.params.listId || req.body.listId;
    const listId = parseInt(listIdParam, 10);
    const userId = (req.user as User).id;

    if (isNaN(listId)) {
      return res.status(400).json({ message: "ID della lista non valido." });
    }
    const isMember = await storage.isUserMemberOfList(userId, listId);
    if (isMember) {
      return next();
    }
    res.status(403).json({ message: "Accesso negato. Non sei membro di questa lista." });
  } catch (error) {
    next(error);
  }
};

// --- MODIFICA 2/5: NUOVO MIDDLEWARE PER CONTROLLARE I PERMESSI SU UN ITEM SPECIFICO ---
/**
 * Middleware per verificare che l'utente autenticato abbia i permessi per agire
 * su un determinato prodotto (verificando che sia membro della lista a cui il prodotto appartiene).
 * Aggiunge l'oggetto 'item' al request object per un uso successivo.
 */
const isItemOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId)) {
      return res.status(400).json({ message: "ID del prodotto non valido." });
    }
    const userId = (req.user as User).id;

    const item = await db.query.shoppingItems.findFirst({ where: eq(shoppingItems.id, itemId) });
    if (!item) {
      return res.status(404).json({ message: "Prodotto non trovato." });
    }

    const isMember = await storage.isUserMemberOfList(userId, item.listId);
    if (isMember) {
      // Aggiungiamo l'item al request object per non doverlo recuperare di nuovo
      (req as any).item = item;
      return next();
    }
    res.status(403).json({ message: "Accesso negato. Non hai i permessi per modificare questo prodotto." });
  } catch (error) {
    next(error);
  }
};
// --- FINE MODIFICA 2/5 ---

export async function registerRoutes(app: Express): Promise<Server> {
  console.log("--- Il file server/routes.ts Ã¨ stato caricato e le rotte vengono registrate ---");

  // =================================================================
  // CONFIGURAZIONE SESSIONI E PASSPORT
  // =================================================================
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET non Ã¨ definita nel file .env.");
  }
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // =================================================================
  // ROTTE DI AUTENTICAZIONE
  // =================================================================
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email e password sono obbligatori." });
      }

      const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser.length > 0) {
        return res.status(409).json({ message: "Un utente con questa email esiste giÃ ." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 3600000); // 1 ora

      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        hashedPassword: hashedPassword,
        provider: 'local',
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      }).returning({ id: users.id, email: users.email });

      await storage.createDefaultListForUser(newUser.id);
      await sendVerificationEmail(newUser.email, verificationToken);

      res.status(201).json({
        message: "Registrazione quasi completata. Controlla la tua email per il link di verifica.",
        user: newUser
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/verify-email", async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).send("<h1>Errore: Token di verifica mancante o non valido.</h1>");
      }
      const result = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
      const user = result[0];
      if (!user) {
        return res.status(404).send("<h1>Errore: Token non valido o giÃ  utilizzato.</h1>");
      }
      if (user.emailVerificationTokenExpires && new Date() > new Date(user.emailVerificationTokenExpires)) {
        return res.status(400).send("<h1>Errore: Token di verifica scaduto.</h1>");
      }
      await db.update(users)
        .set({
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpires: null
        })
        .where(eq(users.id, user.id));
      console.log(`âœ… Email verificata con successo per l'utente: ${user.email}`);
      res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h1>âœ… Email Verificata con Successo!</h1>
          <p>Il tuo account Ã¨ stato attivato. Ora puoi tornare all'applicazione ed effettuare il login.</p>
          <a href="/login" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            Vai al Login
          </a>
        </div>
      `);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ message: "Login effettuato con successo.", user: req.user });
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) { return next(err); }
      req.session.destroy((err) => {
        if (err) { return res.status(500).json({ message: "Impossibile effettuare il logout." }); }
        res.clearCookie('connect.sid');
        res.json({ message: "Logout effettuato con successo." });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.json({ user: null });
    }
  });

  // =================================================================
  // ROTTE PROTETTE
  // =================================================================

  // === LISTE DELLA SPESA ===
  app.get("/api/lists", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const lists = await storage.getListsForUser(userId);
      res.json(lists);
    } catch (error) {
      next(error);
    }
  });

  // === PRODOTTI (SPECIFICI PER LISTA) ===
  app.get("/api/lists/:listId/items", isAuthenticated, isListMember, async (req, res, next) => {
    try {
      const listId = parseInt(req.params.listId, 10);
      const items = await storage.getShoppingItemsByListId(listId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/lists/:listId/items", isAuthenticated, isListMember, async (req, res, next) => {
    try {
      const listId = parseInt(req.params.listId, 10);
      const validatedData = insertShoppingItemSchema.parse({ ...req.body, listId });
      if (!validatedData.category) {
        validatedData.category = await categorizeItem(validatedData.name);
      }
      const newItem = await storage.createShoppingItem(validatedData);
      res.status(201).json(newItem);
    } catch (error) {
      next(error);
    }
  });

  // --- MODIFICA 3/5: AGGIORNIAMO L'ENDPOINT DI ACQUISTO CON IL NUOVO MIDDLEWARE E LOGICA ---
  app.post("/api/items/:itemId/purchase", isAuthenticated, isItemOwner, async (req, res, next) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        // Recuperiamo l'item dal middleware per evitare una query extra
        const item = (req as any).item as ShoppingItem; 
        const userId = (req.user as User).id;
        
        // Il corpo della richiesta ora può contenere lo storeId
        const { storeId } = req.body;

        // Passiamo i dati necessari a `markItemAsPurchased`
        await storage.markItemAsPurchased(itemId, userId, storeId);
        
        res.json({ success: true, message: `"${item.name}" acquistato.` });
    } catch (error) {
        next(error);
    }
  });
  
  app.delete("/api/items/:itemId", isAuthenticated, isItemOwner, async (req, res, next) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        await storage.deleteShoppingItem(itemId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
  });
  // --- FINE MODIFICA 3/5 ---

  // --- MODIFICA 4/5: ROTTA PER LA RICERCA TRAMITE EAN (DAL PASSO PRECEDENTE, CONFERMATA) ---
  app.get("/api/products/by-ean/:ean", isAuthenticated, async (req, res, next) => {
    try {
      const { ean } = req.params;
      advancedMatcher.caricaDatiSeNecessario();
      const product = advancedMatcher.findProductByEan(ean);
      if (product) {
        res.json(product);
      } else {
        res.status(404).json({ message: "Prodotto non trovato nel database." });
      }
    } catch (error) {
      next(error);
    }
  });
  // --- FINE MODIFICA 4/5 ---


  // --- MODIFICA 5/5: NUOVE ROTTE PER GEOLOCALIZZAZIONE E LAYOUT ---
  // =================================================================
  // GEOLOCALIZZAZIONE E LAYOUT NEGOZI
  // =================================================================
  
  app.post("/api/check-in", isAuthenticated, async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: "Latitudine e longitudine sono richieste." });
        }

        const nearbyPlaces = await geolocationService.findNearbySupermarkets(latitude, longitude);
        
        // Per ogni luogo trovato, controlla se esiste già nel nostro DB, altrimenti crealo.
        const storesInDb = await Promise.all(
            nearbyPlaces.map(async (place) => {
                let store = await storage.findStoreByExternalId(place.externalId);
                if (!store) {
                    store = await storage.createStore(place);
                }
                return store;
            })
        );
        
        res.json(storesInDb);
    } catch (error) {
        next(error);
    }
  });

  app.get("/api/stores/:storeId/layout", isAuthenticated, async (req, res, next) => {
    try {
        const storeId = parseInt(req.params.storeId, 10);
         if (isNaN(storeId)) {
            return res.status(400).json({ message: "ID del negozio non valido." });
        }
        const layout = await storage.getStoreLayout(storeId);
        
        if (layout && layout.categoryOrder) {
            // Drizzle con SQLite memorizza JSON come stringhe, quindi dobbiamo fare il parse.
            res.json({ categoryOrder: JSON.parse(layout.categoryOrder as string) });
        } else {
            res.json({ categoryOrder: [] });
        }
    } catch (error) {
        next(error);
    }
  });
  // --- FINE MODIFICA 5/5 ---
  
  
  // === STORICO ACQUISTI ===
  app.get("/api/lists/:listId/history", isAuthenticated, isListMember, async (req, res, next) => {
    try {
        const listId = parseInt(req.params.listId, 10);
        const history = await storage.getPurchaseHistoryByListId(listId);
        res.json(history);
    } catch (error) {
        next(error);
    }
  });
  
  // === SUGGERIMENTI ===
  app.get("/api/suggestions", isAuthenticated, async (req, res, next) => {
    try {
        const userId = (req.user as User).id;
        const suggestions = await storage.getSuggestionsByUserId(userId);
        res.json(suggestions);
    } catch (error) {
        next(error);
    }
  });
  
  app.post("/api/suggestions/generate", isAuthenticated, async (req, res, next) => {
    try {
        const userId = (req.user as User).id;
        const userLists = await storage.getListsForUser(userId);
        if(userLists.length === 0) return res.json([]);

        let fullHistory: PurchaseHistory[] = [];
        for(const list of userLists) {
            const history = await storage.getPurchaseHistoryByListId(list.id);
            fullHistory.push(...history);
        }

        const itemStatsForAI: any[] = []; // La logica di aggregazione andrà qui
        const aiSuggestions = await generateSmartSuggestions(itemStatsForAI);
        
        const createdSuggestions = await Promise.all(
            aiSuggestions.map(suggestion => storage.createSuggestion({ userId, ...suggestion, category: suggestion.category || 'Altri' }))
        );
        res.json(createdSuggestions);
    } catch (error) {
        next(error);
    }
  });

  app.post("/api/suggestions/:suggestionId/accept", isAuthenticated, async (req, res, next) => {
    try {
        const suggestionId = parseInt(req.params.suggestionId, 10);
        const { listId } = req.body;
        if (!listId) return res.status(400).json({ message: "listId è richiesto." });
        const userId = (req.user as User).id;
        const isMember = await storage.isUserMemberOfList(userId, listId);
        if (!isMember) return res.status(403).json({ message: "Non puoi aggiungere item a questa lista." });
        
        const suggestion = await storage.updateSuggestion(suggestionId, { isAccepted: true });
        
        await storage.createShoppingItem({
            listId: listId,
            name: suggestion.itemName,
            category: suggestion.category
        });
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
  });

  // === AI SHOPPING LIST ===
  app.post("/api/ai-suggestions", isAuthenticated, async (req, res, next) => {
    try {
      const { requirement } = req.body;
      if (!requirement) return res.status(400).json({ message: "Requirement text is required" });
      const aiSuggestions = await generateAIShoppingList(String(requirement));
      res.json(aiSuggestions);
    } catch (error) {
      next(error);
    }
  });

  // === ROTTE PUBBLICHE ===
  app.get("/api/add-by-url", async (req, res, next) => {
    try {
      const productName = req.query.product as string;
      if (!productName) {
        return res.status(400).json({ success: false, message: "Product name required." });
      }
      const category = await categorizeItem(productName);
      const newItem = await storage.createShoppingItem({ name: productName.trim(), category, listId: 1 });
      res.json({ success: true, item: newItem });
    } catch (error) {
      next(error);
    }
  });

  // === ROTTE E-COMMERCE E ALTRO ===
  app.post("/api/ecommerce/match", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const { items, platform = "carrefour", expandSearch = false } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Items array is required" });
      
      let skip = 0;
      if (expandSearch) {
        const itemName = items[0];
        const existingMatches = await storage.getEcommerceMatchesByItemName(userId, platform, itemName);
        skip = existingMatches.length;
        console.log(`Ricerca espansa per "${itemName}". Trovati ${skip} match esistenti. Saltandoli...`);
      } else {
        await storage.clearEcommerceMatches(platform, userId);
      }
      const matches = await matchProductsToEcommerce(items, platform, skip);
      
      const createdMatches = await Promise.all(
        matches.map(match => storage.createEcommerceMatch({ ...match, userId }))
      );
      res.json(createdMatches);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/ecommerce/matches/:platform", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const platform = req.params.platform;
      const matches = await storage.getEcommerceMatchesByUserId(userId, platform);
      res.json(matches);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/ecommerce/matches/:platform", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const platform = req.params.platform;
      await storage.clearEcommerceMatches(platform, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ecommerce/cart/xml", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const { items, platform = "carrefour" } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Items array is required" });
      
      const matches = await storage.getEcommerceMatchesByUserId(userId, platform);
      const cart = createEcommerceCart(items, matches, platform);
      const xml = generateCartXML(cart);
      
      res.set({
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="smartcart-${platform}-${new Date().toISOString().split('T')[0]}.xml"`
      });
      res.send(xml);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/ecommerce/cart/url", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const { platform = "carrefour", selectedProducts } = req.body;
      
      if (!selectedProducts || typeof selectedProducts !== 'object' || Object.keys(selectedProducts).length === 0) {
        return res.status(400).json({ message: "L'oggetto 'selectedProducts' è richiesto e non può essere vuoto." });
      }
      
      const matches = await storage.getEcommerceMatchesByUserId(userId, platform);
      
      const cartItems = Object.entries(selectedProducts).map(([itemName, selection]: [string, any]) => {
        const match = matches.find(m => m.productId === selection.productId);
        return {
          name: match?.matchedProduct || itemName,
          productId: match?.productId,
          quantity: selection.quantity || 1,
          price: match?.price,
          category: match?.category
        };
      });

      if (cartItems.length === 0) {
          return res.status(400).json({ message: "Nessun prodotto valido trovato per creare il carrello." });
      }
      
      const estimatedTotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
      const cart = { platform, items: cartItems, totalItems: cartItems.length, estimatedTotal };
      
      let url = "";
      switch (platform) {
        case "carrefour": url = generateCarrefourUrl(cart); break;
        case "esselunga": url = generateEsselungaUrl(cart); break;
        default: throw new Error(`Platform ${platform} not supported`);
      }
      res.json({ url, cart });
    } catch (error) {
      next(error);
    }
  });

  // ROTTE ADMIN
  app.get("/api/database/stats", async (req, res, next) => {
    try {
      const { advancedMatcher } = await import('./services/advanced-matching.js');
      advancedMatcher.caricaDatiSeNecessario();
      res.json(advancedMatcher.getStats());
    } catch(error) {
      next(error);
    }
  });

  app.get("/api/vector-index/status", async (req, res, next) => {
    try {
      const { verificaStatoCartellaProdotti } = await import('./services/vector-index-builder.js');
      res.json(verificaStatoCartellaProdotti());
    } catch(error) {
      next(error);
    }
  });

  app.post("/api/vector-index/build", async (req, res, next) => {
    try {
      const { costruisciIndiciVettoriali } = await import('./services/vector-index-builder.js');
      const risultato = await costruisciIndiciVettoriali();
      if (risultato.successo) {
        const { advancedMatcher } = await import('./services/advanced-matching.js');
        advancedMatcher.caricaDatiSeNecessario();
      }
      res.status(risultato.successo ? 200 : 400).json(risultato);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/config/semantic-scoring", async (req, res) => {
    (global as any).SEMANTIC_SCORING_ENABLED = Boolean(req.body.enabled);
    res.json({ success: true, enabled: (global as any).SEMANTIC_SCORING_ENABLED });
  });

  app.get("/api/config/semantic-scoring", (req, res) => {
    res.json({ enabled: (global as any).SEMANTIC_SCORING_ENABLED || false });
  });

  app.get("/api/config/token-stats", (req, res) => {
    res.json({ totalTokens: (global as any).TOTAL_TOKENS_USED || 0, lastReset: (global as any).TOKEN_RESET_DATE || null });
  });

  app.post("/api/config/token-stats/reset", (req, res) => {
    (global as any).TOTAL_TOKENS_USED = 0;
    (global as any).TOKEN_RESET_DATE = new Date().toISOString();
    res.json({ success: true, totalTokens: 0, lastReset: (global as any).TOKEN_RESET_DATE });
  });

  app.get("/api/config/ai-provider", async (req, res, next) => {
    try {
      const { getAvailableProviders } = await import('./services/ai-provider.js');
      res.json({
        currentProvider: (global as any).AI_PROVIDER || 'openai',
        availableProviders: getAvailableProviders()
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/config/ai-provider", async (req, res, next) => {
    try {
      const { setAIProvider, isProviderAvailable } = await import('./services/ai-provider.js');
      const { provider } = req.body;
      if (!provider || !isProviderAvailable(provider)) {
        return res.status(400).json({ message: "Provider non valido o non disponibile" });
      }
      setAIProvider(provider);
      res.json({ success: true, currentProvider: provider });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}