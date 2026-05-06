import {
  blockSiarForOneDay,
  isSiarDailyBlocked,
  queueSiarRequest,
  SiarQuotaError,
  sleep,
} from "@/lib/services/siar-rate-limit";

const SIAR_BASE_URL = "https://servicio.mapa.gob.es/siarapi/API/V1";
const SIAR_TOKEN = process.env.SIAR_TOKEN ?? "";
const SIAR_ENABLED = (process.env.SIAR_ENABLED ?? "true").toLowerCase() !== "false";
const REQUEST_TIMEOUT_MS = 20_000;
const SIAR_RETRY_MAX_ATTEMPTS = Number(process.env.SIAR_RETRY_MAX_ATTEMPTS ?? 4);
const SIAR_RETRY_BASE_DELAY_MS = Number(process.env.SIAR_RETRY_BASE_DELAY_MS ?? 5000);

export interface SiarStation {
  id: string;
  nombre: string;
  provincia: string;
  idProvincia: string;
  municipio: string;
  latitud: number;
  longitud: number;
  altitud: number;
}

export interface SiarDailyData {
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
  windSpeed: number | null;
  windDirection: number | null;
  solarRadiation: number | null;
  et0: number | null;
}

export function isSiarEnabled(): boolean {
  return SIAR_ENABLED;
}

const SIAR_STATIONS_CACHE = new Map<string, { data: SiarStation[]; expiresAt: number }>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCoord(raw: string | undefined): number {
  if (!raw || typeof raw !== "string" || raw.length < 9) return 0;
  const dir = raw.slice(-1).toUpperCase();
  const num = raw.slice(0, -1);
  const deg = parseInt(num.slice(0, 2), 10);
  const min = parseInt(num.slice(2, 4), 10);
  const sec = parseInt(num.slice(4, 6), 10);
  const mil = parseInt(num.slice(6, 9), 10);
  let decimal = deg + min / 60 + (sec + mil / 1000) / 3600;
  if (dir === "S" || dir === "W") decimal = -decimal;
  return decimal;
}

function buildUrl(endpoint: string, params: Record<string, string> = {}): string {
  const url = new URL(`${SIAR_BASE_URL}${endpoint}`);
  url.searchParams.set("token", SIAR_TOKEN.trim());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function siarFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (isSiarDailyBlocked()) {
    throw new SiarQuotaError("day", "SIAR daily quota exceeded (blocked until next day)");
  }

  const url = buildUrl(endpoint, params);
  for (let attempt = 0; attempt <= SIAR_RETRY_MAX_ATTEMPTS; attempt++) {
    const response = await queueSiarRequest(() =>
      fetch(url, {
        headers: {
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    );

    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`SIAR API: invalid JSON - ${text.substring(0, 300)}`);
      }
    }

    const quotaExceededMinute =
      response.status === 403 &&
      text.toLowerCase().includes("rebasar") &&
      text.toLowerCase().includes("máximo de datos") &&
      text.toLowerCase().includes("en un minuto");
    const quotaExceededDay =
      response.status === 403 &&
      text.toLowerCase().includes("rebasar") &&
      text.toLowerCase().includes("máximo de datos") &&
      text.toLowerCase().includes("en un día");

    if (quotaExceededDay) {
      blockSiarForOneDay();
      throw new SiarQuotaError("day", text.substring(0, 200));
    }

    const shouldRetry = quotaExceededMinute || response.status === 429 || response.status >= 500;

    if (shouldRetry && attempt < SIAR_RETRY_MAX_ATTEMPTS) {
      const backoffMs = SIAR_RETRY_BASE_DELAY_MS * 2 ** attempt;
      const jitterMs = Math.floor(Math.random() * 750);
      const delayMs = backoffMs + jitterMs;
      console.warn(`SIAR rate-limited (${response.status}). Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      continue;
    }

    throw new Error(`SIAR API error ${response.status}: ${text.substring(0, 200)}`);
  }

  throw new Error("SIAR API error: max retries reached");
}

export async function getSiarProvincias(): Promise<{ Codigo: string; Nombre: string }[]> {
  if (!SIAR_ENABLED) return [];
  try {
    const response = await siarFetch<{ datos: { Codigo: string; Nombre: string }[] }>("/Info/PROVINCIAS");
    return response.datos || [];
  } catch (error) {
    console.error("Error fetching SIAR provincias:", error);
    return [];
  }
}

export async function getSiarEstaciones(idProvincia?: string): Promise<SiarStation[]> {
  if (!SIAR_ENABLED) return [];
  const now = Date.now();
  const cacheKey = idProvincia ? `prov_${idProvincia}` : "all";
  const cached = SIAR_STATIONS_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;

  try {
    const response = await siarFetch<{ datos: Record<string, unknown>[] }>("/Info/ESTACIONES");
    let raw = response.datos || [];
    if (idProvincia) {
      raw = raw.filter((s) =>
        String(s.Codigo ?? "").substring(0, 2) === idProvincia
      );
    }
    const stations: SiarStation[] = raw.map((s) => ({
      id: asString(s.Codigo),
      nombre: asString(s.Estacion),
      provincia: asString(s.Codigo).substring(0, 2),
      idProvincia: asString(s.Codigo).substring(0, 2),
      municipio: asString(s.Termino),
      latitud: parseCoord(asString(s.Latitud)),
      longitud: parseCoord(asString(s.Longitud)),
      altitud: asNumber(s.Altitud) ?? 0,
    }));
    SIAR_STATIONS_CACHE.set(cacheKey, { data: stations, expiresAt: Date.now() + CACHE_TTL_MS });
    return stations;
  } catch (error) {
    if (error instanceof SiarQuotaError && error.scope === "day") {
      console.warn("SIAR daily quota exceeded. Skipping stations fetch until tomorrow.");
      return [];
    }
    console.error("Error fetching SIAR estaciones:", error);
    return [];
  }
}

export async function getSiarAllStations(): Promise<SiarStation[]> {
  return getSiarEstaciones();
}

export function findNearestSiarStation(
  lat: number,
  lon: number,
  stations: SiarStation[]
): SiarStation | null {
  let nearest: SiarStation | null = null;
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

export async function getSiarDailyData(
  idEstacion: string,
  startDate: string,
  endDate: string
): Promise<SiarDailyData[]> {
  if (!SIAR_ENABLED) return [];
  try {
    const response = await siarFetch<{ datos: Record<string, unknown>[] }>("/Datos/Diarios/ESTACION", {
      Id: idEstacion,
      FechaInicial: startDate,
      FechaFinal: endDate,
      DatosCalculados: "true",
    });
    const raw = response.datos || [];

    if (!Array.isArray(raw)) return [];

    return raw.map((d) => ({
      stationId: asString(d.Estacion) || idEstacion,
      stationName: asString(d.Estacion),
      date: asString(d.Fecha).split("T")[0],
      maxTemp: asNumber(d.TempMax),
      minTemp: asNumber(d.TempMin),
      avgTemp: asNumber(d.TempMedia),
      maxHumidity: asNumber(d.HumedadMax),
      minHumidity: asNumber(d.humedadMin ?? d.HumMin),
      avgHumidity: asNumber(d.HumedadMedia),
      precipitation: asNumber(d.Precipitacion),
      windSpeed: asNumber(d.VelViento),
      windDirection: asNumber(d.DirViento),
      solarRadiation: asNumber(d.Radiacion),
      et0: asNumber(d.EtPMon ?? d.ET0 ?? d.Et0),
    }));
  } catch (error) {
    if (error instanceof SiarQuotaError && error.scope === "day") {
      console.warn("SIAR daily quota exceeded. Skipping SIAR daily fetch until tomorrow.");
      return [];
    }
    console.error("Error fetching SIAR daily data:", error);
    return [];
  }
}

export async function syncSiarDataForParcel(
  lat: number,
  lon: number
): Promise<{ station: SiarStation | null; dailyData: SiarDailyData[]; error: string | null }> {
  if (!SIAR_ENABLED) {
    return {
      station: null,
      dailyData: [],
      error: "SIAR deshabilitado por configuración (SIAR_ENABLED=false).",
    };
  }

  try {
    const stations = await getSiarAllStations();
    if (stations.length === 0) {
      return {
        station: null,
        dailyData: [],
        error: "No se pudieron obtener estaciones SIAR. Verifica el token y la URL.",
      };
    }

    const nearest = findNearestSiarStation(lat, lon, stations);
    if (!nearest) {
      return { station: null, dailyData: [], error: "No hay estaciones cercanas" };
    }

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const startDate = start.toISOString().split("T")[0];
    const endDate = today.toISOString().split("T")[0];

    const dailyData = await getSiarDailyData(
      nearest.id,
      startDate,
      endDate
    );

    return { station: nearest, dailyData, error: null };
  } catch (error) {
    return {
      station: null,
      dailyData: [],
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
