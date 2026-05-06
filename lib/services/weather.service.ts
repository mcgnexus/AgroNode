import { prisma } from "@/lib/prisma";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const AEMET_API_KEY = process.env.AEMET_API_KEY!;
const AEMET_FORECAST_MUNICIPIO_HORARIA = "https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/horaria/";
const AEMET_FORECAST_MUNICIPIO_DIARIA = "https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/";
const AEMET_MUNICIPIOS_URL = "https://opendata.aemet.es/opendata/api/maestro/municipios/";
const REQUEST_TIMEOUT_MS = 15_000;

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max: (number | null)[];
  et0_fao_evapotranspiration: (number | null)[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

interface AemetMunicipio {
  id: string;
  nombre: string;
  latitud_dec: string;
  longitud_dec: string;
}

interface AemetPeriodoValor {
  value: string;
  periodo: string;
  descripcion?: string;
}

interface AemetForecastHourlyDay {
  fecha: string;
  temperatura?: AemetPeriodoValor[];
  probPrecipitacion?: AemetPeriodoValor[];
  humedadRelativa?: AemetPeriodoValor[];
  estadoCielo?: AemetPeriodoValor[];
  vientoAndRachaMax?: (AemetPeriodoValor & {
    direccion?: string[];
    velocidad?: string[];
  })[];
}

interface AemetForecastDailyDiaProb {
  value: number;
  periodo: string;
}

interface AemetForecastDailyDay {
  fecha: string;
  temperatura?: { maxima?: number; minima?: number };
  probPrecipitacion?: AemetForecastDailyDiaProb[];
}

interface AemetForecastDailyResponse {
  prediccion: {
    dia: AemetForecastDailyDay[];
  };
}

interface AemetForecastHourlyResponse {
  prediccion: {
    dia: AemetForecastHourlyDay[];
  };
}

interface AemetApiResponse {
  descripcion: string;
  estado: number;
  datos: string;
  metadatos?: string;
}

async function aemetFetchDatos<T>(url: string): Promise<T> {
  const r1 = await fetch(url, {
    headers: { "api_key": AEMET_API_KEY },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!r1.ok) throw new Error(`AEMET error ${r1.status} en ${url}`);
  const json: AemetApiResponse = await r1.json();
  if (json.estado !== 200 || !json.datos) {
    throw new Error(`AEMET: ${json.descripcion}`);
  }
  const r2 = await fetch(json.datos, {
    headers: { "api_key": AEMET_API_KEY },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!r2.ok) throw new Error(`AEMET datos error ${r2.status}`);
  return r2.json() as Promise<T>;
}

const MUNICIPIOS_CACHE = new Map<string, { list: AemetMunicipio[]; expiresAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function getMunicipios(): Promise<AemetMunicipio[]> {
  const now = Date.now();
  const cached = MUNICIPIOS_CACHE.get("all");
  if (cached && cached.expiresAt > now) return cached.list;

  const json = await aemetFetchDatos<AemetMunicipio[]>(AEMET_MUNICIPIOS_URL);
  MUNICIPIOS_CACHE.set("all", { list: json, expiresAt: Date.now() + CACHE_TTL_MS });
  return json;
}

function getMunicipioNumericId(municipio: AemetMunicipio): string {
  return municipio.id.replace(/^id/, "");
}

function findNearestMunicipio(lat: number, lon: number, municipios: AemetMunicipio[]): AemetMunicipio | null {
  let nearest: AemetMunicipio | null = null;
  let minDist = Infinity;

  for (const m of municipios) {
    const mLat = parseFloat(m.latitud_dec);
    const mLon = parseFloat(m.longitud_dec);
    const d = (lat - mLat) ** 2 + (lon - mLon) ** 2;
    if (d < minDist) { minDist = d; nearest = m; }
  }

  return nearest;
}

function hargreavesEt0(lat: number, tMax: number, tMin: number, date: Date): number {
  const doy = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const latRad = (lat * Math.PI) / 180;
  const solarDeclination = 0.409 * Math.sin(((2 * Math.PI * doy) / 365) - 1.39);
  const sunsetHourAngle = Math.acos(-Math.tan(latRad) * Math.tan(solarDeclination));
  const ra = (24 * 60 / Math.PI) * 0.0820 * 1367 * (
    sunsetHourAngle * Math.sin(latRad) * Math.sin(solarDeclination) +
    Math.cos(latRad) * Math.cos(solarDeclination) * Math.sin(sunsetHourAngle)
  ) / 1e6;

  const td = tMax - tMin;
  if (ra <= 0 || td < 0) return 0;

  const et0 = 0.0023 * (tMax + tMin) / 2 + 17.8 * Math.sqrt(td) * ra;
  return Math.max(0, Math.round(et0 * 100) / 100);
}

async function openMeteoForParcel(lat: number, lon: number) {
  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lon.toString());
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "et0_fao_evapotranspiration",
  ].join(","));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo respondió con status ${response.status}`);
  }

  const json = await response.json() as OpenMeteoResponse;
  const daily = json.daily;

  if (
    !daily?.time ||
    !daily?.temperature_2m_max ||
    !daily?.temperature_2m_min ||
    !daily?.precipitation_probability_max ||
    !daily?.et0_fao_evapotranspiration
  ) {
    throw new Error("Open-Meteo: formato inesperado");
  }

  return daily;
}

function getHourlyValue(periodos: AemetPeriodoValor[] | undefined, hour: number): number | null {
  if (!periodos) return null;
  const entry = periodos.find(p => parseInt(p.periodo) === hour);
  if (!entry) return null;
  const val = parseFloat(entry.value);
  return isNaN(val) ? null : val;
}

function getHourlySkyState(periodos: AemetPeriodoValor[] | undefined, hour: number): string | null {
  if (!periodos) return null;
  const entry = periodos.find(p => parseInt(p.periodo) === hour);
  if (!entry) return null;
  if (entry.descripcion) return entry.descripcion;
  return entry.value;
}

function getPrecipForHour(rangos: AemetPeriodoValor[] | undefined, hour: number): number | null {
  if (!rangos || rangos.length === 0) return null;
  for (const r of rangos) {
    const periodo = r.periodo;
    let start: number;
    let end: number;

    if (periodo.includes("-")) {
      const parts = periodo.split("-");
      start = parseInt(parts[0]);
      end = parseInt(parts[1]);
    } else if (periodo.length === 4) {
      start = parseInt(periodo.slice(0, 2));
      end = parseInt(periodo.slice(2, 4));
    } else {
      const h = parseInt(periodo);
      if (h === hour) return parseFloat(r.value) || 0;
      continue;
    }

    if (isNaN(start) || isNaN(end)) continue;
    if (hour >= start && hour < end) return parseFloat(r.value) || 0;
  }
  return null;
}

export async function syncForecastForParcel(parcelId: string) {
  const parcel = await prisma.parcel.findUnique({ where: { id: parcelId } });
  if (!parcel) throw new Error(`Parcela no encontrada: ${parcelId}`);

  const fetchedAt = new Date();
  const results: { source: string; daysSynced: number }[] = [];

  const omPromise = openMeteoForParcel(parcel.latitude, parcel.longitude)
    .then(async (daily) => {
      const upserts = [];
      for (let i = 0; i < daily.time.length; i++) {
        const maxTemp = daily.temperature_2m_max[i];
        const minTemp = daily.temperature_2m_min[i];
        const precipProb = daily.precipitation_probability_max[i];
        const et0 = daily.et0_fao_evapotranspiration[i];

        if (maxTemp == null || minTemp == null || precipProb == null || et0 == null) continue;

        const forecastDate = new Date(`${daily.time[i]}T12:00:00Z`);

        upserts.push(
          prisma.weatherForecast.upsert({
            where: { parcelId_forecastDate_source: { parcelId, forecastDate, source: "open-meteo" } },
            create: { parcelId, forecastDate, maxTemp, minTemp, precipitationProb: precipProb, et0, source: "open-meteo", fetchedAt },
            update: { maxTemp, minTemp, precipitationProb: precipProb, et0, fetchedAt },
          })
        );
      }
      if (upserts.length > 0) await prisma.$transaction(upserts);
      results.push({ source: "open-meteo", daysSynced: upserts.length });
    })
    .catch(() => {
      results.push({ source: "open-meteo", daysSynced: 0 });
    });

  const aemetPromise = (async () => {
    try {
      const municipios = await getMunicipios();
      const municipio = findNearestMunicipio(parcel.latitude, parcel.longitude, municipios);
      if (!municipio) throw new Error("No se encontró municipio cercano");

      const numericId = getMunicipioNumericId(municipio);

      const [dailyResult, hourlyResult] = await Promise.all([
        aemetFetchDatos<AemetForecastDailyResponse[]>(
          `${AEMET_FORECAST_MUNICIPIO_DIARIA}${numericId}/`
        ).catch(() => null),
        aemetFetchDatos<AemetForecastHourlyResponse[]>(
          `${AEMET_FORECAST_MUNICIPIO_HORARIA}${numericId}/`
        ).catch(() => null),
      ]);

      const dailyUpserts = [];
      const hourlyUpserts = [];
      const source = "aemet";

      if (dailyResult?.[0]?.prediccion?.dia) {
        for (const day of dailyResult[0].prediccion.dia) {
          const maxTemp = day.temperatura?.maxima ?? null;
          const minTemp = day.temperatura?.minima ?? null;

          if (maxTemp == null || minTemp == null) continue;

          const forecastDate = new Date(day.fecha);
          const et0 = hargreavesEt0(parcel.latitude, maxTemp, minTemp, forecastDate);

          const precipEntries = day.probPrecipitacion ?? [];
          const precipProb = precipEntries.length > 0
            ? Math.max(...precipEntries.map(p => typeof p.value === "number" ? p.value : parseFloat(String(p.value))).filter(v => !isNaN(v)))
            : 0;

          dailyUpserts.push(
            prisma.weatherForecast.upsert({
              where: { parcelId_forecastDate_source: { parcelId, forecastDate, source } },
              create: { parcelId, forecastDate, maxTemp, minTemp, precipitationProb: precipProb, et0, source, fetchedAt },
              update: { maxTemp, minTemp, precipitationProb: precipProb, et0, fetchedAt },
            })
          );
        }
      }

      if (hourlyResult?.[0]?.prediccion?.dia) {
        for (const day of hourlyResult[0].prediccion.dia) {
          const forecastDate = new Date(day.fecha);

          const hours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
          for (const hour of hours) {
            const temperature = getHourlyValue(day.temperatura, hour);
            const hourPrecip = getPrecipForHour(day.probPrecipitacion, hour);
            const humidity = getHourlyValue(day.humedadRelativa, hour);
            const skyState = getHourlySkyState(day.estadoCielo, hour);

            let windSpeed: number | null = null;
            let windDirection: string | null = null;
            if (day.vientoAndRachaMax) {
              const windEntry = day.vientoAndRachaMax.find(
                w => w.direccion && w.velocidad && parseInt(w.periodo) === hour
              );
              if (windEntry?.velocidad?.[0]) {
                windSpeed = parseFloat(windEntry.velocidad[0]) || null;
              }
              if (windEntry?.direccion?.[0]) {
                windDirection = windEntry.direccion[0];
              }
            }

            if (temperature == null && hourPrecip == null && humidity == null && skyState == null) continue;

            hourlyUpserts.push(
              prisma.aemetHourlyForecast.upsert({
                where: { parcelId_forecastDate_hour: { parcelId, forecastDate, hour } },
                create: {
                  parcelId,
                  municipioId: numericId,
                  municipioNombre: municipio.nombre,
                  forecastDate,
                  hour,
                  temperature,
                  precipitationProb: hourPrecip,
                  humidity,
                  windSpeed,
                  windDirection,
                  skyState,
                  fetchedAt,
                },
                update: {
                  municipioId: numericId,
                  municipioNombre: municipio.nombre,
                  temperature,
                  precipitationProb: hourPrecip,
                  humidity,
                  windSpeed,
                  windDirection,
                  skyState,
                  fetchedAt,
                },
              })
            );
          }
        }
      }

      if (dailyUpserts.length > 0) await prisma.$transaction(dailyUpserts);
      if (hourlyUpserts.length > 0) await prisma.$transaction(hourlyUpserts);
      results.push({ source: "aemet", daysSynced: dailyUpserts.length });
    } catch {
      results.push({ source: "aemet", daysSynced: 0 });
    }
  })();

  await Promise.all([omPromise, aemetPromise]);

  const totalSynced = results.reduce((s, r) => s + r.daysSynced, 0);
  if (totalSynced === 0) {
    throw new Error("Open-Meteo y AEMET fallaron. Sin datos meteorológicos.");
  }

  return {
    parcelId,
    parcelName: parcel.name,
    sources: results,
    totalDaysSynced: totalSynced,
  };
}
