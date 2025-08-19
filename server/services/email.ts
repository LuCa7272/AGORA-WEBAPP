// FILE: server/services/email.ts

import { Resend } from 'resend';

// Controlla che la chiave API di Resend sia stata definita.
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY non è definita nel file .env.");
}

// Inizializza il client di Resend con la chiave API.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'onboarding@resend.dev'; // Email di default fornita da Resend per il testing.
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://tua-app-in-produzione.com' // In futuro, userai il tuo dominio reale qui
  : 'http://localhost:5000'; // Per lo sviluppo locale

/**
 * Invia un'email di verifica a un nuovo utente.
 * 
 * @param toEmail L'indirizzo email del destinatario.
 * @param token Il token di verifica univoco.
 */
export async function sendVerificationEmail(toEmail: string, token: string): Promise<void> {
  // Costruisce l'URL di verifica che l'utente cliccherà.
  const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;

  try {
    console.log(`✉️  Invio email di verifica a ${toEmail}`);

    const { data, error } = await resend.emails.send({
      from: `SmartCart <${FROM_EMAIL}>`, // Mittente visualizzato
      to: [toEmail],
      subject: 'Verifica il tuo indirizzo email per SmartCart',
      // Usiamo React per creare un'email HTML carina e funzionale.
      // Per ora usiamo un semplice HTML.
      html: `
        <h1>Benvenuto in SmartCart!</h1>
        <p>Grazie per esserti registrato. Per favore, clicca sul link qui sotto per verificare il tuo indirizzo email:</p>
        <a href="${verificationUrl}" target="_blank" style="padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">
          Verifica la mia Email
        </a>
        <p>Se non hai creato un account, per favore ignora questa email.</p>
        <hr>
        <p>Link diretto: ${verificationUrl}</p>
      `,
    });

    if (error) {
      console.error("Errore nell'invio dell'email con Resend:", error);
      throw new Error("Impossibile inviare l'email di verifica.");
    }

    console.log(`✅ Email di verifica inviata con successo. ID: ${data?.id}`);
  } catch (err) {
    console.error("Errore imprevisto nel servizio email:", err);
    // Rilancia l'errore per farlo gestire dal chiamante (la nostra rotta di registrazione).
    throw err;
  }
}