// FILE: server/services/geolocationService.ts (NUOVO FILE)

// NOTA: Per usare questo servizio, dovrai installare il client di Google:
// npm install @googlemaps/google-maps-services-js

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
    }

    /**
     * Cerca i supermercati vicini a una data coordinata.
     * @param latitude Latitudine dell'utente.
     * @param longitude Longitudine dell'utente.
     * @returns Una promessa che si risolve con un array di negozi trovati.
     */
    public async findNearbySupermarkets(latitude: number, longitude: number): Promise<NearbyStore[]> {
        if (!this.apiKey) {
            console.warn("ATTENZIONE: GOOGLE_MAPS_API_KEY non è impostata. Il servizio di geolocalizzazione restituirà risultati vuoti.");
            // Restituisce un risultato finto per permettere il test offline
            return [
                {
                    externalId: 'test_store_123',
                    name: 'Supermercato di Test (Esselunga)',
                    address: 'Via del Codice, 42, Milano',
                    latitude: 45.4582,
                    longitude: 9.1633,
                }
            ];
        }

        try {
            const response = await this.client.placesNearby({
                params: {
                    location: { lat: latitude, lng: longitude },
                    radius: 500, // Cerca in un raggio di 500 metri
                    type: "supermarket",
                    key: this.apiKey,
                    rankby: PlacesNearbyRanking.distance, // Ordina per distanza
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