// FILE: drizzle.config.ts

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  // Cambiamo il dialetto da 'postgresql' a 'sqlite'
  dialect: "sqlite", 
  // La configurazione di dbCredentials ora punta al nostro file locale
  dbCredentials: {
    url: "./server/data/local.db",
  },
  // La riga 'driver' è stata rimossa
});