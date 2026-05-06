import { prisma } from "@/lib/prisma";
import { mapCropType } from "@/lib/services/irrigation.service";
import {
  evaluateWeatherAlerts,
  type DailyForecastInput,
  type HourlyForecastInput,
  type StationRecentInput,
  type WeatherAlert,
  type WeatherAlertResult,
} from "@/lib/services/weather-alerts.service";

export interface ParcelWeatherAlertEvaluation {
  parcelId: string;
  parcelName: string;
  cropId: string;
  cropName: string;
  zoneLabel: string;
  result: WeatherAlertResult;
  highAlerts: WeatherAlert[];
}

function toIsoDay(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildRecentWeatherFromForecasts(
  dailyForecasts: DailyForecastInput[],
  hourlyForecasts: HourlyForecastInput[]
): StationRecentInput[] {
  if (dailyForecasts.length === 0) return [];

  const hourlyByDay = new Map<string, { humidity: number[]; wind: number[] }>();
  for (const h of hourlyForecasts) {
    const key = h.date.split("T")[0];
    const bucket = hourlyByDay.get(key) ?? { humidity: [], wind: [] };
    if (typeof h.humidity === "number") bucket.humidity.push(h.humidity);
    if (typeof h.windSpeed === "number") bucket.wind.push(h.windSpeed);
    hourlyByDay.set(key, bucket);
  }

  const avg = (arr: number[], fallback: number): number =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback;

  return dailyForecasts.slice(0, 7).map((d) => {
    const key = d.date.split("T")[0];
    const hourly = hourlyByDay.get(key);
    const expectedRainMm = Math.max(0, Math.min(100, d.precipitationProb)) / 100 * 2;
    return {
      date: d.date,
      et0: d.et0,
      precipitation: expectedRainMm,
      temperature: (d.maxTemp + d.minTemp) / 2,
      humidity: hourly ? avg(hourly.humidity, 60) : 60,
      windSpeed: hourly ? avg(hourly.wind, 2) : 2,
    };
  });
}

export async function evaluateParcelWeatherAlerts(parcelId: string): Promise<ParcelWeatherAlertEvaluation | null> {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: {
      id: true,
      name: true,
      cropType: true,
      latitude: true,
      longitude: true,
      zone: true,
      microclimate: true,
      municipioNombre: true,
    },
  });

  if (!parcel) return null;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const [forecastRows, hourlyRows, latestSensor] = await Promise.all([
    prisma.weatherForecast.findMany({
      where: { parcelId, forecastDate: { gte: yesterday } },
      orderBy: { forecastDate: "asc" },
      take: 10,
    }),
    prisma.aemetHourlyForecast.findMany({
      where: { parcelId, forecastDate: { gte: yesterday } },
      orderBy: [{ forecastDate: "asc" }, { hour: "asc" }],
      take: 240,
    }),
    prisma.sensorData.findFirst({
      where: { parcelId },
      orderBy: { timestamp: "desc" },
      select: {
        ambientTemp: true,
        ambientHumidity: true,
        soilHumidity: true,
      },
    }),
  ]);

  const dailyForecasts: DailyForecastInput[] = forecastRows.map((f) => ({
    date: f.forecastDate.toISOString(),
    maxTemp: f.maxTemp,
    minTemp: f.minTemp,
    precipitationProb: f.precipitationProb,
    et0: f.et0,
    source: f.source,
  }));

  const hourlyForecasts: HourlyForecastInput[] = hourlyRows.map((h) => ({
    date: h.forecastDate.toISOString(),
    hour: h.hour,
    temperature: h.temperature,
    humidity: h.humidity,
    windSpeed: h.windSpeed,
    precipitationProb: h.precipitationProb,
  }));

  const recentStationWeather = buildRecentWeatherFromForecasts(dailyForecasts, hourlyForecasts);
  const cropId = mapCropType(parcel.cropType);

  const result = evaluateWeatherAlerts({
    cropId,
    cropName: parcel.cropType,
    parcelZone: parcel.zone,
    microclimate: parcel.microclimate,
    municipioNombre: parcel.municipioNombre,
    latitude: parcel.latitude,
    longitude: parcel.longitude,
    dailyForecasts,
    hourlyForecasts,
    recentStationWeather,
    latestSensor: latestSensor
      ? {
          ambientTemp: latestSensor.ambientTemp,
          ambientHumidity: latestSensor.ambientHumidity,
          soilHumidity: latestSensor.soilHumidity,
        }
      : null,
  });

  return {
    parcelId: parcel.id,
    parcelName: parcel.name,
    cropId: result.cropId,
    cropName: result.cropName,
    zoneLabel: result.zoneLabel,
    result,
    highAlerts: result.alerts.filter((a) => a.severity === "high"),
  };
}

export function buildAlertSignature(alerts: WeatherAlert[]): string {
  return alerts
    .map((a) => `${a.id}:${a.triggerValue ?? ""}`)
    .sort()
    .join("|");
}

export function formatAlertDate(date = new Date()): string {
  return toIsoDay(date);
}
