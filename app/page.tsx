"use client";

import type { Feature, FeatureCollection, Geometry } from "geojson";
import type {
  GeoJSON as LeafletGeoJSON,
  Map as LeafletMap,
  CircleMarker,
  Polyline,
} from "leaflet";
import { geoContains } from "d3-geo";
import { feature } from "topojson-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import countriesAtlas from "world-atlas/countries-110m.json";

type Place = {
  label: string;
  lat: number;
  lon: number;
};

type Artifact = {
  id: number;
  title: string;
  images: string[];
  objectName: string;
  medium: string;
  dateLabel: string;
  beginYear: number;
  endYear: number;
  place: Place;
  culture: string;
  objectURL: string;
};

type MetObject = {
  objectID: number;
  title?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  additionalImages?: string[];
  objectName?: string;
  medium?: string;
  objectDate?: string;
  objectBeginDate?: number;
  objectEndDate?: number;
  country?: string;
  city?: string;
  culture?: string;
  region?: string;
  subregion?: string;
  objectURL?: string;
  isPublicDomain?: boolean;
};

type Guess = {
  lat: number;
  lon: number;
  bucketStart: number;
};

type RoundResult = {
  artifact: Artifact;
  guess: Guess;
  distanceKm: number;
  bucketGap: number;
  correctCountry: boolean;
  guessCountry: string | null;
  answerCountry: string | null;
  placeScore: number;
  timeScore: number;
  total: number;
};

type Screen = "home" | "loading" | "game" | "complete";

const MET_API =
  "https://collectionapi.metmuseum.org/public/collection/v1";
const ROUND_COUNT = 10;
const MAX_ROUND_SCORE = 10_000;
const TIME_MIN = -4000;
const TIME_MAX = 2000;
const TIME_BUCKET_SIZE = 250;
const MAX_SELECTION_PASSES = 3;
const COUNTRY_FEATURES = feature(
  countriesAtlas as never,
  countriesAtlas.objects.countries as never,
) as unknown as FeatureCollection<Geometry, { name?: string }>;
const SEARCH_TERMS = [
  "mask",
  "vessel",
  "figure",
  "jewelry",
  "textile",
  "armor",
  "instrument",
  "ceramic",
  "sculpture",
  "manuscript",
  "bowl",
  "statuette",
  "pendant",
  "helmet",
  "tapestry",
  "reliquary",
  "amulet",
  "cup",
  "plate",
  "relief",
  "idol",
  "ritual",
  "bronze",
  "terracotta",
  "ornament",
  "tool",
] as const;

const PLACE_RULES: Array<{ terms: string[]; place: Place }> = [
  {
    terms: ["kathmandu valley", "kathmandu"],
    place: { label: "Kathmandu Valley, Nepal", lat: 27.71, lon: 85.32 },
  },
  {
    terms: ["gandhara"],
    place: { label: "Gandhara region", lat: 34.01, lon: 71.58 },
  },
  {
    terms: ["mesopotamia", "sumer", "babylon", "assyrian", "assyria"],
    place: { label: "Mesopotamia", lat: 33.31, lon: 44.37 },
  },
  {
    terms: ["constantinople", "byzantine"],
    place: { label: "Constantinople", lat: 41.01, lon: 28.97 },
  },
  {
    terms: ["etruscan", "etruria"],
    place: { label: "Central Italy", lat: 42.46, lon: 11.7 },
  },
  {
    terms: ["roman", "rome"],
    place: { label: "Rome, Italy", lat: 41.9, lon: 12.5 },
  },
  {
    terms: ["ancient greek", "greek", "athens"],
    place: { label: "Greece", lat: 37.98, lon: 23.73 },
  },
  {
    terms: ["cycladic", "cyclades"],
    place: { label: "Cyclades, Greece", lat: 37.0, lon: 25.3 },
  },
  {
    terms: ["mayan", "maya"],
    place: { label: "Maya region", lat: 17.22, lon: -89.62 },
  },
  {
    terms: ["aztec", "mexica", "tenochtitlan"],
    place: { label: "Central Mexico", lat: 19.43, lon: -99.13 },
  },
  {
    terms: ["inca", "cuzco", "cusco"],
    place: { label: "Cusco region, Peru", lat: -13.53, lon: -71.97 },
  },
  {
    terms: ["benin", "edo peoples"],
    place: { label: "Benin City, Nigeria", lat: 6.34, lon: 5.62 },
  },
  {
    terms: ["yoruba"],
    place: { label: "Yorubaland, Nigeria", lat: 7.38, lon: 3.95 },
  },
  {
    terms: ["nubia", "nubian"],
    place: { label: "Nubia", lat: 21.5, lon: 30.9 },
  },
  {
    terms: ["tibet", "tibetan", "lhasa"],
    place: { label: "Tibet", lat: 29.65, lon: 91.17 },
  },
  {
    terms: ["java", "javanese"],
    place: { label: "Java, Indonesia", lat: -7.6, lon: 110.2 },
  },
  {
    terms: ["bali", "balinese"],
    place: { label: "Bali, Indonesia", lat: -8.34, lon: 115.09 },
  },
  {
    terms: ["new guinea", "papua"],
    place: { label: "New Guinea", lat: -6.2, lon: 146.4 },
  },
  {
    terms: ["polynesia", "polynesian"],
    place: { label: "Polynesia", lat: -17.65, lon: -149.43 },
  },
  {
    terms: ["melanesia", "melanesian"],
    place: { label: "Melanesia", lat: -9.65, lon: 160.16 },
  },
  {
    terms: ["nishapur"],
    place: { label: "Nishapur, Iran", lat: 36.21, lon: 58.8 },
  },
  {
    terms: ["thebes"],
    place: { label: "Thebes, Egypt", lat: 25.72, lon: 32.65 },
  },
  {
    terms: ["alexandria"],
    place: { label: "Alexandria, Egypt", lat: 31.2, lon: 29.92 },
  },
  {
    terms: ["egypt", "egyptian"],
    place: { label: "Egypt", lat: 26.82, lon: 30.8 },
  },
  {
    terms: ["nepal", "nepalese"],
    place: { label: "Nepal", lat: 28.39, lon: 84.12 },
  },
  {
    terms: ["china", "chinese"],
    place: { label: "China", lat: 34.35, lon: 108.94 },
  },
  {
    terms: ["japan", "japanese"],
    place: { label: "Japan", lat: 35.68, lon: 139.69 },
  },
  {
    terms: ["korea", "korean"],
    place: { label: "Korea", lat: 37.57, lon: 126.98 },
  },
  {
    terms: ["india", "indian"],
    place: { label: "India", lat: 22.57, lon: 78.96 },
  },
  {
    terms: ["pakistan"],
    place: { label: "Pakistan", lat: 30.38, lon: 69.35 },
  },
  {
    terms: ["afghanistan"],
    place: { label: "Afghanistan", lat: 34.56, lon: 69.21 },
  },
  {
    terms: ["iran", "persian", "persia"],
    place: { label: "Iran", lat: 32.43, lon: 53.69 },
  },
  {
    terms: ["iraq"],
    place: { label: "Iraq", lat: 33.22, lon: 43.68 },
  },
  {
    terms: ["syria", "syrian"],
    place: { label: "Syria", lat: 34.8, lon: 38.99 },
  },
  {
    terms: ["anatolia", "turkey", "turkish"],
    place: { label: "Anatolia", lat: 39.0, lon: 35.0 },
  },
  {
    terms: ["israel", "palestine", "judea", "levant"],
    place: { label: "Southern Levant", lat: 31.77, lon: 35.21 },
  },
  {
    terms: ["yemen", "south arabia"],
    place: { label: "Yemen", lat: 15.55, lon: 48.52 },
  },
  {
    terms: ["saudi arabia", "arabian peninsula"],
    place: { label: "Arabian Peninsula", lat: 23.89, lon: 45.08 },
  },
  {
    terms: ["thailand", "siam"],
    place: { label: "Thailand", lat: 15.87, lon: 100.99 },
  },
  {
    terms: ["cambodia", "khmer"],
    place: { label: "Cambodia", lat: 12.57, lon: 104.99 },
  },
  {
    terms: ["vietnam", "vietnamese"],
    place: { label: "Vietnam", lat: 16.05, lon: 108.2 },
  },
  {
    terms: ["burma", "myanmar"],
    place: { label: "Myanmar", lat: 19.76, lon: 96.08 },
  },
  {
    terms: ["indonesia", "indonesian"],
    place: { label: "Indonesia", lat: -2.55, lon: 118.01 },
  },
  {
    terms: ["philippines", "filipino"],
    place: { label: "Philippines", lat: 12.88, lon: 121.77 },
  },
  {
    terms: ["mexico", "mexican"],
    place: { label: "Mexico", lat: 23.63, lon: -102.55 },
  },
  {
    terms: ["guatemala"],
    place: { label: "Guatemala", lat: 15.78, lon: -90.23 },
  },
  {
    terms: ["peru", "peruvian"],
    place: { label: "Peru", lat: -9.19, lon: -75.02 },
  },
  {
    terms: ["colombia", "colombian"],
    place: { label: "Colombia", lat: 4.57, lon: -74.3 },
  },
  {
    terms: ["ecuador"],
    place: { label: "Ecuador", lat: -1.83, lon: -78.18 },
  },
  {
    terms: ["bolivia"],
    place: { label: "Bolivia", lat: -16.29, lon: -63.59 },
  },
  {
    terms: ["chile", "chilean"],
    place: { label: "Chile", lat: -33.45, lon: -70.67 },
  },
  {
    terms: ["brazil", "brazilian"],
    place: { label: "Brazil", lat: -14.24, lon: -51.93 },
  },
  {
    terms: ["argentina"],
    place: { label: "Argentina", lat: -34.6, lon: -58.38 },
  },
  {
    terms: ["united states", "american"],
    place: { label: "United States", lat: 39.83, lon: -98.58 },
  },
  {
    terms: ["canada", "canadian"],
    place: { label: "Canada", lat: 56.13, lon: -106.35 },
  },
  {
    terms: ["france", "french", "gaul"],
    place: { label: "France", lat: 46.23, lon: 2.21 },
  },
  {
    terms: ["italy", "italian"],
    place: { label: "Italy", lat: 42.5, lon: 12.5 },
  },
  {
    terms: ["england", "british", "great britain"],
    place: { label: "England", lat: 52.36, lon: -1.17 },
  },
  {
    terms: ["scotland", "scottish"],
    place: { label: "Scotland", lat: 56.49, lon: -4.2 },
  },
  {
    terms: ["ireland", "irish"],
    place: { label: "Ireland", lat: 53.14, lon: -7.69 },
  },
  {
    terms: ["germany", "german"],
    place: { label: "Germany", lat: 51.17, lon: 10.45 },
  },
  {
    terms: ["netherlands", "dutch"],
    place: { label: "The Netherlands", lat: 52.13, lon: 5.29 },
  },
  {
    terms: ["spain", "spanish", "iberian"],
    place: { label: "Spain", lat: 40.46, lon: -3.75 },
  },
  {
    terms: ["portugal", "portuguese"],
    place: { label: "Portugal", lat: 39.4, lon: -8.22 },
  },
  {
    terms: ["austria", "austrian"],
    place: { label: "Austria", lat: 47.52, lon: 14.55 },
  },
  {
    terms: ["russia", "russian"],
    place: { label: "Russia", lat: 55.75, lon: 37.62 },
  },
  {
    terms: ["sweden", "swedish"],
    place: { label: "Sweden", lat: 60.13, lon: 18.64 },
  },
  {
    terms: ["norway", "norwegian"],
    place: { label: "Norway", lat: 60.47, lon: 8.47 },
  },
  {
    terms: ["denmark", "danish"],
    place: { label: "Denmark", lat: 56.26, lon: 9.5 },
  },
  {
    terms: ["nigeria", "nigerian"],
    place: { label: "Nigeria", lat: 9.08, lon: 8.68 },
  },
  {
    terms: ["ghana", "akan", "asante", "ashanti"],
    place: { label: "Ghana", lat: 7.95, lon: -1.02 },
  },
  {
    terms: ["mali", "dogon"],
    place: { label: "Mali", lat: 17.57, lon: -4.0 },
  },
  {
    terms: ["congo", "kongo"],
    place: { label: "Congo region", lat: -4.04, lon: 21.76 },
  },
  {
    terms: ["ethiopia", "ethiopian"],
    place: { label: "Ethiopia", lat: 9.15, lon: 40.49 },
  },
  {
    terms: ["sudan", "sudanese"],
    place: { label: "Sudan", lat: 15.5, lon: 32.56 },
  },
  {
    terms: ["morocco", "moroccan"],
    place: { label: "Morocco", lat: 31.79, lon: -7.09 },
  },
  {
    terms: ["tunisia", "carthage"],
    place: { label: "Tunisia", lat: 36.81, lon: 10.18 },
  },
  {
    terms: ["south africa"],
    place: { label: "South Africa", lat: -30.56, lon: 22.94 },
  },
  {
    terms: ["australia", "aboriginal australian"],
    place: { label: "Australia", lat: -25.27, lon: 133.78 },
  },
  {
    terms: ["new zealand", "maori"],
    place: { label: "New Zealand", lat: -40.9, lon: 174.89 },
  },
];

function secureShuffle<T>(values: readonly T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function resolvePlace(object: MetObject): Place | null {
  const haystack = [
    object.city,
    object.country,
    object.culture,
    object.region,
    object.subregion,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  if (!haystack) return null;
  return (
    PLACE_RULES.find((rule) =>
      rule.terms.some((term) => haystack.includes(term)),
    )?.place ?? null
  );
}

function cleanField(value?: string): string {
  return (value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtifact(object: MetObject): Artifact | null {
  const begin = Number(object.objectBeginDate);
  const end = Number(object.objectEndDate);
  const primaryImage = object.primaryImage || object.primaryImageSmall;
  const images = [...new Set(
    [primaryImage, ...(object.additionalImages || [])].filter(
      (image): image is string => Boolean(image),
    ),
  )];
  const place = resolvePlace(object);
  const title = cleanField(object.title);
  const span = Math.abs(end - begin);

  if (
    !object.isPublicDomain ||
    images.length === 0 ||
    !title ||
    !place ||
    !Number.isFinite(begin) ||
    !Number.isFinite(end) ||
    begin < -4000 ||
    end > 2026 ||
    span > 900 ||
    /^(fragment|bead|sherd|untitled)$/i.test(title)
  ) {
    return null;
  }

  return {
    id: object.objectID,
    title,
    images,
    objectName: cleanField(object.objectName) || "Object",
    medium: cleanField(object.medium) || "Medium not recorded",
    dateLabel: cleanField(object.objectDate) || formatYearRange(begin, end),
    beginYear: begin,
    endYear: end,
    place,
    culture: cleanField(object.culture) || cleanField(object.country) || place.label,
    objectURL:
      object.objectURL ||
      `https://www.metmuseum.org/art/collection/search/${object.objectID}`,
  };
}

async function fetchArtifactForTerm(
  term: string,
  seen: Set<number>,
): Promise<Artifact[]> {
  let candidates: number[];

  try {
    const searchResponse = await fetch(
      `${MET_API}/search?hasImages=true&q=${encodeURIComponent(term)}`,
    );
    if (!searchResponse.ok) return [];
    const search = (await searchResponse.json()) as {
      objectIDs?: number[];
    };
    candidates = secureShuffle(search.objectIDs || [])
      .filter((id) => !seen.has(id))
      .slice(0, 5);
  } catch {
    return [];
  }

  const objects = await Promise.all(
    candidates.map(async (id) => {
      try {
        const response = await fetch(`${MET_API}/objects/${id}`);
        return response.ok ? ((await response.json()) as MetObject) : null;
      } catch {
        return null;
      }
    }),
  );

  return objects.reduce<Artifact[]>((playable, object) => {
    const artifact = object ? normalizeArtifact(object) : null;
    if (artifact) playable.push(artifact);
    return playable;
  }, []);
}

async function loadExpedition(seen: Set<number>): Promise<Artifact[]> {
  const artifacts: Artifact[] = [];
  const usedIds = new Set<number>();
  const usedTitles = new Set<string>();
  const usedCountryTimeSlots = new Set<string>();

  for (
    let pass = 0;
    pass < MAX_SELECTION_PASSES && artifacts.length < ROUND_COUNT;
    pass += 1
  ) {
    const terms = secureShuffle(SEARCH_TERMS);

    for (
      let offset = 0;
      offset < terms.length && artifacts.length < ROUND_COUNT;
      offset += 6
    ) {
      const batch = terms.slice(offset, offset + 6);
      const found = await Promise.all(
        batch.map((term) => fetchArtifactForTerm(term, seen)),
      );

      for (const artifact of secureShuffle(found.flat())) {
        const titleKey = artifact.title.toLocaleLowerCase();
        const countryTimeSlots = countryTimeSlotsForArtifact(artifact);
        if (
          usedIds.has(artifact.id) ||
          usedTitles.has(titleKey) ||
          countryTimeSlots.some((slot) => usedCountryTimeSlots.has(slot))
        ) {
          continue;
        }

        usedIds.add(artifact.id);
        usedTitles.add(titleKey);
        countryTimeSlots.forEach((slot) => usedCountryTimeSlots.add(slot));
        seen.add(artifact.id);
        artifacts.push(artifact);
        if (artifacts.length === ROUND_COUNT) break;
      }
    }
  }

  if (artifacts.length < ROUND_COUNT) {
    throw new Error("The archive returned too few playable objects.");
  }

  return secureShuffle(artifacts).slice(0, ROUND_COUNT);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} BCE`;
  if (year === 0) return "1 CE";
  return `${year} CE`;
}

function formatYearRange(begin: number, end: number): string {
  if (begin === end) return formatYear(begin);
  return `${formatYear(begin)}–${formatYear(end)}`;
}

function bucketStartForYear(year: number): number {
  const clamped = Math.max(TIME_MIN, Math.min(TIME_MAX + TIME_BUCKET_SIZE - 1, year));
  return (
    Math.floor((clamped - TIME_MIN) / TIME_BUCKET_SIZE) * TIME_BUCKET_SIZE +
    TIME_MIN
  );
}

function formatTimeBucket(bucketStart: number): string {
  const bucketEnd = bucketStart + TIME_BUCKET_SIZE - 1;
  if (bucketEnd < 0) {
    return `${Math.abs(bucketStart)}–${Math.abs(bucketEnd)} BCE`;
  }
  return `${Math.max(1, bucketStart)}–${bucketEnd} CE`;
}

function answerBucketsForArtifact(artifact: Artifact): number[] {
  const first = bucketStartForYear(artifact.beginYear);
  const last = bucketStartForYear(artifact.endYear);
  const buckets: number[] = [];
  for (
    let bucket = first;
    bucket <= last;
    bucket += TIME_BUCKET_SIZE
  ) {
    buckets.push(bucket);
  }
  return buckets;
}

function countryAtPoint(lon: number, lat: number): string | null {
  const match = COUNTRY_FEATURES.features.find((country) =>
    geoContains(country as Feature, [lon, lat]),
  );
  return match?.properties?.name || null;
}

function countryTimeSlotsForArtifact(artifact: Artifact): string[] {
  const country =
    countryAtPoint(artifact.place.lon, artifact.place.lat) ||
    `region:${artifact.place.label}`;
  return answerBucketsForArtifact(artifact).map(
    (bucketStart) => `${country.toLocaleLowerCase()}|${bucketStart}`,
  );
}

function haversineDistance(a: Guess, b: Place): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function scoreRound(artifact: Artifact, guess: Guess): RoundResult {
  const distanceKm = haversineDistance(guess, artifact.place);
  const guessCountry = countryAtPoint(guess.lon, guess.lat);
  const answerCountry = countryAtPoint(artifact.place.lon, artifact.place.lat);
  const correctCountry = Boolean(
    guessCountry && answerCountry && guessCountry === answerCountry,
  );
  const bucketGap = Math.min(
    ...answerBucketsForArtifact(artifact).map(
      (answerBucket) =>
        Math.abs(guess.bucketStart - answerBucket) / TIME_BUCKET_SIZE,
    ),
  );
  const placeScore = correctCountry
    ? 5000
    : Math.round(5000 * Math.exp(-distanceKm / 10000));
  const timeScore = Math.round(5000 * Math.exp(-bucketGap / 5.6));
  return {
    artifact,
    guess,
    distanceKm,
    bucketGap,
    correctCountry,
    guessCountry,
    answerCountry,
    placeScore,
    timeScore,
    total: Math.min(MAX_ROUND_SCORE, placeScore + timeScore),
  };
}

function getStoredIds(): number[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("relic-atlas-seen") || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value) => Number.isInteger(value)).slice(-2800)
      : [];
  } catch {
    return [];
  }
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <div className="brand-name">Relic Atlas</div>
        {compact && <div className="brand-kicker">Field expedition</div>}
      </div>
    </div>
  );
}

function HomeScreen({
  onStart,
  stats,
}: {
  onStart: () => void;
  stats: { explored: number; best: number };
}) {
  return (
    <main className="home-shell">
      <nav className="home-nav" aria-label="Main navigation">
        <Brand />
        <a href="#how-to-play">How to play</a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">An unlimited museum guessing game</p>
          <h1>
            Place the past
            <br />
            <em>back on the map.</em>
          </h1>
          <p className="hero-lede">
            Ten objects. One world. Any time. Study each relic, then guess where
            and when it was made.
          </p>
          <button className="primary-button hero-button" onClick={onStart}>
            Begin an expedition
            <span aria-hidden="true">↗</span>
          </button>
          <p className="unlimited-note">
            No daily limit <i /> A fresh random set every game
          </p>
        </div>

        <div className="hero-cabinet" aria-label="A cabinet of museum objects">
          <div className="cabinet-grid" aria-hidden="true" />
          <article className="specimen specimen--one">
            <span className="specimen-number">01</span>
            <div className="specimen-art specimen-art--vessel">◒</div>
            <p>Where was it made?</p>
          </article>
          <article className="specimen specimen--two">
            <span className="specimen-number">02</span>
            <div className="specimen-art specimen-art--figure">♜</div>
            <p>When did it belong?</p>
          </article>
          <div className="route-thread" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="cabinet-caption">
            <span>THE MET OPEN ACCESS</span>
            <strong>Thousands of possible objects</strong>
          </div>
        </div>
      </section>

      <section className="stats-ribbon" aria-label="Your expedition statistics">
        <div>
          <span>Your archive</span>
          <strong>{formatNumber(stats.explored)}</strong>
          <small>objects explored</small>
        </div>
        <div>
          <span>Personal best</span>
          <strong>{stats.best ? formatNumber(stats.best) : "—"}</strong>
          <small>out of 100,000</small>
        </div>
        <div>
          <span>Next expedition</span>
          <strong>10</strong>
          <small>never-before-seen relics</small>
        </div>
      </section>

      <section className="how-to" id="how-to-play">
        <div className="section-label">How to play</div>
        <div className="how-grid">
          <article>
            <span>1</span>
            <h2>Observe</h2>
            <p>
              Read the material and study the object. Its name, culture, and
              date stay hidden until you guess.
            </p>
          </article>
          <article>
            <span>2</span>
            <h2>Place</h2>
            <p>
              Zoom into the bordered world map, drop one pin, and choose a
              250-year period.
            </p>
          </article>
          <article>
            <span>3</span>
            <h2>Discover</h2>
            <p>
              See the true origin, learn what you found, and build a net score
              across all ten rounds.
            </p>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        <Brand />
        <p>
          Collection data and public-domain imagery from{" "}
          <a
            href="https://www.metmuseum.org/hubs/open-access"
            target="_blank"
            rel="noreferrer"
          >
            The Metropolitan Museum of Art
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

function LoadingScreen({
  message,
  onCancel,
}: {
  message: string;
  onCancel: () => void;
}) {
  return (
    <main className="loading-screen">
      <Brand />
      <div className="loading-orbit" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="eyebrow">Preparing expedition</p>
      <h1>Opening the collection...</h1>
      <p>{message}</p>
      <button className="text-button" onClick={onCancel}>
        Return home
      </button>
    </main>
  );
}

function WorldMap({
  guess,
  answer,
  revealed,
  onGuess,
}: {
  guess: Guess | null;
  answer: Place;
  revealed: boolean;
  onGuess: (guess: Pick<Guess, "lat" | "lon">) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const borderLayerRef = useRef<LeafletGeoJSON | null>(null);
  const guessMarkerRef = useRef<CircleMarker | null>(null);
  const answerMarkerRef = useRef<CircleMarker | null>(null);
  const answerLineRef = useRef<Polyline | null>(null);
  const revealedRef = useRef(revealed);
  const onGuessRef = useRef(onGuess);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    revealedRef.current = revealed;
    onGuessRef.current = onGuess;
  }, [onGuess, revealed]);

  const renderMapState = useCallback(async () => {
    const map = leafletMapRef.current;
    if (!map) return;
    const L = await import("leaflet");

    guessMarkerRef.current?.remove();
    answerMarkerRef.current?.remove();
    answerLineRef.current?.remove();
    guessMarkerRef.current = null;
    answerMarkerRef.current = null;
    answerLineRef.current = null;

    if (guess) {
      guessMarkerRef.current = L.circleMarker([guess.lat, guess.lon], {
        radius: revealed ? 6 : 8,
        color: "#fff7e8",
        weight: 3,
        fillColor: "#7d2d28",
        fillOpacity: 1,
        className: "leaflet-guess-marker",
      })
        .addTo(map)
        .bindTooltip("Your guess", {
          direction: "top",
          offset: [0, -7],
          className: "map-tooltip",
        });
    }

    if (revealed) {
      answerMarkerRef.current = L.circleMarker([answer.lat, answer.lon], {
        radius: 8,
        color: "#fff7e8",
        weight: 3,
        fillColor: "#536b5a",
        fillOpacity: 1,
        className: "leaflet-answer-marker",
      })
        .addTo(map)
        .bindTooltip(answer.label, {
          permanent: true,
          direction: "top",
          offset: [0, -7],
          className: "map-tooltip map-tooltip--answer",
        });

      if (guess) {
        answerLineRef.current = L.polyline(
          [
            [guess.lat, guess.lon],
            [answer.lat, answer.lon],
          ],
          {
            color: "#7d2d28",
            weight: 2,
            dashArray: "6 7",
            opacity: 0.75,
          },
        ).addTo(map);
        map.fitBounds(
          L.latLngBounds(
            [guess.lat, guess.lon],
            [answer.lat, answer.lon],
          ).pad(0.42),
          { animate: true, maxZoom: 5 },
        );
      }
    }
  }, [answer, guess, revealed]);

  useEffect(() => {
    if (!containerRef.current || leafletMapRef.current) return;
    let active = true;

    void import("leaflet").then((L) => {
      if (!active || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        center: [18, 0],
        zoom: 2,
        minZoom: 1.5,
        maxZoom: 8,
        zoomSnap: 0.25,
        worldCopyJump: true,
        attributionControl: true,
      });
      leafletMapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);

      borderLayerRef.current = L.geoJSON(COUNTRY_FEATURES, {
        interactive: false,
        style: {
          color: "#4c514c",
          weight: 0.75,
          opacity: 0.62,
          fillOpacity: 0,
        },
      }).addTo(map);

      map.on(
        "click",
        (event: { latlng: { lat: number; lng: number } }) => {
          if (revealedRef.current) return;
          onGuessRef.current({
            lat: event.latlng.lat,
            lon: event.latlng.lng,
          });
        },
      );

      requestAnimationFrame(() => map.invalidateSize());
      setMapReady(true);
    });

    return () => {
      active = false;
      borderLayerRef.current = null;
      guessMarkerRef.current = null;
      answerMarkerRef.current = null;
      answerLineRef.current = null;
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    void renderMapState();
  }, [mapReady, renderMapState]);

  return (
    <div className="world-map-shell">
      <div
        className={`world-map ${revealed ? "world-map--revealed" : ""}`}
        ref={containerRef}
        role="application"
        aria-label="Zoomable world map with country borders. Click to place your guess."
      />
      {!guess && !revealed && (
        <div className="map-instruction">
          <span>⌖</span> Click to place · scroll or pinch to zoom
        </div>
      )}
      <div className="map-legend" aria-hidden="true">
        <span><i className="legend-dot legend-dot--guess" /> Guess</span>
        {revealed && <span><i className="legend-dot legend-dot--answer" /> Answer</span>}
      </div>
    </div>
  );
}

function Timeline({
  bucketStart,
  truth,
  revealed,
  onChange,
}: {
  bucketStart: number;
  truth: Artifact;
  revealed: boolean;
  onChange: (bucketStart: number) => void;
}) {
  const ticks = [-4000, -3000, -2000, -1000, 0, 1000, 2000];
  const position = ((bucketStart - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;
  const answerBuckets = answerBucketsForArtifact(truth);
  const answerBucketStart = answerBuckets[0];
  const answerBucketEnd = answerBuckets[answerBuckets.length - 1];
  const truthWidth =
    ((answerBucketEnd - answerBucketStart + TIME_BUCKET_SIZE) /
      (TIME_MAX - TIME_MIN)) *
    100;
  const truthStart = Math.min(
    100 - truthWidth,
    ((answerBucketStart - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100,
  );

  return (
    <section className="timeline-panel" aria-label="Time guess">
      <div className="timeline-heading">
        <div>
          <span className="field-label">250-year block</span>
          <strong>{formatTimeBucket(bucketStart)}</strong>
        </div>
        <p>Choose the 250-year period when you think this object was made.</p>
      </div>
      <div className="timeline-track-wrap">
        {revealed && (
          <div
            className="truth-band"
            style={{
              left: `${Math.max(0, truthStart)}%`,
              width: `${truthWidth}%`,
            }}
          >
            <span>Truth</span>
          </div>
        )}
        <div
          className={`year-readout ${revealed ? "year-readout--revealed" : ""}`}
          style={{ left: `${position}%` }}
        >
          Guess
        </div>
        <input
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={TIME_BUCKET_SIZE}
          value={bucketStart}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={revealed}
          aria-label="Estimated 250-year period"
        />
        <div className="timeline-ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${((tick + 4000) / 6000) * 100}%` }}>
              {formatYear(tick)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArtifactImagePanel({ artifact }: { artifact: Artifact }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const imageCount = artifact.images.length;

  const moveImage = useCallback(
    (direction: number) => {
      setImageIndex((current) => (current + direction + imageCount) % imageCount);
      setZoom(1);
    },
    [imageCount],
  );

  useEffect(() => {
    setImageIndex(0);
    setViewerOpen(false);
    setZoom(1);
  }, [artifact.id]);

  useEffect(() => {
    if (!viewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowLeft" && imageCount > 1) moveImage(-1);
      if (event.key === "ArrowRight" && imageCount > 1) moveImage(1);
      if (event.key === "+" || event.key === "=") {
        setZoom((current) => Math.min(4, current + 0.5));
      }
      if (event.key === "-") {
        setZoom((current) => Math.max(1, current - 0.5));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [imageCount, moveImage, viewerOpen]);

  return (
    <>
      <div className="artifact-frame">
        <button
          className="artifact-image-button"
          onClick={() => {
            setZoom(1);
            setViewerOpen(true);
          }}
          aria-label="Open a larger, zoomable view of this object"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artifact.images[imageIndex]}
            alt={`Mystery museum object${imageCount > 1 ? `, image ${imageIndex + 1} of ${imageCount}` : ""}`}
          />
        </button>
        <span className="image-tag">The Met · Open Access</span>
        <button
          className="expand-image-button"
          onClick={() => {
            setZoom(1);
            setViewerOpen(true);
          }}
          aria-label="Expand and zoom image"
        >
          <span aria-hidden="true">⛶</span> Expand
        </button>
        {imageCount > 1 && (
          <div className="image-pagination" aria-label="Object images">
            <button onClick={() => moveImage(-1)} aria-label="Previous image">
              ←
            </button>
            <span>
              {imageIndex + 1} / {imageCount}
            </span>
            <button onClick={() => moveImage(1)} aria-label="Next image">
              →
            </button>
          </div>
        )}
      </div>

      {viewerOpen && (
        <div
          className="image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Expanded view of ${artifact.title}`}
          onClick={(event) => {
            if (event.currentTarget === event.target) setViewerOpen(false);
          }}
        >
          <header className="image-viewer-header">
            <div>
              <span className="field-label">Object image</span>
              <strong>
                {imageCount > 1 ? `${imageIndex + 1} of ${imageCount}` : "Expanded view"}
              </strong>
            </div>
            <div className="image-zoom-controls" aria-label="Image zoom controls">
              <button
                onClick={() => setZoom((current) => Math.max(1, current - 0.5))}
                disabled={zoom <= 1}
                aria-label="Zoom out"
              >
                −
              </button>
              <button onClick={() => setZoom(1)} aria-label="Reset zoom">
                {zoom.toFixed(1)}×
              </button>
              <button
                onClick={() => setZoom((current) => Math.min(4, current + 0.5))}
                disabled={zoom >= 4}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                className="viewer-close"
                onClick={() => setViewerOpen(false)}
                aria-label="Close expanded image"
              >
                ×
              </button>
            </div>
          </header>
          <div className="image-viewer-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artifact.images[imageIndex]}
              alt="Expanded museum object"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
          {imageCount > 1 && (
            <div className="viewer-image-nav">
              <button onClick={() => moveImage(-1)}>← Previous image</button>
              <div className="viewer-dots" aria-hidden="true">
                {artifact.images.map((_, index) => (
                  <i key={index} className={index === imageIndex ? "is-active" : ""} />
                ))}
              </div>
              <button onClick={() => moveImage(1)}>Next image →</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ResultPanel({
  result,
  isLast,
  onNext,
}: {
  result: RoundResult;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <aside className="result-panel">
      <p className="eyebrow">Object identified</p>
      <h2>{result.artifact.title}</h2>
      <p className="result-culture">
        <em>{result.artifact.culture}</em> · {result.artifact.dateLabel}
      </p>
      <dl className="object-facts">
        <div>
          <dt>Object</dt>
          <dd>{result.artifact.objectName}</dd>
        </div>
        <div>
          <dt>Medium</dt>
          <dd>{result.artifact.medium}</dd>
        </div>
      </dl>
      <div className="score-breakdown">
        <div>
          <span>Place</span>
          <strong>
            {result.correctCountry
              ? `Correct country · ${result.answerCountry}`
              : `${formatNumber(result.distanceKm)} km`}
          </strong>
          <b>+{formatNumber(result.placeScore)}</b>
        </div>
        <div>
          <span>Time</span>
          <strong>
            {result.bucketGap === 0
              ? "Correct 250-year block"
              : `${formatNumber(result.bucketGap)} ${result.bucketGap === 1 ? "block" : "blocks"} away`}
          </strong>
          <b>+{formatNumber(result.timeScore)}</b>
        </div>
        <div className="round-total">
          <span>Round score</span>
          <strong>{formatNumber(result.total)}</strong>
          <b>/ 10,000</b>
        </div>
      </div>
      <a
        className="met-link"
        href={result.artifact.objectURL}
        target="_blank"
        rel="noreferrer"
      >
        View this object at The Met ↗
      </a>
      <button className="primary-button result-next" onClick={onNext}>
        {isLast ? "See expedition score" : "Next relic"}
        <span aria-hidden="true">→</span>
      </button>
    </aside>
  );
}

function GameScreen({
  artifacts,
  round,
  totalScore,
  results,
  onCompleteRound,
  onNext,
  onHome,
}: {
  artifacts: Artifact[];
  round: number;
  totalScore: number;
  results: RoundResult[];
  onCompleteRound: (result: RoundResult) => void;
  onNext: () => void;
  onHome: () => void;
}) {
  const artifact = artifacts[round];
  const result = results[round] || null;
  const [pin, setPin] = useState<Pick<Guess, "lat" | "lon"> | null>(null);
  const [bucketStart, setBucketStart] = useState(500);

  useEffect(() => {
    setPin(null);
    setBucketStart(500);
  }, [round]);

  const guess = pin ? { ...pin, bucketStart } : null;
  const submit = () => {
    if (!guess || result) return;
    onCompleteRound(scoreRound(artifact, guess));
  };

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="brand-button" onClick={onHome} aria-label="Return home">
          <Brand compact />
        </button>
        <div className="round-progress">
          <div>
            <span>Relic</span>
            <strong>{round + 1}</strong>
            <small>/ {ROUND_COUNT}</small>
          </div>
          <div className="progress-dots" aria-label={`${round + 1} of ${ROUND_COUNT}`}>
            {Array.from({ length: ROUND_COUNT }, (_, index) => (
              <i
                key={index}
                className={
                  index < round
                    ? "is-complete"
                    : index === round
                      ? "is-current"
                      : ""
                }
              />
            ))}
          </div>
        </div>
        <div className="header-score">
          <span>Net score</span>
          <strong>{formatNumber(totalScore)}</strong>
        </div>
      </header>

      <div className="game-stage">
        <section className="artifact-panel">
          <ArtifactImagePanel key={artifact.id} artifact={artifact} />
          {!result ? (
            <div className="clue-card">
              <span className="field-label">Material clue</span>
              <p>{artifact.medium}</p>
              <small>Identity hidden until you submit</small>
            </div>
          ) : (
            <div className="artifact-reveal-mobile">
              <p className="eyebrow">Object identified</p>
              <h2>{artifact.title}</h2>
            </div>
          )}
        </section>

        <section className="guess-panel">
          <div className="guess-heading">
            <div>
              <p className="eyebrow">
                {result ? "The reveal" : "Your field notes"}
              </p>
              <h1>
                {result
                  ? `${artifact.place.label}, ${artifact.dateLabel}`
                  : "Where—and when—does it belong?"}
              </h1>
            </div>
            {!result && (
              <p className="guess-help">
                Place a pin on the map, then choose a 250-year block below.
              </p>
            )}
          </div>
          <WorldMap
            key={artifact.id}
            guess={result?.guess || guess}
            answer={artifact.place}
            revealed={Boolean(result)}
            onGuess={(nextPin) => setPin(nextPin)}
          />
          <Timeline
            bucketStart={result?.guess.bucketStart ?? bucketStart}
            truth={artifact}
            revealed={Boolean(result)}
            onChange={setBucketStart}
          />
          {!result && (
            <div className="submit-row">
              <p>
                {pin
                  ? `${Math.abs(pin.lat).toFixed(1)}°${pin.lat >= 0 ? "N" : "S"}, ${Math.abs(pin.lon).toFixed(1)}°${pin.lon >= 0 ? "E" : "W"}`
                  : "No location selected"}
              </p>
              <button
                className="primary-button submit-button"
                disabled={!pin}
                onClick={submit}
              >
                Submit this guess <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </section>

        {result && (
          <ResultPanel
            result={result}
            isLast={round === ROUND_COUNT - 1}
            onNext={onNext}
          />
        )}
      </div>
    </main>
  );
}

function CompleteScreen({
  score,
  results,
  onAgain,
  onHome,
}: {
  score: number;
  results: RoundResult[];
  onAgain: () => void;
  onHome: () => void;
}) {
  const average = Math.round(score / ROUND_COUNT);
  const bestRound = Math.max(...results.map((result) => result.total));
  const rating =
    score >= 80000
      ? "Master Curator"
      : score >= 60000
        ? "Field Historian"
        : score >= 40000
          ? "Archive Explorer"
          : "Curious Wanderer";

  return (
    <main className="complete-screen">
      <header>
        <Brand />
        <button className="text-button" onClick={onHome}>
          Return home
        </button>
      </header>
      <section className="complete-hero">
        <p className="eyebrow">Expedition complete</p>
        <h1>{rating}</h1>
        <div className="final-score">
          <strong>{formatNumber(score)}</strong>
          <span>/ 100,000</span>
        </div>
        <p>
          Ten relics placed across the map of human history. Your archive has
          been updated, and the next set is ready whenever you are.
        </p>
        <button className="primary-button" onClick={onAgain}>
          Play another 10
          <span aria-hidden="true">↗</span>
        </button>
      </section>
      <section className="complete-stats">
        <div>
          <span>Average round</span>
          <strong>{formatNumber(average)}</strong>
        </div>
        <div>
          <span>Best round</span>
          <strong>{formatNumber(bestRound)}</strong>
        </div>
        <div>
          <span>Objects explored</span>
          <strong>{ROUND_COUNT}</strong>
        </div>
      </section>
      <section className="round-ledger">
        <div className="section-label">Expedition ledger</div>
        {results.map((result, index) => (
          <article key={result.artifact.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.artifact.images[0]} alt="" />
            <div>
              <strong>{result.artifact.title}</strong>
              <small>
                {result.artifact.place.label} · {result.artifact.dateLabel}
              </small>
            </div>
            <b>{formatNumber(result.total)}</b>
          </article>
        ))}
      </section>
    </main>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [loadingMessage, setLoadingMessage] = useState(
    "Selecting ten objects you have not seen before.",
  );
  const [stats, setStats] = useState({ explored: 0, best: 0 });
  const loadingRun = useRef(0);

  useEffect(() => {
    const explored = getStoredIds().length;
    const best = Number(localStorage.getItem("relic-atlas-best") || 0);
    setStats({ explored, best: Number.isFinite(best) ? best : 0 });
  }, []);

  const totalScore = useMemo(
    () => results.reduce((sum, result) => sum + result.total, 0),
    [results],
  );

  const startGame = useCallback(async () => {
    const runId = loadingRun.current + 1;
    loadingRun.current = runId;
    setScreen("loading");
    setLoadingMessage("Selecting ten objects you have not seen before.");
    setResults([]);
    setRound(0);

    try {
      let storedIds = getStoredIds();
      let expedition: Artifact[];
      try {
        expedition = await loadExpedition(new Set(storedIds));
      } catch {
        setLoadingMessage("Searching a deeper shelf in the collection...");
        storedIds = storedIds.slice(-1200);
        expedition = await loadExpedition(new Set(storedIds));
      }
      if (loadingRun.current !== runId) return;
      setArtifacts(expedition);
      setScreen("game");
    } catch {
      if (loadingRun.current !== runId) return;
      setLoadingMessage(
        "The museum archive is taking longer than usual. Please try again in a moment.",
      );
    }
  }, []);

  const cancelLoading = () => {
    loadingRun.current += 1;
    setScreen("home");
  };

  const completeRound = (result: RoundResult) => {
    setResults((current) => [...current, result]);
  };

  const nextRound = () => {
    if (round < ROUND_COUNT - 1) {
      setRound((current) => current + 1);
      return;
    }

    const score = totalScore;
    const ids = [...getStoredIds(), ...artifacts.map((artifact) => artifact.id)];
    const uniqueIds = [...new Set(ids)].slice(-2800);
    localStorage.setItem("relic-atlas-seen", JSON.stringify(uniqueIds));
    const best = Math.max(stats.best, score);
    localStorage.setItem("relic-atlas-best", String(best));
    setStats({ explored: uniqueIds.length, best });
    setScreen("complete");
  };

  if (screen === "loading") {
    return <LoadingScreen message={loadingMessage} onCancel={cancelLoading} />;
  }

  if (screen === "game" && artifacts.length === ROUND_COUNT) {
    return (
      <GameScreen
        artifacts={artifacts}
        round={round}
        totalScore={totalScore}
        results={results}
        onCompleteRound={completeRound}
        onNext={nextRound}
        onHome={() => setScreen("home")}
      />
    );
  }

  if (screen === "complete") {
    return (
      <CompleteScreen
        score={totalScore}
        results={results}
        onAgain={startGame}
        onHome={() => setScreen("home")}
      />
    );
  }

  return <HomeScreen onStart={startGame} stats={stats} />;
}
