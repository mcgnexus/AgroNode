import { prisma } from "@/lib/prisma";

export interface ParcelSummary {
  id: string;
  name: string;
  cropType: string;
  latitude: number;
  longitude: number;
}

export interface SensorReading {
  id: string;
  timestamp: Date;
  ambientTemp: number;
  ambientHumidity: number;
  atmosphericPressure: number;
  leafTemp: number;
  soilHumidity: number;
  batteryLevel: number | null;
  rssi: number | null;
}

export interface ForecastDay {
  id: string;
  forecastDate: Date;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
  source: string;
}

export interface AemetHourlyReading {
  id: string;
  municipioId: string;
  municipioNombre: string;
  forecastDate: Date;
  hour: number;
  temperature: number | null;
  precipitationProb: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  skyState: string | null;
}

export async function getDefaultParcel(): Promise<ParcelSummary | null> {
  const parcel = await prisma.parcel.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      cropType: true,
      latitude: true,
      longitude: true,
    },
  });
  return parcel;
}

export async function getAllParcels(): Promise<
  (ParcelSummary & { totalReadings: number; lastReadingAt: Date | null })[]
> {
  const parcels = await prisma.parcel.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      cropType: true,
      latitude: true,
      longitude: true,
      _count: { select: { sensorData: true } },
      sensorData: { orderBy: { timestamp: "desc" }, take: 1, select: { timestamp: true } },
    },
  });

  return parcels.map((p) => ({
    id: p.id,
    name: p.name,
    cropType: p.cropType,
    latitude: p.latitude,
    longitude: p.longitude,
    totalReadings: p._count.sensorData,
    lastReadingAt: p.sensorData[0]?.timestamp ?? null,
  }));
}

export async function getLatestSensorData(
  parcelId: string
): Promise<SensorReading | null> {
  return prisma.sensorData.findFirst({
    where: { parcelId },
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      timestamp: true,
      ambientTemp: true,
      ambientHumidity: true,
      atmosphericPressure: true,
      leafTemp: true,
      soilHumidity: true,
      batteryLevel: true,
      rssi: true,
    },
  });
}

export async function get24HourSensorHistory(
  parcelId: string
): Promise<SensorReading[]> {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  return prisma.sensorData.findMany({
    where: { parcelId, timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    select: {
      id: true,
      timestamp: true,
      ambientTemp: true,
      ambientHumidity: true,
      atmosphericPressure: true,
      leafTemp: true,
      soilHumidity: true,
      batteryLevel: true,
      rssi: true,
    },
  });
}

export async function getWeeklyForecast(
  parcelId: string
): Promise<ForecastDay[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.weatherForecast.findMany({
    where: { parcelId, forecastDate: { gte: today } },
    orderBy: [{ forecastDate: "asc" }, { source: "asc" }],
    take: 14,
    select: {
      id: true,
      forecastDate: true,
      maxTemp: true,
      minTemp: true,
      precipitationProb: true,
      et0: true,
      source: true,
    },
  });
}

export async function getAemetHourlyForecast(
  parcelId: string
): Promise<{ data: AemetHourlyReading[]; municipio: { id: string; nombre: string } | null }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hourlyData = await prisma.aemetHourlyForecast.findMany({
    where: { parcelId, forecastDate: { gte: today } },
    orderBy: [{ forecastDate: "asc" }, { hour: "asc" }],
    select: {
      id: true,
      municipioId: true,
      municipioNombre: true,
      forecastDate: true,
      hour: true,
      temperature: true,
      precipitationProb: true,
      humidity: true,
      windSpeed: true,
      windDirection: true,
      skyState: true,
    },
  });

  if (hourlyData.length === 0) {
    return { data: [], municipio: null };
  }

  const municipio = {
    id: hourlyData[0].municipioId,
    nombre: hourlyData[0].municipioNombre,
  };

  return { data: hourlyData, municipio };
}
