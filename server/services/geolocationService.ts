// FILE: server/services/geolocationService.ts (VERSIONE FINALE DI PRODUZIONE)

import { Client, Place, PlacesNearbyRanking } from "@googlemaps/google-maps-services-js";

interface NearbyStore {
    externalId: string; // Google Place ID
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

class GeolocationService {
    private client: Client;
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.client = new Client({});

        // Aggiungiamo un controllo all'avvio per assicurarci che la chiave sia caricata
        if (!this.apiKey) {
            console.warn("ATTENZIONE: GOOGLE_MAPS_API_KEY non è impostata. Il servizio di geolocalizzazione non funzionerà.");
        } else {
            console.log("✅ Servizio di geolocalizzazione inizializzato con API Key.");
        }
    }

    /**
     * Cerca i supermercati vicini a una data coordinata.
     * @param latitude Latitudine dell'utente.
     * @param longitude Longitudine dell'utente.
     * @returns Una promessa che si risolve con un array di negozi trovati.
     */
    public async findNearbySupermarkets(latitude: number, longitude: number): Promise<NearbyStore[]> {
        // Se la chiave non è disponibile, restituisce un array vuoto invece del mock.
        // Questo è il comportamento corretto per un ambiente di produzione.
        if (!this.apiKey) {
            return [];
        }

        try {
            const response = await this.client.placesNearby({
                params: {
                    location: { lat: latitude, lng: longitude },
                    radius: 500, // Cerca in un raggio di 500 metri
                    type: "supermarket",
                    key: this.apiKey,
                    rankby: PlacesNearbyRanking.distance,
                },
            });

            if (response.data.status === 'OK') {
                return response.data.results.map((place: Place) => ({
                    externalId: place.place_id!,
                    name: place.name!,
                    address: place.vicinity!,
                    latitude: place.geometry?.location.lat!,
                    longitude: place.geometry?.location.lng!,
                }));
            } else {
                console.error("Errore dall'API di Google Places:", response.data.status, response.data.error_message);
                return [];
            }
        } catch (error) {
            console.error("Errore durante la chiamata al servizio di geolocalizzazione:", error);
            return [];
        }
    }
}

export const geolocationService = new GeolocationService();