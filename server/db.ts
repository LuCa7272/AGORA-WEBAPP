// FILE: server/db.ts

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from '@shared/schema';

// Definiamo il percorso per la cartella dei dati del server
const DATA_DIR = path.join(process.cwd(), 'server', 'data');

// Assicuriamoci che la cartella esista, altrimenti la creiamo
if (!fs.existsSync(DATA_DIR)) {
  console.log(`Cartella dati non trovata, la creo in: ${DATA_DIR}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Definiamo il percorso completo per il nostro file di database SQLite
const DB_PATH = path.join(DATA_DIR, 'local.db');

// Creiamo un'istanza del database SQLite.
// 'better-sqlite3' aprirà il file se esiste, o lo creerà se non esiste.
const sqlite = new Database(DB_PATH);
console.log(`✅ Database SQLite connesso con successo a: ${DB_PATH}`);

// Crea l'istanza principale di Drizzle ORM, che è il nostro punto di accesso al database.
// Collega il client SQLite (sqlite) con gli schemi delle tabelle (* as schema).
export const db = drizzle(sqlite, { schema });