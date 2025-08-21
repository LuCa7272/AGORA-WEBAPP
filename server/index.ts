// FILE: server/index.ts (CON SINTASSI 'IMPORT' CORRETTA)

import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // <-- MODIFICA CHIAVE: Importa 'fs' all'inizio del file

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("it-IT", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    });
  }
  next();
});

(async () => {
  const server = await registerRoutes(app);

  if (process.env.NODE_ENV === "production") {
    
    const clientBuildPath = path.resolve(process.cwd(), 'dist/public');
    
    log(`Modalità Produzione: Servendo file statici da ${clientBuildPath}`);

    // Ora 'fs' è definito e questo controllo funzionerà
    if (fs.existsSync(clientBuildPath)) {
        app.use(express.static(clientBuildPath));

        app.get('*', (req, res) => {
          res.sendFile(path.resolve(clientBuildPath, 'index.html'));
        });
    } else {
        log(`ERRORE: La cartella di build del client non è stata trovata in ${clientBuildPath}`);
        log(`Esegui 'npm run build' prima di avviare il server in produzione.`);
    }
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, () => {
    log(`Server in ascolto sulla porta ${port}`);
    log(`Modalità corrente: ${process.env.NODE_ENV || 'development'}`);
  });
})();