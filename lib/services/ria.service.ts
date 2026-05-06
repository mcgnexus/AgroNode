const RIA_BASE_URL = process.env.RIA_BASE_URL ?? "https://www.juntadeandalucia.es/agriculturaypesca/ifapa/riaws";
const RIA_TOKEN = process.env.RIA_TOKEN ?? "";
const RIA_AUTH_MODE = (process.env.RIA_AUTH_MODE ?? "query").toLowerCase();
const REQUEST_TIMEOUT_MS = 20_000;

const RIA_STATIONS_CACHE = new Map<string, { data: RiaStation[]; expiresAt: number }>();
const RIA_DAILY_CACHE = new Map<string, { data: RiaDailyData[]; expiresAt: number }>();
const STATIONS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DAILY_CACHE_TTL_MS = 60 * 60 * 1000;

export interface RiaStation {
  id: string;
  codigo: string;
  nombre: string;
  provincia: string;
  idProvincia: string;
  municipio: string;
  latitud: number;
  longitud: number;
  altitud: number;
  hasData: boolean;
}

export interface RiaDailyData {
  stationId: string;
  stationName: string;
  date: string;
  maxTemp: number | null;
  minTemp: number | null;
  avgTemp: number | null;
  maxHumidity: number | null;
  minHumidity: number | null;
  avgHumidity: number | null;
  precipitation: number | null;
  effectivePrecipitation: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  solarRadiation: number | null;
  et0: number | null;
}

export interface RiaHourlyData {
  stationId: string;
  stationName: string;
  date: string;
  hour: number;
  temperature: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  solarRadiation: number | null;
  leafWetness: number | null;
  soilTemperature: number | null;
  soilHumidity: number | null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseCoord(raw: unknown): number {
  if (typeof raw !== "string" || raw.length < 9) return 0;
  const dir = raw.slice(-1).toUpperCase();
  const num = raw.slice(0, -1);
  const deg = Number(num.slice(0, 2));
  const min = Number(num.slice(2, 4));
  const sec = Number(num.slice(4, 6));
  const mil = Number(num.slice(6, 9));
  if ([deg, min, sec, mil].some((n) => Number.isNaN(n))) return 0;
  let decimal = deg + min / 60 + (sec + mil / 1000) / 3600;
  if (dir === "S" || dir === "W") decimal = -decimal;
  return decimal;
}

function toRiaDateTimePath(dateStr: string): string {
  const isoDate = toIsoDate(dateStr);
  const value = `${isoDate}T00:00:00.000Z`;
  return encodeURIComponent(value);
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
}

function toIsoDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const v = value.includes("T") ? value.split("T")[0] : value;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return v;
  return date.toISOString().split("T")[0];
}

function withToken(url: URL, useQueryToken: boolean): void {
  if (useQueryToken && RIA_TOKEN.trim()) {
    url.searchParams.set("token", RIA_TOKEN.trim());
  }
}

async function fetchRiaJson(
  pathname: string,
  params: Record<string, string> = {},
  mode: "query" | "bearer"
): Promise<unknown> {
  const base = RIA_BASE_URL.endsWith("/") ? RIA_BASE_URL : `${RIA_BASE_URL}/`;
  const safePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const url = new URL(`${base}${safePath}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (mode === "query") withToken(url, true);
  if (mode === "bearer" && RIA_TOKEN.trim()) headers.Authorization = `Bearer ${RIA_TOKEN.trim()}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`RIA API error ${response.status}: ${raw.substring(0, 220)}`);
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`RIA API invalid JSON: ${raw.substring(0, 300)}`);
  }
}

async function riaFetch(pathname: string, params: Record<string, string> = {}): Promise<unknown> {
  const mode = RIA_AUTH_MODE === "bearer" || RIA_AUTH_MODE === "both" ? RIA_AUTH_MODE : "query";

  if (!RIA_TOKEN.trim()) {
    console.warn("RIA_TOKEN no configurado. Intentando petición sin token.");
    return fetchRiaJson(pathname, params, "query");
  }

  if (mode === "query") return fetchRiaJson(pathname, params, "query");
  if (mode === "bearer") return fetchRiaJson(pathname, params, "bearer");

  try {
    return await fetchRiaJson(pathname, params, "query");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isAuthError = msg.includes("401") || msg.includes("403");
    if (!isAuthError) throw error;
    return fetchRiaJson(pathname, params, "bearer");
  }
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const buckets = ["datos", "data", "result", "results", "estaciones", "historico", "ultimosdatos"];
  for (const key of buckets) {
    if (Array.isArray(obj[key])) {
      return obj[key].filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
    }
  }
  return [];
}

function mapStation(row: Record<string, unknown>): RiaStation | null {
  const codigoRaw = pickFirst(row, ["codigo", "Codigo", "id", "Id", "codEstacion", "codigoEstacion"]);
  const codigo = String(codigoRaw ?? "").trim();
  if (!codigo) return null;

  const provinciaObj = pickFirst(row, ["provincia", "Provincia"]);
  const provinciaRecord =
    provinciaObj && typeof provinciaObj === "object" ? (provinciaObj as Record<string, unknown>) : null;

  const provinciaIdFromObj = provinciaRecord ? pickFirst(provinciaRecord, ["id", "Id", "codigo", "Codigo"]) : null;
  const provinciaNameFromObj = provinciaRecord ? pickFirst(provinciaRecord, ["nombre", "Nombre"]) : null;
  const provinceRaw = pickFirst(row, ["idProvincia", "IdProvincia", "codProvincia"]);
  const idProvincia = String(provinciaIdFromObj ?? provinceRaw ?? codigo.slice(0, 2)).trim().toUpperCase();
  const provinciaNombre = String(
    provinciaNameFromObj ?? pickFirst(row, ["nombreProvincia", "ProvinciaNombre", "provinciaNombre"]) ?? idProvincia
  ).trim();

  return {
    id: codigo,
    codigo,
    nombre: String(pickFirst(row, ["nombre", "Nombre", "estacion", "Estacion"]) ?? codigo).trim(),
    provincia: provinciaNombre,
    idProvincia,
    municipio: String(pickFirst(row, ["municipio", "Municipio", "termino", "Termino"]) ?? "").trim(),
    latitud:
      parseNumber(pickFirst(row, ["latitudDecimal", "LatitudDecimal", "latitude", "Latitude"])) ??
      parseCoord(pickFirst(row, ["latitud", "Latitud"])),
    longitud:
      parseNumber(pickFirst(row, ["longitudDecimal", "LongitudDecimal", "longitude", "Longitude"])) ??
      parseCoord(pickFirst(row, ["longitud", "Longitud"])),
    altitud: parseNumber(pickFirst(row, ["altitud", "Altitud", "elevacion", "Elevacion"])) ?? 0,
    hasData: true,
  };
}

function mapDailyRow(row: Record<string, unknown>, stationId: string): RiaDailyData {
  return {
    stationId,
    stationName: String(pickFirst(row, ["estacion", "Estacion", "nombreEstacion", "NombreEstacion"]) ?? stationId),
    date: toIsoDate(pickFirst(row, ["fecha", "Fecha", "date", "Date"])),
    maxTemp: parseNumber(pickFirst(row, ["tempMax", "TempMax", "tmax", "TMax"])),
    minTemp: parseNumber(pickFirst(row, ["tempMin", "TempMin", "tmin", "TMin"])),
    avgTemp: parseNumber(pickFirst(row, ["tempMedia", "TempMedia", "tmed", "TMed", "temperaturaMedia"])),
    maxHumidity: parseNumber(pickFirst(row, ["humedadMax", "HumedadMax", "humMax", "HumMax"])),
    minHumidity: parseNumber(pickFirst(row, ["humedadMin", "HumedadMin", "humMin", "HumMin"])),
    avgHumidity: parseNumber(pickFirst(row, ["humedadMedia", "HumedadMedia", "humMedia", "HumMedia"])),
    precipitation: parseNumber(pickFirst(row, ["precipitacion", "Precipitacion", "lluvia", "Lluvia"])),
    effectivePrecipitation: parseNumber(pickFirst(row, ["precipitacionEfectiva", "PrecipitacionEfectiva", "pePMon", "PePMon"])),
    windSpeed: parseNumber(pickFirst(row, ["velViento", "VelViento", "viento", "Viento"])),
    windDirection: parseNumber(pickFirst(row, ["dirViento", "DirViento", "direccionViento", "DireccionViento"])),
    solarRadiation: parseNumber(pickFirst(row, ["radiacion", "Radiacion", "radiacionSolar", "RadiacionSolar"])),
    et0: parseNumber(pickFirst(row, ["et0", "ET0", "eto", "ETo", "etPMon", "EtPMon"])),
  };
}

export async function getRiaStations(): Promise<RiaStation[]> {
  const cached = RIA_STATIONS_CACHE.get("all");
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const payload = await riaFetch("/estaciones");
    const stations = extractRows(payload)
      .map(mapStation)
      .filter((s): s is RiaStation => s !== null);
    RIA_STATIONS_CACHE.set("all", { data: stations, expiresAt: now + STATIONS_CACHE_TTL_MS });
    return stations;
  } catch (error) {
    console.error("Error fetching RIA stations:", error);
    return [];
  }
}

export async function getRiaStationsByProvince(province: string): Promise<RiaStation[]> {
  const all = await getRiaStations();
  const p = province.trim().toUpperCase();
  return all.filter((s) => s.idProvincia.toUpperCase() === p || s.provincia.toUpperCase().includes(p));
}

export function findNearestRiaStation(lat: number, lon: number, stations: RiaStation[]): RiaStation | null {
  let nearest: RiaStation | null = null;
  let minDist = Infinity;

  for (const s of stations) {
    if (!s.latitud || !s.longitud) continue;
    const d = (lat - s.latitud) ** 2 + (lon - s.longitud) ** 2;
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }

  return nearest;
}

export async function getRiaDailyData(stationId: string, startDate: string, endDate: string): Promise<RiaDailyData[]> {
  const cacheKey = `${stationId}:${startDate}:${endDate}`;
  const cached = RIA_DAILY_CACHE.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const stations = await getRiaStations();
    const station = stations.find((s) => s.id === stationId);
    if (!station) return [];

    const provinciaId = Number.parseInt(station.idProvincia, 10);
    if (Number.isNaN(provinciaId)) return [];

    const from = toRiaDateTimePath(startDate);
    const to = toRiaDateTimePath(endDate);
    const payload = await riaFetch(
      `/datosdiarios/${provinciaId}/${encodeURIComponent(station.codigo)}/${from}/${to}/true`
    );

    const daily = extractRows(payload)
      .map((row) => mapDailyRow(row, stationId))
      .filter((d) => Boolean(d.date));

    RIA_DAILY_CACHE.set(cacheKey, { data: daily, expiresAt: now + DAILY_CACHE_TTL_MS });
    return daily;
  } catch (error) {
    console.error("Error fetching RIA historical data:", error);
    return [];
  }
}

export async function getRiaDailyDataMany(
  stationIds: string[],
  startDate: string,
  endDate: string
): Promise<RiaDailyData[]> {
  const unique = [...new Set(stationIds.map((x) => x.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const results = await Promise.all(unique.map((id) => getRiaDailyData(id, startDate, endDate)));
  return results.flat();
}

export async function getRiaLatestData(stationId: string): Promise<RiaDailyData[]> {
  try {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const rows = await getRiaDailyData(stationId, ds, ds);
      if (rows.length > 0) return rows;
    }
    return [];
  } catch (error) {
    console.error("Error fetching RIA latest data:", error);
    return [];
  }
}

export async function getRiaHourlyData(stationId: string, startDate: string, endDate: string): Promise<RiaHourlyData[]> {
  const daily = await getRiaDailyData(stationId, startDate, endDate);
  return daily.map((d) => ({
    stationId: d.stationId,
    stationName: d.stationName,
    date: d.date,
    hour: 0,
    temperature: d.avgTemp,
    humidity: d.avgHumidity,
    precipitation: d.precipitation,
    windSpeed: d.windSpeed,
    windDirection: d.windDirection,
    solarRadiation: d.solarRadiation,
    leafWetness: null,
    soilTemperature: null,
    soilHumidity: null,
  }));
}

export async function getRiaHourlyDataMany(
  stationIds: string[],
  startDate: string,
  endDate: string
): Promise<RiaHourlyData[]> {
  const unique = [...new Set(stationIds.map((x) => x.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const results = await Promise.all(unique.map((id) => getRiaHourlyData(id, startDate, endDate)));
  return results.flat();
}

export async function getRiaEt0(stationId: string, startDate: string, endDate: string): Promise<{ date: string; et0: number | null }[]> {
  const daily = await getRiaDailyData(stationId, startDate, endDate);
  return daily.map((d) => ({ date: d.date, et0: d.et0 }));
}

export async function getRiaApiStatus(): Promise<{
  service: "riaws";
  baseUrl: string;
  authMode: string;
  hasToken: boolean;
  docsPath: string;
  endpoints: string[];
}> {
  return {
    service: "riaws",
    baseUrl: RIA_BASE_URL,
    authMode: RIA_AUTH_MODE,
    hasToken: Boolean(RIA_TOKEN.trim()),
    docsPath: `${RIA_BASE_URL.replace(/\/+$/, "")}/v2/api-docs`,
    endpoints: [
      "/estaciones",
      "/provincias",
      "/datosdiarios/{codigoProvincia}/{codigoEstacion}/{fecha}/{lgEt0}",
      "/datosdiarios/{codigoProvincia}/{codigoEstacion}/{fhInicio}/{fhFin}/{lgEt0}",
      "/datosmensuales/{codigoProvincia}/{codigoEstacion}/{anyo}/{mes}",
      "/datosmensuales/{codigoProvincia}/{codigoEstacion}/{anyo}/{mesInicio}/{mesFin}",
    ],
  };
}

export async function syncRiaDataForParcel(
  lat: number,
  lon: number
): Promise<{ station: RiaStation | null; dailyData: RiaDailyData[]; error: string | null }> {
  try {
    const stations = await getRiaStations();
    if (stations.length === 0) {
      return {
        station: null,
        dailyData: [],
        error: "No se pudieron obtener estaciones RIA. Verifica RIA_TOKEN.",
      };
    }

    const nearest = findNearestRiaStation(lat, lon, stations);
    if (!nearest) return { station: null, dailyData: [], error: "No hay estaciones RIA cercanas" };

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const startDate = start.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    const dailyData = await getRiaDailyData(nearest.id, startDate, endDate);

    return { station: nearest, dailyData, error: null };
  } catch (error) {
    return {
      station: null,
      dailyData: [],
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
