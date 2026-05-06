export interface CropData {
  id: string;
  name: string;
  nameEs: string;
  kc: [number, number, number];
  maxDeficit: number;
  stages: [string, string, string];
  phenoRisks: string[];
}

export interface SoilData {
  id: string;
  name: string;
  nameEs: string;
  cc: number;
  wp: number;
  aw: number;
}

export interface IrrigationSystem {
  id: string;
  name: string;
  nameEs: string;
  efficiency: number;
}

export interface WeatherForIrrig {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  et0: number;
  date: Date;
}

export interface IrrigationResult {
  etc: number;
  irrigationNeed: number;
  effectiveRainfall: number;
  totalVolume: number;
  deficit7Days: number;
  nextIrrigation: string;
  urgency: "none" | "low" | "medium" | "high";
  cropStatus: string;
  recommendations: string[];
}

export const CROPS: Record<string, CropData> = {
  almond: {
    id: "almond",
    name: "Almond",
    nameEs: "Almendro",
    kc: [0.4, 0.9, 0.75],
    maxDeficit: 40,
    stages: ["Floración", "Fructificación", "Maduración"],
    phenoRisks: ["Heladas tardías", "Capnodis tenebrionis"],
  },
  olive: {
    id: "olive",
    name: "Olive",
    nameEs: "Olivo",
    kc: [0.5, 0.7, 0.65],
    maxDeficit: 50,
    stages: ["Floración", "Cuajado", "Maduración"],
    phenoRisks: ["Verticilosis", "Repilo"],
  },
  avocado: {
    id: "avocado",
    name: "Avocado",
    nameEs: "Aguacate",
    kc: [0.8, 1.0, 0.85],
    maxDeficit: 20,
    stages: ["Floración", "Crecimiento", "Cosecha"],
    phenoRisks: ["Phytophthora cinnamomi", "Podredumbre radical"],
  },
  citrus: {
    id: "citrus",
    name: "Citrus",
    nameEs: "Cítricos",
    kc: [0.7, 0.85, 0.75],
    maxDeficit: 30,
    stages: ["Brotación", "Cuajado", "Engorde"],
    phenoRisks: ["Cotonet", "Minador de hojas"],
  },
  vegetable: {
    id: "vegetable",
    name: "Vegetable",
    nameEs: "Hortícola",
    kc: [0.6, 1.05, 0.9],
    maxDeficit: 15,
    stages: ["Germinación", "Desarrollo", "Producción"],
    phenoRisks: ["Mildiu", "Botritis"],
  },
  cereal: {
    id: "cereal",
    name: "Cereal",
    nameEs: "Cereal",
    kc: [0.3, 1.15, 0.25],
    maxDeficit: 60,
    stages: ["Emergencia", "Espigado", "Madurez"],
    phenoRisks: ["Fusarium", "Roya"],
  },
  pistachio: {
    id: "pistachio",
    name: "Pistachio",
    nameEs: "Pistacho",
    kc: [0.4, 0.9, 0.7],
    maxDeficit: 45,
    stages: ["Brotación", "Llenado", "Cosecha"],
    phenoRisks: ["Botrytis", "Alternaria"],
  },
  vineyard: {
    id: "vineyard",
    name: "Vineyard",
    nameEs: "Vid",
    kc: [0.3, 0.85, 0.45],
    maxDeficit: 55,
    stages: ["Brotación", "Envero", "Vendimia"],
    phenoRisks: ["Oídio", "Mildiu"],
  },
};

export const SOILS: Record<string, SoilData> = {
  sandy: {
    id: "sandy",
    name: "Sandy",
    nameEs: "Arenoso",
    cc: 100,
    wp: 50,
    aw: 50,
  },
  loam: {
    id: "loam",
    name: "Loam",
    nameEs: "Franco",
    cc: 200,
    wp: 90,
    aw: 110,
  },
  clay: {
    id: "clay",
    name: "Clay",
    nameEs: "Arcilloso",
    cc: 280,
    wp: 140,
    aw: 140,
  },
  silty: {
    id: "silty",
    name: "Silty",
    nameEs: "Limoso",
    cc: 240,
    wp: 100,
    aw: 140,
  },
};

export const IRRIGATION_SYSTEMS: Record<string, IrrigationSystem> = {
  drip: {
    id: "drip",
    name: "Drip irrigation",
    nameEs: "Riego por goteo",
    efficiency: 90,
  },
  sprinkler: {
    id: "sprinkler",
    name: "Sprinkler irrigation",
    nameEs: "Riego por aspersión",
    efficiency: 75,
  },
  flood: {
    id: "flood",
    name: "Flood irrigation",
    nameEs: "Riego por gravedad",
    efficiency: 55,
  },
  subsurface: {
    id: "subsurface",
    name: "Subsurface drip",
    nameEs: "Riego subterráneo",
    efficiency: 95,
  },
};

export function getKcForPhase(cropId: string, phase: number): number {
  const crop = CROPS[cropId];
  if (!crop) return 0.75;
  const phaseIndex = Math.min(2, Math.max(0, Math.floor(phase)));
  return crop.kc[phaseIndex];
}

export function calculateIrrigationNeed(
  weatherData: WeatherForIrrig[],
  cropId: string,
  currentKc: number,
  areaHa: number,
  irrigationSystemId: string
): IrrigationResult {
  const crop = CROPS[cropId] || CROPS.olive;
  const irrSystem = IRRIGATION_SYSTEMS[irrigationSystemId] || IRRIGATION_SYSTEMS.drip;

  let totalEtc = 0;
  let totalRain = 0;
  const dailyResults: { date: Date; etc: number; rain: number; need: number }[] = [];

  for (const w of weatherData) {
    const etc = w.et0 * currentKc;
    const effectiveRain = w.precipitation * 0.75;
    const need = Math.max(0, etc - effectiveRain);

    totalEtc += etc;
    totalRain += effectiveRain;

    dailyResults.push({ date: w.date, etc, rain: effectiveRain, need });
  }

  const avgEtc = totalEtc / weatherData.length;
  const avgRain = totalRain / weatherData.length;
  const avgNeed = Math.max(0, avgEtc - avgRain);
  const effectiveRainTotal = totalRain;

  const deficit7Days = totalEtc - effectiveRainTotal;

  let urgency: "none" | "low" | "medium" | "high" = "none";
  let nextIrrigation = "Sin datos";
  let cropStatus = "Sin datos";
  const recommendations: string[] = [];

  if (deficit7Days > crop.maxDeficit) {
    urgency = "high";
    nextIrrigation = "URGENTE";
    cropStatus = "Estrés severo";
    recommendations.push(
      `Riego urgente: déficit de ${deficit7Days.toFixed(1)} mm supera el umbral crítico de ${crop.maxDeficit} mm`
    );
  } else if (deficit7Days > crop.maxDeficit * 0.7) {
    urgency = "medium";
    nextIrrigation = "24-48h";
    cropStatus = "Estrés moderado";
    recommendations.push("Déficit significativo. Programar riego en las próximas 48h.");
  } else if (avgNeed > 1) {
    urgency = "low";
    nextIrrigation = "Hoy";
    cropStatus = "Normal";
    recommendations.push(
      `Riego recomendado hoy: ${avgNeed.toFixed(1)} mm netos`
    );
  } else if (avgNeed > 0.2) {
    urgency = "none";
    nextIrrigation = "3-4 días";
    cropStatus = "Óptimo";
    recommendations.push(
      "Reserva hídrica adecuada. Lluvia efectiva cubre necesidades actuales."
    );
  } else {
    urgency = "none";
    nextIrrigation = "Sin riesgo";
    cropStatus = "Sobrando agua";
    recommendations.push("Sin necesidad de riego. Agua de lluvia suficiente.");
  }

  if (deficit7Days < 0) {
    recommendations.push(
      "Exceso de lluvia acumulado. Verificar drenaje del suelo."
    );
  }

  const irrigationEfficiency = irrSystem.efficiency / 100;
  const grossDose = avgNeed / irrigationEfficiency;
  const totalVolumeM3 = avgNeed * areaHa * 10;

  return {
    etc: avgEtc,
    irrigationNeed: avgNeed,
    effectiveRainfall: effectiveRainTotal / weatherData.length,
    totalVolume: totalVolumeM3,
    deficit7Days,
    nextIrrigation,
    urgency,
    cropStatus,
    recommendations,
  };
}

export function calculateEt0PenmanMonteith(
  temperature: number,
  humidity: number,
  windSpeed: number,
  solarRadiation: number,
  pressure: number = 1013
): number {
  const T = temperature;
  const RH = humidity;
  const u2 = windSpeed;
  const Rs = solarRadiation;
  const P = pressure / 1013;

  const delta =
    4098 *
    (0.6108 * Math.exp((17.27 * T) / (T + 237.3))) /
    Math.pow(T + 237.3, 2);

  const gamma = 0.063 * P;
  const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
  const ea = es * (RH / 100);
  const Rns = (1 - 0.23) * Rs * 0.0864;
  const Rnl = 0.5 * (1 - 0.00005 * Math.pow(Rs, 0.5));
  const Rn = Math.max(0, Rns - Rnl);

  const et0 =
    (0.408 * delta * Rn + gamma * ((900 / (T + 273)) * u2 * (es - ea))) /
    (delta + gamma * (1 + 0.34 * u2));

  return Math.max(0.5, et0);
}

export interface SensorIndices {
  cwsi: number;
  vpd: number;
  deltaT: number;
  cwsiStatus: string;
  vpdStatus: string;
  deltaTStatus: string;
  recommendation: string;
}

export function calculateSensorIndices(
  ambientTemp: number,
  ambientHumidity: number,
  leafTemp: number
): SensorIndices {
  const T = ambientTemp;
  const RH = ambientHumidity;

  const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3));
  const ea = es * (RH / 100);
  const vpd = es - ea;

  const deltaT = leafTemp - T;

  const dT_NWBS = -1.5;
  const dT_ULS = 2.5;
  const cwsi = Math.min(1, Math.max(0, (deltaT - dT_NWBS) / (dT_ULS - dT_NWBS)));

  let cwsiStatus = "Sin estrés";
  if (cwsi >= 0.5) cwsiStatus = "Estrés severo";
  else if (cwsi >= 0.3) cwsiStatus = "Estrés moderado";
  else if (cwsi >= 0.15) cwsiStatus = "Estrés leve";

  let vpdStatus = "Óptimo";
  if (vpd < 0.5) vpdStatus = "Bajo - riesgo fúngico";
  else if (vpd > 2.0) vpdStatus = "Muy alto - estrés hídrico";
  else if (vpd > 1.0) vpdStatus = "Alto";

  let deltaTStatus = "Normal";
  if (deltaT > 3) deltaTStatus = "Estrés térmico";
  else if (deltaT > 1.5) deltaTStatus = "Calor foliar";

  let recommendation = "";
  if (cwsi >= 0.5 || vpd > 2.0) {
    recommendation = "Iniciar riego inmediatamente";
  } else if (cwsi >= 0.3 || vpd > 1.0) {
    recommendation = "Riego recomendado en 24h";
  } else if (cwsi < 0.15 && vpd < 1.0) {
    recommendation = "Planta bien hidratada";
  } else {
    recommendation = "Monitorear en 48h";
  }

  return {
    cwsi: Math.round(cwsi * 100) / 100,
    vpd: Math.round(vpd * 1000) / 1000,
    deltaT: Math.round(deltaT * 10) / 10,
    cwsiStatus,
    vpdStatus,
    deltaTStatus,
    recommendation,
  };
}

export function getSoilCapacity(soilId: string): SoilData {
  return SOILS[soilId] || SOILS.loam;
}

export function getCropInfo(cropId: string): CropData {
  return CROPS[cropId] || CROPS.olive;
}

const CROP_NAME_MAP: [RegExp, string][] = [
  [/olivo/i, "olive"],
  [/almendr/i, "almond"],
  [/vitis|vid|uva/i, "vineyard"],
  [/aguacate/i, "avocado"],
  [/citrus|naran|limon/i, "citrus"],
  [/hort/i, "vegetable"],
  [/cereal/i, "cereal"],
  [/pistach/i, "pistachio"],
  [/higuera/i, "vineyard"],
  [/granado/i, "olive"],
  [/mango/i, "avocado"],
  [/chirimoyo/i, "avocado"],
  [/frutal/i, "olive"],
];

export function mapCropType(raw: string): string {
  for (const [re, id] of CROP_NAME_MAP) {
    if (re.test(raw)) return id;
  }
  return "olive";
}

const IRRIGATION_NAME_MAP: Record<string, string> = {
  goteo: "drip",
  aspersion: "sprinkler",
  gravedad: "flood",
  subterraneo: "subsurface",
  manual: "drip",
  sin_sistema: "drip",
};

export function mapIrrigationType(raw: string | null | undefined): string {
  if (!raw) return "drip";
  return IRRIGATION_NAME_MAP[raw.toLowerCase()] || "drip";
}

const CROP_SEASON_PHASES: Record<string, [number, number, number]> = {
  olive:    [3, 9, 12],
  almond:   [3, 7, 10],
  vineyard: [4, 8, 11],
  citrus:   [3, 9, 12],
  avocado:  [3, 9, 12],
  vegetable:[4, 8, 10],
  cereal:   [1, 5, 7],
  pistachio:[4, 8, 11],
};

export function getKcForDate(cropId: string, date: Date = new Date()): number {
  const crop = CROPS[cropId];
  if (!crop) return 0.65;
  const months = CROP_SEASON_PHASES[cropId];
  if (!months) return crop.kc[1];
  const m = date.getMonth() + 1;
  if (m <= months[0]) return crop.kc[0];
  if (m <= months[1]) return crop.kc[1];
  return crop.kc[2];
}