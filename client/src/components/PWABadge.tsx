// FILE: client/src/components/PWABadge.tsx (NUOVO FILE)

import { useRegisterSW } from 'virtual:pwa-register/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from './ui/button'
import { Rocket, RotateCw } from 'lucide-react'

function PWABadge() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registrato con successo:', r)
    },
    onRegisterError(error) {
      console.error('[PWA] Errore di registrazione del Service Worker:', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  // Se l'app è pronta per funzionare offline, mostra un messaggio temporaneo
  if (offlineReady) {
    return (
      <Alert className="fixed bottom-4 left-4 z-50 w-auto max-w-md shadow-lg">
        <Rocket className="h-4 w-4" />
        <AlertTitle>App Pronta Offline!</AlertTitle>
        <AlertDescription>
          Questa applicazione è stata salvata e ora funziona anche senza connessione a internet.
        </AlertDescription>
        <Button variant="outline" size="sm" onClick={() => close()} className="mt-4">
          Chiudi
        </Button>
      </Alert>
    )
  }

  // Se c'è una nuova versione dell'app, chiedi all'utente di aggiornare
  if (needRefresh) {
    return (
      <Alert className="fixed bottom-4 left-4 z-50 w-auto max-w-md shadow-lg">
        <RotateCw className="h-4 w-4" />
        <AlertTitle>Nuova Versione Disponibile!</AlertTitle>
        <AlertDescription>
          Ricarica l'applicazione per applicare gli ultimi aggiornamenti.
        </AlertDescription>
        <div className="mt-4 flex gap-2">
            <Button onClick={() => updateServiceWorker(true)}>
                Aggiorna Ora
            </Button>
            <Button variant="outline" onClick={() => close()}>
                Più tardi
            </Button>
        </div>
      </Alert>
    )
  }

  return null
}

export default PWABadge