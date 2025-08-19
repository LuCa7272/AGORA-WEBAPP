// FILE: client/src/components/barcode-scanner.tsx (VERSIONE CON DEBUG E MIGLIORAMENTI)

import { useEffect, useRef, useState, useCallback } from 'react';
// --- MODIFICA 1/4: IMPORTIAMO I FORMATI E GLI HINTS ---
import { BrowserMultiFormatReader, NotFoundException, IScannerControls, DecodeHintType, BarcodeFormat } from '@zxing/library';
// --- FINE MODIFICA 1/4 ---
import { Camera, RefreshCw, X, AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from './ui/button';

interface BarcodeScannerProps {
  onScanSuccess: (text: string) => void;
  onClose?: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // --- MODIFICA 2/4: AGGIUNGIAMO UNO STATO PER IL FEEDBACK VISIVO ---
  const [isScanning, setIsScanning] = useState(true);
  // --- FINE MODIFICA 2/4 ---

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  const stopScan = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    // --- MODIFICA 3/4: AGGIUNGIAMO HINTS E LOG DI DEBUG ---
    console.log("[Scanner] L'effetto useEffect è partito.");

    // Creiamo una mappa di "hints" per ottimizzare la scansione.
    // Diciamo alla libreria di concentrarsi sui formati EAN, molto comuni nei prodotti.
    const hints = new Map();
    const formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);

    // Inizializziamo il lettore con gli hints.
    const codeReader = new BrowserMultiFormatReader(hints);
    console.log("[Scanner] Inizializzato BrowserMultiFormatReader con hints per EAN.");

    const startScanner = async () => {
      try {
        console.log("[Scanner] Richiesta elenco dispositivi video...");
        const devices = await codeReader.listVideoInputDevices();
        console.log(`[Scanner] Trovati ${devices.length} dispositivi video.`);
        setVideoInputDevices(devices);

        if (devices.length > 0) {
          const initialDeviceId = devices[0].deviceId;
          setSelectedDeviceId(initialDeviceId);
          
          console.log(`[Scanner] Tentativo di avvio decodifica dal dispositivo: ${initialDeviceId}`);
          if (!videoRef.current) {
            console.error("[Scanner] Errore critico: videoRef non è ancora disponibile!");
            return;
          }

          controlsRef.current = await codeReader.decodeFromVideoDevice(
            initialDeviceId,
            videoRef.current,
            (result, error, controls) => {
              if (result) {
                console.log("[Scanner] SUCCESSO! Codice trovato:", result.getText());
                setIsScanning(false); // Ferma il feedback visivo
                controls.stop();
                controlsRef.current = null;
                onScanSuccess(result.getText());
              }

              if (error && !(error instanceof NotFoundException)) {
                // Logghiamo solo errori reali, non il "NotFound" che è normale frame per frame.
                console.error('[Scanner] Errore di decodifica nel frame:', error);
              }
            }
          );
           console.log("[Scanner] Decodifica avviata con successo.");
        } else {
          setErrorMessage("Nessuna fotocamera trovata sul dispositivo.");
        }
      } catch (err) {
        console.error("[Scanner] Errore di inizializzazione:", err);
        setErrorMessage("Accesso alla fotocamera negato. Controlla i permessi del browser.");
      }
    };
    
    startScanner();

    return () => {
      console.log("[Scanner] Pulizia... Stoppando lo scanner.");
      stopScan();
    };
  }, [onScanSuccess, stopScan]); // Manteniamo le dipendenze corrette.
  
  // La funzione handleCameraChange non richiede modifiche significative
  const handleCameraChange = (deviceId: string) => {
    stopScan();
    setSelectedDeviceId(deviceId);
    
    const hints = new Map();
    const formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    const codeReader = new BrowserMultiFormatReader(hints);
    
    codeReader.decodeFromVideoDevice(
      deviceId,
      videoRef.current!,
      (result, error, controls) => {
        if (result) {
          setIsScanning(false);
          controls.stop();
          controlsRef.current = null;
          onScanSuccess(result.getText());
        }
      }
    ).then(controls => {
      controlsRef.current = controls;
    }).catch(err => {
      console.error("Errore nel cambio fotocamera:", err);
      setErrorMessage("Impossibile avviare la fotocamera selezionata.");
    });
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
      <video ref={videoRef} className="w-full h-full object-cover" />
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex justify-between items-center w-full">
          {videoInputDevices.length > 1 ? (
            <Select value={selectedDeviceId} onValueChange={handleCameraChange}>
              <SelectTrigger className="w-[180px] bg-black/50 text-white border-white/30">
                <Camera className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Seleziona fotocamera" />
              </SelectTrigger>
              <SelectContent>
                {videoInputDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Fotocamera ${videoInputDevices.indexOf(device) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div />
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white bg-black/50 hover:bg-black/70 rounded-full">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* --- MODIFICA 4/4: MIGLIORIAMO L'INDICATORE DI MIRA --- */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Il bordo ora cambia colore in base allo stato di scansione */}
            <div className={`w-3/4 max-w-sm h-1/3 border-4 rounded-2xl shadow-lg transition-colors duration-300 ${
                isScanning ? 'border-white/50' : 'border-green-500'
            }`}>
                {/* Aggiungiamo un'animazione pulsante per indicare che la scansione è attiva */}
                {isScanning && (
                    <div className="relative w-full h-full">
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-ping" />
                    </div>
                )}
            </div>
        </div>
        {/* --- FINE MODIFICA 4/4 --- */}

        <div className="w-full">
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