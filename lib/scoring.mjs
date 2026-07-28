export const MAX_LOCATION_SCORE = 5000;
export const MAX_TIME_SCORE = 5000;
export const DISTANCE_DECAY_KM = 2000;
export const TIME_DECAY_YEARS = 1000;

export function locationScore(distanceKm) {
  const distance = Math.max(0, distanceKm);
  return Math.round(
    MAX_LOCATION_SCORE * Math.exp(-distance / DISTANCE_DECAY_KM),
  );
}

export function yearErrorForRange(
  guessStart,
  artifactBegin,
  artifactEnd,
  bucketSize = 250,
) {
  const guessEnd = guessStart + bucketSize;
  const rangeStart = Math.min(artifactBegin, artifactEnd);
  const rangeEnd = Math.max(artifactBegin, artifactEnd);

  if (guessEnd >= rangeStart && guessStart <= rangeEnd) return 0;
  return guessEnd < rangeStart
    ? rangeStart - guessEnd
    : guessStart - rangeEnd;
}

export function timeScore(yearError) {
  const error = Math.max(0, yearError);
  return Math.round(MAX_TIME_SCORE * Math.exp(-error / TIME_DECAY_YEARS));
}
