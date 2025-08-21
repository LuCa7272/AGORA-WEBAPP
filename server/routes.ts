// FILE: server/routes.ts

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertShoppingItemSchema,
  shoppingItems
} from "@shared/schema";
import { advancedMatcher } from './services/advanced-matching.js';
import { generateSmartSuggestions, matchProductsToEcommerce, categorizeItem, generateAIShoppingList } from "./services/ai-provider";
import { generateCartXML, createEcommerceCart, generateCarrefourUrl, generateEsselungaUrl } from "./services/ecommerce";
import { geolocationService } from './services/geolocationService.js';
import session from "express-session";
import bcrypt from "bcrypt";
import passport from "./auth";
import { users, shoppingLists, type User, type PurchaseHistory, type ShoppingItem, type ShoppingList } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from './db';
import crypto from 'crypto';
import { sendVerificationEmail, sendListInvitationEmail } from './services/email';

// =================================================================
// MIDDLEWARE DI AUTORIZZAZIONE
// =================================================================

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
      const user = req.user as User;
      if (user.isEmailVerified) {
          return next();
      }
      return res.status(403).json({ message: "Accesso negato. L'email non e' stata verificata." });
  }
  res.status(401).json({ message: "Accesso non autorizzato. Effettua il login." });
};

const isListMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listIdParam = req.params.listId;
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

const isListOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const listId = parseInt(req.params.listId, 10);
        const userId = (req.user as User).id;
        const isOwner = await storage.isUserMemberOfList(userId, listId, ['owner']);
        if (isOwner) {
            return next();
        }
        res.status(403).json({ message: "Accesso negato. Solo il proprietario puo' eseguire questa azione." });
    } catch (error) {
        next(error);
    }
};

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
      (req as any).item = item;
      return next();
    }
    res.status(403).json({ message: "Accesso negato. Non hai i permessi per modificare questo prodotto." });
  } catch (error) {
    next(error);
  }
};


export async function registerRoutes(app: Express): Promise<Server> {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET non e' definita nel file .env.");
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
      const { email, password, nickname } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email e password sono obbligatori." });
      }
      if (nickname && nickname.length > 8) {
        return res.status(400).json({ message: "Il nickname non puo' superare gli 8 caratteri." });
      }
      const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser.length > 0) {
        return res.status(409).json({ message: "Un utente con questa email esiste gia'." });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenExpires = new Date(Date.now() + 3600000);
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        hashedPassword: hashedPassword,
        nickname: nickname || null,
        provider: 'local',
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      }).returning({ id: users.id, email: users.email, nickname: users.nickname });
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
        return res.status(404).send("<h1>Errore: Token non valido o gia' utilizzato.</h1>");
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
      console.log(`Email verificata con successo per l'utente: ${user.email}`);
      res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 40px;">
          <h1>Email Verificata con Successo!</h1>
          <p>Il tuo account e' stato attivato. Ora puoi tornare all'applicazione ed effettuare il login.</p>
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

  app.put("/api/user/nickname", isAuthenticated, async (req, res, next) => {
    try {
        const { nickname } = req.body;
        const userId = (req.user as User).id;
        if (!nickname || nickname.length > 8 || nickname.length < 3) {
            return res.status(400).json({ message: "Il nickname deve avere tra 3 e 8 caratteri." });
        }
        await db.update(users).set({ nickname: nickname }).where(eq(users.id, userId));
        res.json({ success: true, message: "Nickname aggiornato con successo." });
    } catch (error) {
        next(error);
    }
  });

  app.get("/api/lists", isAuthenticated, async (req, res, next) => {
    try {
      const userId = (req.user as User).id;
      const lists = await storage.getListsForUser(userId);
      res.json(lists);
    } catch (error) {
      next(error);
    }
  });
  
  // --- INSERISCI QUESTO BLOCCO QUI ---
  app.post("/api/lists", isAuthenticated, async (req, res, next) => {
    try {
      const { name } = req.body;
      const userId = (req.user as User).id;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Il nome della lista e' obbligatorio." });
      }

      const newList = await storage.createList(userId, name.trim());
      res.status(201).json(newList);
    } catch (error) {
      next(error);
    }
  });
  // --- FINE BLOCCO DA INSERIRE ---

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

  app.post("/api/lists/:listId/invitations", isAuthenticated, isListOwner, async (req, res, next) => {
    try {
        const listId = parseInt(req.params.listId, 10);
        const inviter = req.user as User;
        const { email: inviteeEmail } = req.body;

        if (!inviteeEmail) {
            return res.status(400).json({ message: "L'email dell'invitato e' richiesta." });
        }
        
        const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId)).limit(1);
        if(!list) return res.status(404).json({message: "Lista non trovata"});

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000 * 7); // Scadenza tra 7 giorni

        await storage.createInvitation(listId, inviter.id, inviteeEmail, token, expiresAt);
        await sendListInvitationEmail(inviteeEmail, inviter, list, token);

        res.status(200).json({ message: "Invito inviato con successo." });
    } catch (error) {
        next(error);
    }
  });

  app.post("/api/invitations/accept", isAuthenticated, async (req, res, next) => {
    try {
        const { token } = req.body;
        const user = req.user as User;

        if (!token) {
            return res.status(400).json({ message: "Token mancante." });
        }

        const invitation = await storage.findInvitationByToken(token);

        if (!invitation) {
            return res.status(404).json({ message: "Invito non valido, scaduto o gia' utilizzato." });
        }
        
        if (invitation.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
            return res.status(403).json({ message: "Questo invito e' destinato a un altro utente." });
        }

        await storage.addListMember(invitation.listId, user.id, 'editor');
        await storage.updateInvitationStatus(invitation.id, 'accepted');

        res.json({ message: "Invito accettato! La lista e' stata aggiunta al tuo account." });
    } catch (error) {
        next(error);
    }
  });
  
  app.post("/api/items/:itemId/purchase", isAuthenticated, isItemOwner, async (req, res, next) => {
    try {
        const itemId = parseInt(req.params.itemId, 10);
        const item = (req as any).item as ShoppingItem; 
        const userId = (req.user as User).id;
        const { storeId } = req.body;
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

  app.post("/api/check-in", isAuthenticated, async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: "Latitudine e longitudine sono richieste." });
        }
        const nearbyPlaces = await geolocationService.findNearbySupermarkets(latitude, longitude);
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
            res.json({ categoryOrder: JSON.parse(layout.categoryOrder as string) });
        } else {
            res.json({ categoryOrder: [] });
        }
    } catch (error) {
        next(error);
    }
  });
  
  app.get("/api/lists/:listId/history", isAuthenticated, isListMember, async (req, res, next) => {
    try {
        const listId = parseInt(req.params.listId, 10);
        const history = await storage.getPurchaseHistoryByListId(listId);
        res.json(history);
    } catch (error) {
        next(error);
    }
  });
  
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
        const itemStatsForAI: any[] = [];
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
        if (!listId) return res.status(400).json({ message: "listId e' richiesto." });
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
        return res.status(400).json({ message: "L'oggetto 'selectedProducts' e' richiesto e non puo' essere vuoto." });
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