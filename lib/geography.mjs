import { geoArea, geoContains } from "d3-geo";

const EARTH_RADIUS_KM = 6371.0088;
const ARC_TOLERANCE = 1e-7;
export const COUNTRY_REGION_GAP_KM = 1000;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toUnitVector([lon, lat]) {
  const longitude = (lon * Math.PI) / 180;
  const latitude = (lat * Math.PI) / 180;
  const latitudeScale = Math.cos(latitude);
  return [
    latitudeScale * Math.cos(longitude),
    latitudeScale * Math.sin(longitude),
    Math.sin(latitude),
  ];
}

function toCoordinate([x, y, z]) {
  return [
    (Math.atan2(y, x) * 180) / Math.PI,
    (Math.asin(clamp(z, -1, 1)) * 180) / Math.PI,
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function magnitude(vector) {
  return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
  const length = magnitude(vector);
  return length > 0
    ? vector.map((component) => component / length)
    : null;
}

function angularDistance(a, b) {
  return Math.acos(clamp(dot(a, b), -1, 1));
}

function closestPointOnArc(point, start, end) {
  const startDistance = angularDistance(point, start);
  const endDistance = angularDistance(point, end);
  let closest =
    startDistance <= endDistance
      ? { vector: start, angle: startDistance }
      : { vector: end, angle: endDistance };

  const normal = cross(start, end);
  const normalSquared = dot(normal, normal);
  if (normalSquared < 1e-20) return closest;

  const normalProjection = dot(point, normal) / normalSquared;
  const projection = normalize([
    point[0] - normal[0] * normalProjection,
    point[1] - normal[1] * normalProjection,
    point[2] - normal[2] * normalProjection,
  ]);
  if (!projection) return closest;

  const projected =
    dot(point, projection) >= 0
      ? projection
      : projection.map((component) => -component);
  const arcLength = angularDistance(start, end);
  const startToProjection = angularDistance(start, projected);
  const projectionToEnd = angularDistance(projected, end);
  const liesOnArc =
    startToProjection <= arcLength + ARC_TOLERANCE &&
    projectionToEnd <= arcLength + ARC_TOLERANCE &&
    Math.abs(startToProjection + projectionToEnd - arcLength) <= ARC_TOLERANCE;

  if (liesOnArc) {
    const projectedDistance = angularDistance(point, projected);
    if (projectedDistance < closest.angle) {
      closest = { vector: projected, angle: projectedDistance };
    }
  }

  return closest;
}

function boundaryRings(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function nearestPointOnFeatureBorder(point, feature) {
  const pointVector = toUnitVector(point);
  let closest = null;

  for (const ring of boundaryRings(feature)) {
    if (ring.length < 2) continue;
    const finalPoint = ring.at(-1);
    const isClosed =
      ring[0][0] === finalPoint[0] && ring[0][1] === finalPoint[1];
    const segmentCount = isClosed ? ring.length - 1 : ring.length;

    for (let index = 0; index < segmentCount; index += 1) {
      const nextIndex = (index + 1) % ring.length;
      const candidate = closestPointOnArc(
        pointVector,
        toUnitVector(ring[index]),
        toUnitVector(ring[nextIndex]),
      );
      if (!closest || candidate.angle < closest.angle) closest = candidate;
    }
  }

  if (!closest) return null;
  return {
    distanceKm: closest.angle * EARTH_RADIUS_KM,
    point: toCoordinate(closest.vector),
  };
}

export function distanceToFeatureBorderKm(point, feature) {
  return nearestPointOnFeatureBorder(point, feature)?.distanceKm ?? Infinity;
}

export function distanceBetweenFeatureBordersKm(first, second) {
  let closest = Infinity;
  for (const feature of [first, second]) {
    const other = feature === first ? second : first;
    for (const ring of boundaryRings(feature)) {
      for (const coordinate of ring) {
        closest = Math.min(
          closest,
          distanceToFeatureBorderKm(coordinate, other),
        );
      }
    }
  }
  return closest;
}

export function featureRegionContainingPoint(
  point,
  feature,
  maximumGapKm = COUNTRY_REGION_GAP_KM,
) {
  if (feature?.geometry?.type !== "MultiPolygon") return feature;

  const parts = feature.geometry.coordinates.map((coordinates) => ({
    ...feature,
    geometry: { type: "Polygon", coordinates },
  }));
  let anchorIndex = parts.findIndex((part) => geoContains(part, point));
  if (anchorIndex < 0) {
    anchorIndex = parts.reduce(
      (largest, part, index) =>
        geoArea(part) > geoArea(parts[largest]) ? index : largest,
      0,
    );
  }

  const included = new Set([anchorIndex]);
  const pending = [anchorIndex];
  while (pending.length > 0) {
    const current = pending.shift();
    for (let index = 0; index < parts.length; index += 1) {
      if (included.has(index)) continue;
      if (
        distanceBetweenFeatureBordersKm(parts[current], parts[index]) <=
        maximumGapKm
      ) {
        included.add(index);
        pending.push(index);
      }
    }
  }

  const coordinates = [...included].map(
    (index) => feature.geometry.coordinates[index],
  );
  return {
    ...feature,
    geometry:
      coordinates.length === 1
        ? { type: "Polygon", coordinates: coordinates[0] }
        : { type: "MultiPolygon", coordinates },
  };
}

export function greatCircleDistanceKm(first, second) {
  return (
    angularDistance(toUnitVector(first), toUnitVector(second)) *
    EARTH_RADIUS_KM
  );
}
