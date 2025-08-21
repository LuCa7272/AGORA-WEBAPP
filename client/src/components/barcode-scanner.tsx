// FILE: client/src/components/barcode-scanner.tsx (VERSIONE CON CONTROLLO MANUALE DELLO STREAM)

import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, IScannerControls, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { Camera, X, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from './ui/button';
import { DialogDescription } from './ui/dialog';

interface BarcodeScannerProps {
  onScanSuccess: (text: string) => void;
  onClose?: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  // --- MODIFICA 1/4: Riferimento per lo stream video, per poterlo fermare correttamente ---
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef(new BrowserMultiFormatReader());

  // Funzione di cleanup super robusta
  const stopScanAndReleaseCamera = useCallback(() => {
    // Ferma la libreria di decodifica
    codeReaderRef.current.reset();
    // Ferma ogni traccia dello stream (luce della fotocamera spenta)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    console.log("[Scanner] Fotocamera e scanner rilasciati correttamente.");
  }, []);

  // --- MODIFICA 2/4: useEffect è stato completamente riscritto per il controllo manuale ---
  useEffect(() => {
    let isMounted = true; // Flag per prevenire race conditions durante lo smontaggio

    const setupAndStartScanner = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setErrorMessage(null);
      stopScanAndReleaseCamera(); // Assicura che tutto sia pulito prima di iniziare

      try {
        // Step 1: Ottieni la lista dei dispositivi
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (!isMounted) return;
        
        setVideoInputDevices(videoDevices);

        if (videoDevices.length === 0) {
          throw new Error("Nessuna fotocamera trovata.");
        }
        
        // Se non è ancora stato selezionato un device, scegliamo il migliore (quello posteriore)
        const currentDeviceId = selectedDeviceId || 
            (videoDevices.find(d => /back|rear|environment/i.test(d.label))?.deviceId || videoDevices[0].deviceId);
        
        if (selectedDeviceId !== currentDeviceId) {
          setSelectedDeviceId(currentDeviceId);
        }

        console.log(`[Scanner] Utilizzo dispositivo: ${currentDeviceId}`);

        // Step 2: Richiedi lo stream con le constraints di autofocus
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: { exact: currentDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: 'continuous' }]
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!isMounted || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream; // Salva lo stream nel ref
        videoRef.current.srcObject = stream;
        
        // Dobbiamo assicurarci che il video sia in riproduzione prima di iniziare a decodificare
        await videoRef.current.play();
        
        console.log("[Scanner] Stream video attivo. Avvio decodifica dall'elemento video.");
        setIsLoading(false);
        setIsScanning(true);
        
        // Step 3: Dici a ZXing di decodificare dallo stream che abbiamo preparato noi
        await codeReaderRef.current.decodeFromVideoElement(videoRef.current, (result, error) => {
          if (result) {
            console.log("[Scanner] SUCCESSO! Codice:", result.getText());
            setIsScanning(false);
            onScanSuccess(result.getText());
          }
          if (error && !(error instanceof NotFoundException)) {
            console.error('[Scanner] Errore di decodifica:', error);
            // Non impostiamo un messaggio di errore per errori di frame, solo per quelli di setup
          }
        });

      } catch (err: any) {
        console.error("[Scanner] Errore critico nel setup:", err);
        if (isMounted) {
            setErrorMessage("Impossibile avviare la fotocamera. Controlla i permessi e ricarica la pagina.");
            setIsLoading(false);
        }
      }
    };
    
    setupAndStartScanner();

    // Funzione di cleanup
    return () => {
      isMounted = false;
      stopScanAndReleaseCamera();
    };
  }, [selectedDeviceId, onScanSuccess, stopScanAndReleaseCamera]); // Si riattiva solo se cambia il device selezionato


  // --- MODIFICA 3/4: La funzione di cambio ora si limita a cambiare lo stato ---
  const handleCameraChange = (deviceId: string) => {
    // Cambiando lo stato, l'hook useEffect si riattiverà e gestirà tutto il flusso di riavvio
    setSelectedDeviceId(deviceId); 
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
      <DialogDescription className="sr-only">
        Punta la fotocamera verso un codice a barre per aggiungerlo alla lista.
      </DialogDescription>
      
      {/* --- MODIFICA 4/4: Aggiunto `playsInline` per una migliore compatibilità mobile --- */}
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
            <p className="text-white font-medium">Avvio fotocamera...</p>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-between p-4 z-10">
        <div className="flex justify-between items-center w-full">
          {videoInputDevices.length > 1 ? (
            <Select value={selectedDeviceId} onValueChange={handleCameraChange} disabled={isLoading}>
              <SelectTrigger className="w-[180px] bg-black/50 text-white border-white/30">
                <Camera className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Fotocamera" />
              </SelectTrigger>
              <SelectContent>
                {videoInputDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Fotocamera ${videoInputDevices.indexOf(device) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : <div />}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white bg-black/50 hover:bg-black/70 rounded-full">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-3/4 max-w-sm h-1/3 border-4 rounded-2xl shadow-lg transition-colors duration-300 ${isScanning ? 'border-white/50' : 'border-green-500 animate-pulse'}`}>
                {isScanning && !isLoading && (
                    <div className="relative w-full h-full overflow-hidden rounded-lg">
                        <div 
                           className="absolute top-0 left-0 right-0 h-0.5 bg-red-500/80 shadow-[0_0_10px_red]"
                           style={{ animation: 'scan-laser 2.5s infinite ease-in-out' }}
                        />
                    </div>
                )}
            </div>
        </div>
        
        <style>
            {`@keyframes scan-laser { 0% { transform: translateY(-10px); opacity: 0.5; } 50% { transform: translateY(calc(100% + 10px)); opacity: 1; } 100% { transform: translateY(-10px); opacity: 0.5; } }`}
        </style>

        <div className="w-full">
            {!errorMessage && isLoading && <div className="text-center text-white text-sm p-2 bg-black/30 rounded-md">In attesa dei permessi della fotocamera...</div>}
          {errorMessage && (
            <div className="bg-red-500/80 text-white p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}