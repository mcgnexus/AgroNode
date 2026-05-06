const SIAR_BASE = "https://servicio.mapa.gob.es/siarapi/API/V1";
import {
  blockSiarForOneDay,
  isSiarDailyBlocked,
  queueSiarRequest,
  SiarQuotaError,
  sleep,
} from "@/lib/services/siar-rate-limit";

const ANDALUCIA_CODES = new Set(["AL", "CA", "CO", "GR", "HU", "JA", "MA", "SE"]);
const ANDALUCIA_IDS = new Set(["04", "11", "14", "18", "21", "23", "29", "41", "4", "11", "14", "18", "21", "23", "29", "41"]);
const SIAR_RETRY_MAX_ATTEMPTS = Number(process.env.SIAR_RETRY_MAX_ATTEMPTS ?? 4);
const SIAR_RETRY_BASE_DELAY_MS = Number(process.env.SIAR_RETRY_BASE_DELAY_MS ?? 5000);

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const MEM_CACHE = new Map<string, CacheEntry<unknown>>();

export interface SIAREstacion {
  Codigo: string;
  Estacion: string;
  Termino?: string;
  Latitud?: string;
  Longitud?: string;
  Altitud?: number;
  XUTM?: number;
  YUTM?: number;
  Huso?: number;
  Fecha_Instalacion?: string;
  Fecha_Baja?: string | null;
  Red_Estacion?: string;
  Codigo_CCAA?: string;
  IdProvincia?: string | number;
}

export interface SIARDatoDiario {
  Fecha: string;
  Estacion: string;
  TempMedia?: number;
  TempMax?: number;
  TempMin?: number;
  HumedadMedia?: number;
  HumedadMax?: number;
  humedadMin?: number;
  VelViento?: number;
  DirViento?: number;
  Radiacion?: number;
  Precipitacion?: number;
  EtPMon?: number;
  PePMon?: number;
}

export interface SIARDatoHorario {
  Fecha: string;
  Hora?: number | string;
  Estacion?: string;
  TempMedia?: number;
  HumedadMedia?: number;
  VelViento?: number;
  DirViento?: number;
  Radiacion?: number;
  Precipitacion?: number;
}

export interface SIARAccesoInfo {
  [key: string]: unknown;
}

function getToken(): string {
  const token = process.env.SIAR_TOKEN?.trim();
  if (!token) throw new Error("SIAR_TOKEN no configurado");
  return token;
}

function readCache<T>(key: string): T | null {
  const entry = MEM_CACHE.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    MEM_CACHE.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs: number): T {
  MEM_CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function normalizeIds(ids: string | string[]): string[] {
  return (Array.isArray(ids) ? ids : [ids]).map((x) => x.trim()).filter(Boolean);
}

async function siarFetch<T>(
  path: string,
  params: Record<string, string | string[]>,
  ttlMs: number
): Promise<T> {
  if (isSiarDailyBlocked()) {
    throw new SiarQuotaError("day", "SIAR daily quota exceeded (blocked until next day)");
  }

  const token = getToken();
  const url = new URL(`${SIAR_BASE}${path}`);
  url.searchParams.set("token", token);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, v);
    } else {
      url.searchParams.set(key, value);
    }
  }

  const cacheKey = url.toString();
  const cached = readCache<T>(cacheKey);
  if (cached) return cached;

  for (let attempt = 0; attempt <= SIAR_RETRY_MAX_ATTEMPTS; attempt++) {
    const res = await queueSiarRequest(() =>
      fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
    );
    const raw = await res.text();

    if (res.ok) {
      let data: T;
      try {
        data = JSON.parse(raw) as T;
      } catch {
        throw new Error(`SIAR invalid JSON: ${raw.substring(0, 220)}`);
      }
      return writeCache(cacheKey, data, ttlMs);
    }

    const lower = raw.toLowerCase();
    const quotaMinute =
      res.status === 403 &&
      lower.includes("rebasar") &&
      lower.includes("máximo de datos") &&
      lower.includes("en un minuto");
    const quotaDay =
      res.status === 403 &&
      lower.includes("rebasar") &&
      lower.includes("máximo de datos") &&
      lower.includes("en un día");

    if (quotaDay) {
      blockSiarForOneDay();
      throw new SiarQuotaError("day", raw.substring(0, 220));
    }

    const shouldRetry = quotaMinute || res.status === 429 || res.status >= 500;
    if (shouldRetry && attempt < SIAR_RETRY_MAX_ATTEMPTS) {
      const backoffMs = SIAR_RETRY_BASE_DELAY_MS * 2 ** attempt;
      const jitterMs = Math.floor(Math.random() * 750);
      await sleep(backoffMs + jitterMs);
      continue;
    }

    throw new Error(`SIAR Error ${res.status}: ${raw.substring(0, 220)}`);
  }
  throw new Error("SIAR Error: max retries reached");
}

function isAndaluciaStation(e: SIAREstacion): boolean {
  const code = String(e.Codigo ?? "").substring(0, 2).toUpperCase();
  const ccaa = String(e.Codigo_CCAA ?? "").toUpperCase();
  const idProvRaw = String(e.IdProvincia ?? "").padStart(2, "0");
  return ccaa === "AND" || ANDALUCIA_CODES.has(code) || ANDALUCIA_IDS.has(idProvRaw);
}

export async function getEstaciones(): Promise<SIAREstacion[]> {
  const data = await siarFetch<{ datos?: SIAREstacion[] }>("/Info/ESTACIONES", {}, 12 * 60 * 60 * 1000);
  return data.datos ?? [];
}

export async function getEstacionesAndalucia(): Promise<SIAREstacion[]> {
  const estaciones = await getEstaciones();
  return estaciones.filter(isAndaluciaStation);
}

export async function getEstacionesProvincia(provincia: string): Promise<SIAREstacion[]> {
  const p = provincia.trim().toUpperCase();
  const p2 = p.padStart(2, "0");
  const estaciones = await getEstaciones();
  return estaciones.filter((e) => {
    const code2 = String(e.Codigo ?? "").substring(0, 2).toUpperCase();
    const idProv = String(e.IdProvincia ?? "").padStart(2, "0");
    return code2 === p || idProv === p2;
  });
}

export async function getDatosDiarios(
  estaciones: string | string[],
  fechaInicial: string,
  fechaFinal: string,
  datosCalculados = true
): Promise<SIARDatoDiario[]> {
  const ids = normalizeIds(estaciones);
  const data = await siarFetch<{ datos?: SIARDatoDiario[] }>(
    "/Datos/Diarios/ESTACION",
    {
      Id: ids,
      FechaInicial: fechaInicial,
      FechaFinal: fechaFinal,
      DatosCalculados: String(datosCalculados).toLowerCase(),
    },
    6 * 60 * 60 * 1000
  );
  return data.datos ?? [];
}

export async function getDatosHorarios(
  estaciones: string | string[],
  fechaInicial: string,
  fechaFinal: string
): Promise<SIARDatoHorario[]> {
  const ids = normalizeIds(estaciones);
  const data = await siarFetch<{ datos?: SIARDatoHorario[] }>(
    "/Datos/Horarios/ESTACION",
    {
      Id: ids,
      FechaInicial: fechaInicial,
      FechaFinal: fechaFinal,
    },
    45 * 60 * 1000
  );
  return data.datos ?? [];
}

export async function getDatosSemanales(
  estaciones: string | string[],
  fechaInicial: string,
  fechaFinal: string,
  datosCalculados = true
): Promise<SIARDatoDiario[]> {
  const ids = normalizeIds(estaciones);
  const data = await siarFetch<{ datos?: SIARDatoDiario[] }>(
    "/Datos/Semanales/ESTACION",
    {
      Id: ids,
      FechaInicial: fechaInicial,
      FechaFinal: fechaFinal,
      DatosCalculados: String(datosCalculados).toLowerCase(),
    },
    12 * 60 * 60 * 1000
  );
  return data.datos ?? [];
}

export async function getAccesos(): Promise<SIARAccesoInfo> {
  const data = await siarFetch<{ datos?: SIARAccesoInfo; [key: string]: unknown }>(
    "/Info/ACCESOS",
    {},
    10 * 60 * 1000
  );
  return (data.datos ?? data) as SIARAccesoInfo;
}

export async function getCCAA(): Promise<{ Codigo: string; Nombre: string }[]> {
  const data = await siarFetch<{ datos?: { Codigo: string; Nombre: string }[] }>(
    "/Info/CCAA",
    {},
    24 * 60 * 60 * 1000
  );
  return data.datos ?? [];
}

export async function getProvincias(): Promise<{ Codigo: string; Nombre: string; Codigo_CCAA: string }[]> {
  const data = await siarFetch<{ datos?: { Codigo: string; Nombre: string; Codigo_CCAA: string }[] }>(
    "/Info/PROVINCIAS",
    {},
    24 * 60 * 60 * 1000
  );
  return data.datos ?? [];
}
