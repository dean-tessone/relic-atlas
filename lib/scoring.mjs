export const MAX_LOCATION_SCORE = 5000;
export const MAX_TIME_SCORE = 5000;
export const DISTANCE_DECAY_KM = 5500;
export const TIME_DECAY_BUCKETS = 4;

export function locationScore(distanceKm, correctCountry) {
  if (correctCountry) return MAX_LOCATION_SCORE;
  const distance = Math.max(0, distanceKm);
  return Math.round(
    MAX_LOCATION_SCORE * Math.exp(-distance / DISTANCE_DECAY_KM),
  );
}

export function timeScore(bucketGap) {
  const gap = Math.max(0, bucketGap);
  return Math.round(MAX_TIME_SCORE * Math.exp(-gap / TIME_DECAY_BUCKETS));
}
