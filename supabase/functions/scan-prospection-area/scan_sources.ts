export type AreaConfig = {
  department_codes?: string[];
  geometry?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  mairie_sources?: MairieSource[];
  population_max?: number;
  commerce_max?: number;
  max_candidates?: number;
};

type MairieSource = 'api-lannuaire' | 'etablissements-publics';

type MairieContact = {
  email: string | null;
  phone: string | null;
  openingHours: string | null;
  website: string | null;
  source: string;
};

export type GeoCommune = {
  nom: string;
  code: string;
  departement?: string;
  codesPostaux?: string[];
  population?: number;
  areaMatched?: boolean;
  centre?: {
    type: 'Point';
    coordinates: [number, number];
  };
};

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const FETCH_TIMEOUT_MS = 10_000;

export async function loadCommunes(areaType: string, config: AreaConfig): Promise<GeoCommune[]> {
  try {
    if (areaType === 'departments') {
      return await loadCommunesFromGeoDepartments(config.department_codes);
    }

    if (areaType === 'polygon') {
      const communes = await loadCommunesFromGeoDepartments(inferDepartmentsFromPolygon(config));

      try {
        const overpassCommunes = await loadCommunesFromOverpassPolygon(config);
        return mergeCommunes([...communes, ...overpassCommunes]);
      } catch (err) {
        console.warn('Overpass polygon enrichment unavailable, using Geo API only:', err);
        return communes;
      }
    }

    const url = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,population,centre&format=json';
    return await fetchJson<GeoCommune[]>(url, 'geo.api.gouv.fr communes');
  } catch (err) {
    console.warn('geo.api.gouv.fr unavailable, using fallback source:', err);
    if (areaType === 'polygon') return await loadCommunesFromPolygonFallback(config);
    return await loadCommunesFromEtalab(config);
  }
}

async function loadCommunesFromGeoDepartments(departmentCodes?: string[]): Promise<GeoCommune[]> {
  const departments = departmentCodes?.length ? departmentCodes : ['22', '35', '56'];
  const batches = await Promise.all(departments.map(async (department) => {
    const url = `https://geo.api.gouv.fr/departements/${department}/communes?fields=nom,code,codesPostaux,population,centre&format=json`;
    return await fetchJson<GeoCommune[]>(url, `geo.api.gouv.fr ${department}`);
  }));
  return batches.flat();
}

export async function loadCommunesFromEtalab(config: AreaConfig): Promise<GeoCommune[]> {
  const departments = new Set(config.department_codes?.length ? config.department_codes : ['22', '35', '56']);
  const url = 'https://unpkg.com/@etalab/decoupage-administratif@6.0.0/data/communes.json';
  const communes = await fetchJson<Array<Record<string, unknown>>>(url, 'Etalab communes');
  return communes
    .filter((commune) => commune.type === 'commune-actuelle')
    .filter((commune) => departments.has(String(commune.departement || '').padStart(2, '0')))
    .map(normalizeEtalabCommune);
}

export async function loadCommunesFromPolygonFallback(config: AreaConfig): Promise<GeoCommune[]> {
  try {
    return await loadCommunesFromOverpassPolygon(config);
  } catch (err) {
    console.warn('Overpass polygon communes unavailable, using department fallback:', err);
    return await loadCommunesFromEtalab({
      ...config,
      department_codes: inferDepartmentsFromPolygon(config),
    });
  }
}

export async function loadCommunesFromOverpassPolygon(config: AreaConfig): Promise<GeoCommune[]> {
  const polygon = config.geometry?.coordinates?.[0];
  if (!polygon?.length) return [];

  const etalabCommunes = await loadCommunesFromEtalab({
    department_codes: inferDepartmentsFromPolygon(config),
  });
  const etalabByCode = new Map(etalabCommunes.map((commune) => [commune.code, commune]));
  const overpassPoly = polygon
    .map(([lng, lat]) => `${lat} ${lng}`)
    .join(' ');
  const query = `
    [out:json][timeout:60];
    (
      relation(poly:"${overpassPoly}")["boundary"="administrative"]["admin_level"="8"]["ref:INSEE"];
    );
    out tags center qt;
  `;

  const data = await fetchOverpass(query, 'Overpass polygon communes');
  return (data.elements || [])
    .map((element: { tags?: Record<string, string>; center?: { lat: number; lon: number } }) => {
      const code = element.tags?.['ref:INSEE'];
      if (!code) return null;
      const base = etalabByCode.get(code);
      return {
        nom: base?.nom || element.tags?.name || code,
        code,
        departement: base?.departement || code.slice(0, 2),
        codesPostaux: base?.codesPostaux || [],
        population: base?.population,
        centre: element.center
          ? { type: 'Point' as const, coordinates: [element.center.lon, element.center.lat] as [number, number] }
          : base?.centre,
        areaMatched: true,
      };
    })
    .filter((commune: GeoCommune | null): commune is GeoCommune => Boolean(commune));
}

export function isCommuneInArea(commune: GeoCommune, areaType: string, config: AreaConfig): boolean {
  if (areaType !== 'polygon') return true;
  if (commune.areaMatched) return true;
  const center = commune.centre?.coordinates;
  const polygon = config.geometry?.coordinates?.[0];
  if (!center || !polygon?.length) return false;
  return pointInPolygon(center, polygon);
}

export function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export async function countCommuneCommerces(inseeCode: string): Promise<number> {
  const query = `
    [out:json][timeout:25];
    area["boundary"="administrative"]["ref:INSEE"="${inseeCode}"]->.searchArea;
    (
      nwr["shop"](area.searchArea);
      nwr["amenity"~"^(restaurant|fast_food|bar|cafe|pub)$"](area.searchArea);
      nwr["craft"="bakery"](area.searchArea);
    );
    out ids;
  `;

  const data = await fetchOverpass(query, `Overpass ${inseeCode}`);
  const ids = new Set((data.elements || []).map((element: { type: string; id: number }) => `${element.type}/${element.id}`));
  return ids.size;
}

async function fetchOverpass(query: string, label: string) {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json',
          'User-Agent': 'chez-armand-prospection/1.0',
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text();
        errors.push(`${endpoint}: ${response.status} ${detail.slice(0, 180)}`);
        continue;
      }
      return await response.json();
    } catch (err) {
      errors.push(`${endpoint}: ${formatFetchError(err)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error(`${label}: ${errors.join(' | ')}`);
}

export async function loadMairieContact(
  inseeCode: string,
  requestedSources: unknown = ['api-lannuaire', 'etablissements-publics'],
): Promise<MairieContact> {
  const empty = {
    email: null as string | null,
    phone: null as string | null,
    openingHours: null as string | null,
    website: null as string | null,
    source: 'api-lannuaire.service-public.gouv.fr',
  };

  const sources = normalizeMairieSources(requestedSources);
  const contacts = await Promise.all(sources.map((source) => loadMairieContactFromSource(source, inseeCode)));
  const merged = contacts.reduce<MairieContact>((acc, contact) => ({
    email: acc.email || contact.email,
    phone: acc.phone || contact.phone,
    openingHours: acc.openingHours || contact.openingHours,
    website: acc.website || contact.website,
    source: acc.source,
  }), { ...empty, source: '' });
  const sourcesWithData = contacts.filter(hasMairieContact).map((contact) => contact.source);

  return {
    ...merged,
    source: sourcesWithData.length
      ? sourcesWithData.join(' + ')
      : sources.map(formatMairieSource).join(' + '),
  };
}

async function loadMairieContactFromSource(source: MairieSource, inseeCode: string): Promise<MairieContact> {
  if (source === 'etablissements-publics') return await loadMairieContactFromEtablissementsPublics(inseeCode);
  return await loadMairieContactFromAnnuaire(inseeCode);
}

async function loadMairieContactFromAnnuaire(inseeCode: string): Promise<MairieContact> {
  const empty = {
    email: null as string | null,
    phone: null as string | null,
    openingHours: null as string | null,
    website: null as string | null,
    source: 'api-lannuaire.service-public.gouv.fr',
  };

  try {
    const params = new URLSearchParams({
      where: `pivot like "%mairie%${inseeCode}%"`,
      limit: '1',
    });
    const response = await fetchWithTimeout(`https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      const properties = data.results?.[0];
      if (properties) {
        return {
          email: firstString(properties, ['adresse_courriel', 'email', 'courriel']),
          phone: firstStructuredValue(properties.telephone),
          openingHours: formatOpeningHours(properties.plage_ouverture),
          website: firstStructuredValue(properties.site_internet),
          source: 'api-lannuaire.service-public.gouv.fr',
        };
      }
    }
  } catch (err) {
    console.warn('api-lannuaire mairie lookup failed:', err);
  }

  return empty;
}

async function loadMairieContactFromEtablissementsPublics(inseeCode: string): Promise<MairieContact> {
  const empty = {
    email: null as string | null,
    phone: null as string | null,
    openingHours: null as string | null,
    website: null as string | null,
    source: 'etablissements-publics.api.gouv.fr',
  };

  try {
    const response = await fetchWithTimeout(`https://etablissements-publics.api.gouv.fr/v3/communes/${inseeCode}/mairie`);
    if (!response.ok) return empty;

    const data = await response.json();
    const record = Array.isArray(data) ? data[0] : data;
    if (!record || typeof record !== 'object') return empty;

    return {
      email: findEmail(record),
      phone: findPhone(record),
      openingHours: formatOpeningHours(firstDeepValue(record, [
        'plage_ouverture',
        'plages_ouverture',
        'horaires',
        'ouverture',
      ])),
      website: findWebsite(record),
      source: 'etablissements-publics.api.gouv.fr',
    };
  } catch (err) {
    console.warn('etablissements-publics mairie lookup failed:', err);
    return empty;
  }
}

function normalizeMairieSources(value: unknown): MairieSource[] {
  const allowed = new Set<MairieSource>(['api-lannuaire', 'etablissements-publics']);
  const requested = Array.isArray(value) ? value.map(String) : [];
  const normalized = requested.filter((source): source is MairieSource => allowed.has(source as MairieSource));
  return normalized.length ? [...new Set(normalized)] : ['api-lannuaire', 'etablissements-publics'];
}

function formatMairieSource(source: MairieSource) {
  return source === 'etablissements-publics'
    ? 'etablissements-publics.api.gouv.fr'
    : 'api-lannuaire.service-public.gouv.fr';
}

function hasMairieContact(contact: MairieContact) {
  return Boolean(contact.email || contact.phone || contact.openingHours || contact.website);
}

export function inferDepartmentsFromPolygon(config: AreaConfig): string[] {
  const polygon = config.geometry?.coordinates?.[0] || [];
  if (polygon.length === 0) return ['22', '35', '56'];

  const lngs = polygon.map(([lng]) => lng);
  const lats = polygon.map(([, lat]) => lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const departmentBoxes = [
    { code: '22', minLat: 48.0, maxLat: 49.1, minLng: -3.9, maxLng: -1.8 },
    { code: '35', minLat: 47.5, maxLat: 49.0, minLng: -2.4, maxLng: -1.0 },
    { code: '56', minLat: 47.2, maxLat: 48.4, minLng: -3.9, maxLng: -2.0 },
  ];

  const matches = departmentBoxes
    .filter((box) => boxesIntersect({ minLat, maxLat, minLng, maxLng }, box))
    .map((box) => box.code);

  return matches.length ? matches : ['22', '35', '56'];
}

function normalizeEtalabCommune(commune: Record<string, unknown>): GeoCommune {
  const code = String(commune.code || '');
  const departement = String(commune.departement || code.slice(0, 2)).padStart(2, '0');
  return {
    nom: String(commune.nom || code),
    code,
    departement,
    codesPostaux: Array.isArray(commune.codesPostaux) ? commune.codesPostaux.map(String) : [],
    population: typeof commune.population === 'number' ? commune.population : Number(commune.population) || undefined,
  };
}

function mergeCommunes(communes: GeoCommune[]) {
  const byCode = new Map<string, GeoCommune>();
  for (const commune of communes) {
    const existing = byCode.get(commune.code);
    if (!existing) {
      byCode.set(commune.code, commune);
      continue;
    }

    byCode.set(commune.code, {
      ...commune,
      ...existing,
      departement: existing.departement || commune.departement,
      codesPostaux: existing.codesPostaux?.length ? existing.codesPostaux : commune.codesPostaux,
      population: existing.population ?? commune.population,
      centre: existing.centre || commune.centre,
      areaMatched: Boolean(existing.areaMatched || commune.areaMatched),
    });
  }
  return [...byCode.values()];
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`${label}: ${response.status}`);
  return await response.json() as T;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'chez-armand-prospection/1.0',
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatFetchError(err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') return `timeout after ${FETCH_TIMEOUT_MS}ms`;
  if (err instanceof Error) return err.message;
  return String(err);
}

function firstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) return value[0].trim();
  }
  return null;
}

function formatOpeningHours(value: unknown) {
  if (!value) return null;
  const parsed = parseMaybeJson(value);
  if (parsed !== value) return formatOpeningHours(parsed);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) return formatOpeningRange(item as Record<string, unknown>);
      return String(item);
    }).join('\n');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function firstStructuredValue(value: unknown) {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (typeof item === 'object' && item !== null) {
        const candidate = firstString(item as Record<string, unknown>, ['valeur', 'url', 'libelle']);
        if (candidate) return candidate;
      }
    }
  }
  if (typeof parsed === 'object' && parsed !== null) {
    return firstString(parsed as Record<string, unknown>, ['valeur', 'url', 'libelle']);
  }
  return null;
}

function firstDeepValue(source: unknown, keys: string[], depth = 0): unknown {
  if (!source || depth > 5) return null;
  const parsed = parseMaybeJson(source);
  if (!parsed || typeof parsed !== 'object') return null;

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const match = firstDeepValue(item, keys, depth + 1);
      if (match) return match;
    }
    return null;
  }

  const record = parsed as Record<string, unknown>;
  for (const key of keys) {
    if (record[key]) return record[key];
  }
  for (const value of Object.values(record)) {
    const match = firstDeepValue(value, keys, depth + 1);
    if (match) return match;
  }
  return null;
}

function findEmail(source: unknown) {
  const direct = firstStructuredValue(firstDeepValue(source, [
    'adresse_courriel',
    'email',
    'courriel',
    'mail',
  ]));
  if (direct && direct.includes('@')) return direct;
  return findMatchingString(source, (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function findPhone(source: unknown) {
  const direct = firstStructuredValue(firstDeepValue(source, [
    'telephone',
    'telephones',
    'tel',
    'phone',
  ]));
  if (direct) return direct;
  return findMatchingString(source, (value) => value.replace(/\D/g, '').length >= 9);
}

function findWebsite(source: unknown) {
  const direct = firstStructuredValue(firstDeepValue(source, [
    'site_internet',
    'site',
    'url',
    'urls',
    'website',
  ]));
  if (direct) return direct;
  return findMatchingString(source, (value) => /^https?:\/\//.test(value));
}

function findMatchingString(source: unknown, predicate: (value: string) => boolean, depth = 0): string | null {
  if (!source || depth > 5) return null;
  const parsed = parseMaybeJson(source);
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return predicate(trimmed) ? trimmed : null;
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const match = findMatchingString(item, predicate, depth + 1);
      if (match) return match;
    }
    return null;
  }
  if (typeof parsed === 'object' && parsed !== null) {
    for (const value of Object.values(parsed)) {
      const match = findMatchingString(value, predicate, depth + 1);
      if (match) return match;
    }
  }
  return null;
}

function parseMaybeJson(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatOpeningRange(item: Record<string, unknown>) {
  const startDay = String(item.nom_jour_debut || '').trim();
  const endDay = String(item.nom_jour_fin || '').trim();
  const day = startDay && endDay && startDay !== endDay ? `${startDay}-${endDay}` : startDay || endDay;
  const start1 = formatHour(item.valeur_heure_debut_1);
  const end1 = formatHour(item.valeur_heure_fin_1);
  const start2 = formatHour(item.valeur_heure_debut_2);
  const end2 = formatHour(item.valeur_heure_fin_2);
  const ranges = [
    start1 && end1 ? `${start1}-${end1}` : null,
    start2 && end2 ? `${start2}-${end2}` : null,
  ].filter(Boolean).join(', ');
  const comment = String(item.commentaire || '').trim();
  return [day, ranges, comment].filter(Boolean).join(' ');
}

function formatHour(value: unknown) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/:00$/, '').replace(':', 'h');
}

function boxesIntersect(
  a: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  b: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  return a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat &&
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng;
}
