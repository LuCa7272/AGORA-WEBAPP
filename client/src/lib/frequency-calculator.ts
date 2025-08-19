import { differenceInDays, parseISO } from 'date-fns';

export interface PurchaseRecord {
  datePurchased: string;
  daysSinceAdded: number;
}

export interface FrequencyData {
  averageFrequency: number;
  confidence: number;
  nextSuggestedDate: Date;
  shouldSuggest: boolean;
}

export function calculatePurchaseFrequency(
  purchases: PurchaseRecord[],
  itemName: string
): FrequencyData {
  if (purchases.length === 0) {
    return {
      averageFrequency: 0,
      confidence: 0,
      nextSuggestedDate: new Date(),
      shouldSuggest: false
    };
  }

  if (purchases.length === 1) {
    const daysSinceLastPurchase = differenceInDays(new Date(), parseISO(purchases[0].datePurchased));
    const suggestedFrequency = purchases[0].daysSinceAdded;
    
    return {
      averageFrequency: suggestedFrequency,
      confidence: 0.3,
      nextSuggestedDate: new Date(Date.now() + suggestedFrequency * 24 * 60 * 60 * 1000),
      shouldSuggest: daysSinceLastPurchase >= suggestedFrequency * 0.8
    };
  }

  // Calculate intervals between purchases
  const sortedPurchases = purchases
    .sort((a, b) => new Date(a.datePurchased).getTime() - new Date(b.datePurchased).getTime());

  const intervals: number[] = [];
  for (let i = 1; i < sortedPurchases.length; i++) {
    const interval = differenceInDays(
      parseISO(sortedPurchases[i].datePurchased),
      parseISO(sortedPurchases[i - 1].datePurchased)
    );
    intervals.push(interval);
  }

  // Calculate average frequency
  const averageFrequency = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

  // Calculate confidence based on consistency of intervals
  const variance = intervals.reduce((sum, interval) => 
    sum + Math.pow(interval - averageFrequency, 2), 0) / intervals.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = standardDeviation / averageFrequency;
  
  // Lower coefficient of variation means higher confidence
  const confidence = Math.max(0.1, Math.min(0.95, 1 - coefficientOfVariation));

  // Calculate next suggested date
  const lastPurchaseDate = parseISO(sortedPurchases[sortedPurchases.length - 1].datePurchased);
  const nextSuggestedDate = new Date(lastPurchaseDate.getTime() + averageFrequency * 24 * 60 * 60 * 1000);

  // Determine if we should suggest now
  const daysSinceLastPurchase = differenceInDays(new Date(), lastPurchaseDate);
  const shouldSuggest = daysSinceLastPurchase >= averageFrequency * 0.8 && confidence > 0.5;

  return {
    averageFrequency,
    confidence,
    nextSuggestedDate,
    shouldSuggest
  };
}

export function formatFrequencyText(averageFrequency: number): string {
  if (averageFrequency < 1) {
    return "Molto frequente";
  } else if (averageFrequency === 1) {
    return "Ogni giorno";
  } else if (averageFrequency < 7) {
    return `Ogni ${Math.round(averageFrequency)} giorni`;
  } else if (averageFrequency < 30) {
    const weeks = Math.round(averageFrequency / 7);
    return weeks === 1 ? "Ogni settimana" : `Ogni ${weeks} settimane`;
  } else {
    const months = Math.round(averageFrequency / 30);
    return months === 1 ? "Ogni mese" : `Ogni ${months} mesi`;
  }
}

export function getFrequencyColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-secondary"; // Green
  if (confidence >= 0.6) return "bg-accent"; // Yellow
  return "bg-gray-400"; // Gray
}

export function getFrequencyDots(confidence: number): number {
  return Math.max(1, Math.min(5, Math.round(confidence * 5)));
}
