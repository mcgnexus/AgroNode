import { CROPS } from "@/lib/services/irrigation.service";

export type AlertSeverity = "low" | "medium" | "high";
export type AlertType = "frost" | "drought" | "wind" | "heat" | "rain" | "disease" | "adaptation";

export interface DailyForecastInput {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
  source?: string;
}

export interface HourlyForecastInput {
  date: string;
  hour: number;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitationProb: number | null;
}

export interface StationRecentInput {
  date: string;
  et0: number;
  precipitation: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
}

export interface WeatherAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  triggerValue?: string;
  threshold?: string;
}

export interface WeatherAlertResult {
  zoneId: string;
  zoneLabel: string;
  cropId: string;
  cropName: string;
  mainCropsForZone: string[];
  isMainCropForZone: boolean;
  alerts: WeatherAlert[];
}

interface AlertContext {
  cropId: string;
  cropName: string;
  parcelZone?: string | null;
  microclimate?: string | null;
  municipioNombre?: string | null;
  latitude: number;
  longitude: number;
  dailyForecasts: DailyForecastInput[];
  hourlyForecasts: HourlyForecastInput[];
  recentStationWeather: StationRecentInput[];
  latestSensor?: {
    ambientTemp: number;
    ambientHumidity: number;
    soilHumidity?: number | null;
  } | null;
}

type ZoneId = "costa_tropical" | "altiplano_interior" | "campina_valle" | "sierra" | "mediterraneo_general";

const ZONE_LABELS: Record<ZoneId, string> = {
  costa_tropical: "Costa Tropical",
  altiplano_interior: "Altiplano e Interior",
  campina_valle: "Campiña y Valle",
  sierra: "Sierra",
  mediterraneo_general: "Mediterráneo General",
};

const MAIN_CROPS_BY_ZONE: Record<ZoneId, string[]> = {
  costa_tropical: ["avocado", "citrus", "vegetable", "olive"],
  altiplano_interior: ["almond", "pistachio", "olive", "cereal", "vineyard"],
  campina_valle: ["olive", "cereal", "citrus", "vegetable", "vineyard"],
  sierra: ["olive", "almond", "vineyard", "cereal"],
  mediterraneo_general: ["olive", "almond", "vineyard", "citrus", "vegetable"],
};

const FROST_THRESHOLD: Record<string, number> = {
  avocado: 1.5,
  citrus: 0.5,
  vegetable: 0.5,
  almond: -1,
  olive: -2,
  vineyard: -1.5,
  cereal: -3,
  pistachio: -1,
};

const HEAT_THRESHOLD: Record<string, number> = {
  avocado: 36,
  citrus: 38,
  vegetable: 35,
  almond: 39,
  olive: 40,
  vineyard: 38,
  cereal: 37,
  pistachio: 39,
};

const WIND_THRESHOLD_MS: Record<string, number> = {
  avocado: 8,
  citrus: 9,
  vegetable: 8,
  almond: 10,
  olive: 11,
  vineyard: 10,
  cereal: 11,
  pistachio: 10,
};

const DROUGHT_DEFICIT_THRESHOLD: Record<string, number> = {
  avocado: 14,
  citrus: 18,
  vegetable: 12,
  almond: 24,
  olive: 28,
  vineyard: 26,
  cereal: 30,
  pistachio: 24,
};

function dedupeByDateAndSource(forecasts: DailyForecastInput[]): DailyForecastInput[] {
  const map = new Map<string, DailyForecastInput>();
  for (const f of forecasts) {
    const day = f.date.split("T")[0];
    const key = `${day}:${f.source ?? "unknown"}`;
    map.set(key, f);
  }
  return [...map.values()];
}

function pickBestForecasts(forecasts: DailyForecastInput[]): DailyForecastInput[] {
  const byDay = new Map<string, DailyForecastInput[]>();
  for (const f of dedupeByDateAndSource(forecasts)) {
    const day = f.date.split("T")[0];
    const bucket = byDay.get(day) ?? [];
    bucket.push(f);
    byDay.set(day, bucket);
  }

  const selected: DailyForecastInput[] = [];
  for (const [, list] of byDay.entries()) {
    const aemet = list.find((x) => (x.source ?? "").startsWith("aemet"));
    selected.push(aemet ?? list[0]);
  }

  return selected.sort((a, b) => a.date.localeCompare(b.date));
}

function deriveZone(ctx: AlertContext): ZoneId {
  const text = `${ctx.parcelZone ?? ""} ${ctx.microclimate ?? ""} ${ctx.municipioNombre ?? ""}`.toLowerCase();
  if (text.includes("costa") || text.includes("tropical") || text.includes("motril") || text.includes("almu")) {
    return "costa_tropical";
  }
  if (text.includes("altiplano") || text.includes("baza") || text.includes("guadix")) {
    return "altiplano_interior";
  }
  if (text.includes("sierra")) {
    return "sierra";
  }
  if (text.includes("vega") || text.includes("campi") || text.includes("valle")) {
    return "campina_valle";
  }

  if (ctx.latitude > 37.5) return "altiplano_interior";
  if (ctx.latitude < 36.95) return "costa_tropical";
  if (ctx.longitude < -4.2 || ctx.longitude > -3.0) return "sierra";
  return "mediterraneo_general";
}

function asFixed(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

function expectedRainFromProb(prob: number): number {
  return (Math.max(0, Math.min(100, prob)) / 100) * 2;
}

export function evaluateWeatherAlerts(ctx: AlertContext): WeatherAlertResult {
  const zoneId = deriveZone(ctx);
  const crop = CROPS[ctx.cropId] ?? CROPS.olive;
  const cropId = crop.id;
  const mainCropsForZone = MAIN_CROPS_BY_ZONE[zoneId];

  const alerts: WeatherAlert[] = [];
  const bestForecasts = pickBestForecasts(ctx.dailyForecasts).slice(0, 5);

  const frostThreshold = FROST_THRESHOLD[cropId] ?? -1;
  const heatThreshold = HEAT_THRESHOLD[cropId] ?? 38;
  const windThreshold = WIND_THRESHOLD_MS[cropId] ?? 10;
  const droughtThreshold = DROUGHT_DEFICIT_THRESHOLD[cropId] ?? 22;

  if (!mainCropsForZone.includes(cropId)) {
    alerts.push({
      id: "adaptation-zone-crop",
      type: "adaptation",
      severity: "low",
      title: "Cultivo menos habitual para la zona",
      message: `${crop.nameEs} no es uno de los cultivos principales de ${ZONE_LABELS[zoneId]}.`,
      recommendation: "Refuerza monitorización de estrés hídrico y viento en periodos críticos.",
    });
  }

  if (bestForecasts.length > 0) {
    const minForecastTemp = Math.min(...bestForecasts.map((d) => d.minTemp));
    if (minForecastTemp <= frostThreshold) {
      alerts.push({
        id: "frost-forecast-high",
        type: "frost",
        severity: "high",
        title: "Alerta de helada",
        message: `Se prevé mínima de ${asFixed(minForecastTemp)}°C.`,
        recommendation: "Programa protección antihelada (riego antihelada, cobertura o retraso de labores).",
        triggerValue: `${asFixed(minForecastTemp)}°C`,
        threshold: `≤ ${asFixed(frostThreshold)}°C`,
      });
    } else if (minForecastTemp <= frostThreshold + 1.5) {
      alerts.push({
        id: "frost-forecast-medium",
        type: "frost",
        severity: "medium",
        title: "Riesgo de helada leve",
        message: `Mínima prevista cercana al umbral (${asFixed(minForecastTemp)}°C).`,
        recommendation: "Vigila madrugada y ten plan de protección listo.",
        triggerValue: `${asFixed(minForecastTemp)}°C`,
        threshold: `~ ${asFixed(frostThreshold)}°C`,
      });
    }

    const maxForecastTemp = Math.max(...bestForecasts.map((d) => d.maxTemp));
    if (maxForecastTemp >= heatThreshold) {
      alerts.push({
        id: "heat-forecast-high",
        type: "heat",
        severity: "high",
        title: "Estrés térmico alto",
        message: `Máxima prevista de ${asFixed(maxForecastTemp)}°C.`,
        recommendation: "Adelanta riegos, evita tratamientos a mediodía y monitoriza estado hídrico.",
        triggerValue: `${asFixed(maxForecastTemp)}°C`,
        threshold: `≥ ${asFixed(heatThreshold)}°C`,
      });
    } else if (maxForecastTemp >= heatThreshold - 2) {
      alerts.push({
        id: "heat-forecast-medium",
        type: "heat",
        severity: "medium",
        title: "Riesgo de calor",
        message: `Temperaturas próximas al umbral del cultivo (${asFixed(maxForecastTemp)}°C).`,
        recommendation: "Revisa turnos de riego y estrés foliar en horas centrales.",
        triggerValue: `${asFixed(maxForecastTemp)}°C`,
        threshold: `~ ${asFixed(heatThreshold)}°C`,
      });
    }

    const maxPrecipProb = Math.max(...bestForecasts.map((d) => d.precipitationProb));
    if (maxPrecipProb >= 85) {
      alerts.push({
        id: "rain-forecast-high",
        type: "rain",
        severity: "medium",
        title: "Probabilidad alta de lluvia",
        message: `Probabilidad máxima prevista: ${Math.round(maxPrecipProb)}%.`,
        recommendation: "Ajusta riego y planifica tratamientos fitosanitarios fuera de ventana de lluvia.",
        triggerValue: `${Math.round(maxPrecipProb)}%`,
        threshold: "≥ 85%",
      });
    }
  }

  const windCandidates = ctx.hourlyForecasts
    .map((h) => h.windSpeed)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (windCandidates.length > 0) {
    const maxWind = Math.max(...windCandidates);
    if (maxWind >= windThreshold) {
      alerts.push({
        id: "wind-high",
        type: "wind",
        severity: "high",
        title: "Viento fuerte previsto",
        message: `Viento estimado de hasta ${asFixed(maxWind)} m/s.`,
        recommendation: "Evita tratamientos con deriva y revisa tutores/soporte de planta.",
        triggerValue: `${asFixed(maxWind)} m/s`,
        threshold: `≥ ${asFixed(windThreshold)} m/s`,
      });
    } else if (maxWind >= windThreshold - 2) {
      alerts.push({
        id: "wind-medium",
        type: "wind",
        severity: "medium",
        title: "Riesgo de viento moderado",
        message: `Viento cercano a umbral sensible (${asFixed(maxWind)} m/s).`,
        recommendation: "Monitoriza deriva y aplaza operaciones sensibles si aumenta.",
        triggerValue: `${asFixed(maxWind)} m/s`,
        threshold: `~ ${asFixed(windThreshold)} m/s`,
      });
    }
  }

  const recent = ctx.recentStationWeather.slice(-7);
  if (recent.length >= 3) {
    const et0Sum = recent.reduce((acc, d) => acc + d.et0, 0);
    const rainSum = recent.reduce((acc, d) => acc + d.precipitation, 0);
    const deficit = et0Sum - rainSum;

    if (deficit >= droughtThreshold) {
      alerts.push({
        id: "drought-high",
        type: "drought",
        severity: "high",
        title: "Déficit hídrico acumulado",
        message: `Déficit 7 días: ${asFixed(deficit)} mm.`,
        recommendation: "Incrementa frecuencia de riego y prioriza sectores con mayor estrés.",
        triggerValue: `${asFixed(deficit)} mm`,
        threshold: `≥ ${asFixed(droughtThreshold)} mm`,
      });
    } else if (deficit >= droughtThreshold * 0.7) {
      alerts.push({
        id: "drought-medium",
        type: "drought",
        severity: "medium",
        title: "Riesgo de sequía",
        message: `Déficit hídrico en aumento (${asFixed(deficit)} mm).`,
        recommendation: "Ajusta dosis de riego preventivamente y revisa humedad de suelo.",
        triggerValue: `${asFixed(deficit)} mm`,
        threshold: `~ ${asFixed(droughtThreshold)} mm`,
      });
    }
  } else if (bestForecasts.length > 0) {
    const forecastDeficit = bestForecasts.reduce(
      (acc, d) => acc + d.et0 - expectedRainFromProb(d.precipitationProb),
      0
    );
    if (forecastDeficit >= droughtThreshold * 0.7) {
      alerts.push({
        id: "drought-forecast-medium",
        type: "drought",
        severity: "medium",
        title: "Ventana seca prevista",
        message: `ET₀ prevista supera lluvia esperada (${asFixed(forecastDeficit)} mm).`,
        recommendation: "Prepara estrategia de riego para los próximos días.",
        triggerValue: `${asFixed(forecastDeficit)} mm`,
        threshold: `~ ${asFixed(droughtThreshold)} mm`,
      });
    }
  }

  const humidHours = ctx.hourlyForecasts.filter((h) => (h.humidity ?? 0) >= 85);
  const mildTempHumidHours = humidHours.filter((h) => {
    const t = h.temperature ?? 0;
    return t >= 8 && t <= 22;
  });
  if (mildTempHumidHours.length >= 6 && ["avocado", "citrus", "vineyard", "vegetable", "olive"].includes(cropId)) {
    alerts.push({
      id: "disease-humidity-medium",
      type: "disease",
      severity: "medium",
      title: "Condiciones favorables a enfermedad fúngica",
      message: `Se detectan ${mildTempHumidHours.length} horas con humedad alta y temperatura favorable.`,
      recommendation: "Aumenta vigilancia fitosanitaria y evita mojado foliar nocturno.",
      triggerValue: `${mildTempHumidHours.length} h`,
      threshold: "≥ 6 h",
    });
  }

  if (ctx.latestSensor?.ambientTemp != null && ctx.latestSensor.ambientTemp <= frostThreshold + 0.5) {
    alerts.push({
      id: "frost-sensor-now",
      type: "frost",
      severity: "high",
      title: "Temperatura crítica actual",
      message: `Sensor marca ${asFixed(ctx.latestSensor.ambientTemp)}°C.`,
      recommendation: "Activa medidas de protección inmediatas.",
      triggerValue: `${asFixed(ctx.latestSensor.ambientTemp)}°C`,
      threshold: `≤ ${asFixed(frostThreshold + 0.5)}°C`,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    zoneId,
    zoneLabel: ZONE_LABELS[zoneId],
    cropId,
    cropName: crop.nameEs,
    mainCropsForZone,
    isMainCropForZone: mainCropsForZone.includes(cropId),
    alerts,
  };
}
