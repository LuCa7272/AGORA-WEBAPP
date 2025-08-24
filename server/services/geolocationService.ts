// FILE: server/services/geolocationService.ts

import { Client, Place, PlacesNearbyRanking } from "@googlemaps/google-maps-services-js";

interface NearbyStore {
    externalId: string; // Google Place ID
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

const MOCK_STORES: NearbyStore[] = [
    { externalId: 'mock_1', name: 'Supermercato Test 1', address: 'Via Finta, 123', latitude: 45.46, longitude: 9.18 },
    { externalId: 'mock_2', name: 'Discount Prova', address: 'Piazza Esempio, 45', latitude: 45.47, longitude: 9.19 },
    { externalId: 'mock_3', name: 'MiniMarket Sviluppo', address: 'Corso Dati, 67', latitude: 45.45, longitude: 9.17 },
];

// --- NUOVO BLOCCO: Parole chiave per il filtro ---
const EXCLUDED_KEYWORDS_IN_NAME = ['macelleria', 'panificio', 'panetteria', 'gastronomia', 'salumeria', 'vini', 'enoteca', 'farmacia', 'tabacchi'];

class GeolocationService {
    private client: Client;
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.client = new Client({});

        if (!this.apiKey) {
            console.warn("ATTENZIONE: GOOGLE_MAPS_API_KEY non è impostata. Il servizio di geolocalizzazione non funzionerà.");
        } else {
            console.log("✅ Servizio di geolocalizzazione inizializzato con API Key.");
        }
    }

    public async findNearbySupermarkets(latitude: number, longitude: number): Promise<NearbyStore[]> {
        if (process.env.USE_MOCK_GEOLOCATION === 'true') {
            console.log("📍 [MOCK GEOLOCATION] Servizio di geolocalizzazione in modalità mock. Nessuna chiamata API verrà effettuata.");
            return MOCK_STORES;
        }
        
        if (!this.apiKey) {
            return [];
        }

        try {
            const response = await this.client.placesNearby({
                params: {
                    location: { lat: latitude, lng: longitude },
                    // --- MODIFICA CHIAVE 1: Aggiunta di 'keyword' per specificare la ricerca ---
                    keyword: 'supermercato OR ipermercato OR superstore OR market',
                    type: "supermarket",
                    key: this.apiKey,
                    rankby: PlacesNearbyRanking.distance,
                },
            });

            if (response.data.status === 'OK') {
                const results = response.data.results as Place[];
                
                // --- MODIFICA CHIAVE 2: Filtraggio aggiuntivo sui risultati ---
                const filteredResults = results.filter(place => {
                    const nameLower = place.name?.toLowerCase() || '';
                    // Ritorna true (mantiene il negozio) solo se nessuna delle parole chiave escluse è presente nel nome
                    return !EXCLUDED_KEYWORDS_IN_NAME.some(keyword => nameLower.includes(keyword));
                });

                return filteredResults.map((place: Place) => ({
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