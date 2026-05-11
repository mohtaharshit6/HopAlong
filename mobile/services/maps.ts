const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export interface DistanceResult {
  distanceKm: number;
  durationMin: number;
  distanceText: string;
  durationText: string;
}

export async function getDistanceMatrix(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<DistanceResult | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${originLat},${originLng}` +
      `&destinations=${destLat},${destLng}` +
      `&mode=driving&key=${KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    const element = json?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") return null;

    return {
      distanceKm: element.distance.value / 1000,
      durationMin: Math.ceil(element.duration.value / 60),
      distanceText: element.distance.text,
      durationText: element.duration.text,
    };
  } catch {
    return null;
  }
}

export function suggestFare(distanceKm: number): number {
  const base = 30;
  const perKm = 12;
  const hour = new Date().getHours();
  const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const surge = isPeak ? 1.3 : 1.0;
  return Math.round((base + distanceKm * perKm) * surge);
}
