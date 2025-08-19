// FILE: server/auth.ts

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Serializzazione: determina quali dati dell'utente salvare nella sessione.
// Salviamo solo l'ID dell'utente per mantenere la sessione leggera.
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserializzazione: recupera i dati completi dell'utente a partire dall'ID salvato in sessione.
// Questa funzione viene eseguita a ogni richiesta di un utente autenticato.
passport.deserializeUser(async (id: number, done) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = result[0];
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Configurazione della strategia di login "local" (email e password).
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        console.log(`Tentativo di login per l'email: ${email}`);
        
        const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
        const user = result[0];

        if (!user) {
          console.log(`Login fallito: utente non trovato con email ${email}`);
          return done(null, false, { message: "Email o password non corretti." });
        }

        if (!user.hashedPassword) {
            console.log(`Login fallito: l'utente ${email} ha effettuato l'accesso con un provider social.`);
            return done(null, false, { message: "Usa il login social per questo account." });
        }

        const isMatch = await bcrypt.compare(password, user.hashedPassword);

        if (!isMatch) {
          console.log(`Login fallito: password non corretta per l'utente ${email}`);
          return done(null, false, { message: "Email o password non corretti." });
        }
        
        // --- NUOVO CONTROLLO DI VERIFICA EMAIL ---
        if (!user.isEmailVerified) {
          console.log(`Login fallito: l'email di ${user.email} non è verificata.`);
          return done(null, false, { message: "Devi prima verificare il tuo indirizzo email per poter accedere." });
        }
        // --- FINE CONTROLLO ---

        console.log(`Login riuscito per l'utente: ${user.email}`);
        return done(null, user);

      } catch (err) {
        return done(err);
      }
    }
  )
);

export default passport;