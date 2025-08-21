// FILE: server/services/email.ts

import { Resend } from 'resend';
import { type User, type ShoppingList } from '@shared/schema';

// Controlla che la chiave API di Resend sia stata definita.
if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY non Ã¨ definita nel file .env.");
}

// Inizializza il client di Resend con la chiave API.
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'onboarding@resend.dev'; // Email di default fornita da Resend per il testing.
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://tua-app-in-produzione.com' // In futuro, userai il tuo dominio reale qui
  : 'http://localhost:5173'; // IMPORTANTE: Usa la porta del server di sviluppo Vite

/**
 * Invia un'email di verifica a un nuovo utente.
 * @param toEmail L'indirizzo email del destinatario.
 * @param token Il token di verifica univoco.
 */
export async function sendVerificationEmail(toEmail: string, token: string): Promise<void> {
  const verificationUrl = `${BASE_URL}/api/auth/verify-email?token=${token}`;

  try {
    console.log(`âœ‰ï¸   Invio email di verifica a ${toEmail}`);

    const { data, error } = await resend.emails.send({
      from: `SmartCart <${FROM_EMAIL}>`,
      to: [toEmail],
      subject: 'Verifica il tuo indirizzo email per SmartCart',
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

    console.log(`âœ… Email di verifica inviata con successo. ID: ${data?.id}`);
  } catch (err) {
    console.error("Errore imprevisto nel servizio email:", err);
    throw err;
  }
}

/**
 * NUOVA FUNZIONE: Invia un'email di invito per condividere una lista.
 * @param toEmail L'indirizzo email del destinatario.
 * @param inviter L'oggetto utente di chi ha inviato l'invito.
 * @param list L'oggetto lista che viene condivisa.
 * @param token Il token di invito univoco.
 */
export async function sendListInvitationEmail(toEmail: string, inviter: User, list: ShoppingList, token: string): Promise<void> {
  // Costruisce l'URL di accettazione che l'utente cliccherÃ .
  const acceptanceUrl = `${BASE_URL}/invite/accept?token=${token}`;
  const inviterName = inviter.nickname || inviter.email.split('@')[0];

  try {
    console.log(`âœ‰ï¸   Invio email di invito per la lista "${list.name}" a ${toEmail}`);

    const { data, error } = await resend.emails.send({
      from: `SmartCart <${FROM_EMAIL}>`,
      to: [toEmail],
      subject: `${inviterName} ti ha invitato a collaborare sulla lista "${list.name}"`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Sei stato invitato!</h2>
          <p>Ciao,</p>
          <p><strong>${inviterName}</strong> ti ha invitato a collaborare sulla sua lista della spesa "<strong>${list.name}</strong>" su SmartCart.</p>
          <p>Clicca sul pulsante qui sotto per accettare l'invito e iniziare a collaborare:</p>
          <a href="${acceptanceUrl}" target="_blank" style="display: inline-block; margin: 20px 0; padding: 12px 24px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px; font-size: 16px;">
            Accetta Invito
          </a>
          <p>Se non conosci ${inviterName} o non ti aspettavi questo invito, puoi tranquillamente ignorare questa email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">Link diretto: ${acceptanceUrl}</p>
        </div>
      `,
    });

    if (error) {
      console.error("Errore nell'invio dell'email di invito con Resend:", error);
      throw new Error("Impossibile inviare l'email di invito.");
    }

    console.log(`âœ… Email di invito inviata con successo. ID: ${data?.id}`);
  } catch (err) {
    console.error("Errore imprevisto nel servizio email per inviti:", err);
    throw err;
  }
}