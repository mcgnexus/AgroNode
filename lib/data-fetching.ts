import { prisma } from "@/lib/prisma";
import { getNodesWithLatestReading, getNodeReadings } from "@/lib/iot-db";

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
    },
  });

  if (parcels.length === 0) return [];

  const parcelIds = parcels.map((p) => p.id);

  const lastReadings = await prisma.sensorData.findMany({
    where: { parcelId: { in: parcelIds } },
    orderBy: { timestamp: "desc" },
    distinct: ["parcelId"],
    select: { parcelId: true, timestamp: true },
  });

  const readingsMap = new Map(lastReadings.map((r) => [r.parcelId, r.timestamp]));

  return parcels.map((p) => ({
    id: p.id,
    name: p.name,
    cropType: p.cropType,
    latitude: p.latitude,
    longitude: p.longitude,
    totalReadings: p._count.sensorData,
    lastReadingAt: readingsMap.get(p.id) ?? null,
  }));
}

export async function getLatestSensorData(
  parcelId: string
): Promise<SensorReading | null> {
  const sensorData = await prisma.sensorData.findFirst({
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

  if (sensorData) return sensorData;

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { nodeCode: true },
  });

  if (parcel?.nodeCode) {
    const nodes = await getNodesWithLatestReading();
    const node = nodes.find((n) => n.node_code === parcel.nodeCode && n.sensor_readings.length > 0);
    if (node) {
      const r = node.sensor_readings[0];
      return {
        id: r.id.toString(),
        timestamp: typeof r.measured_at === "string" ? new Date(r.measured_at) : r.measured_at,
        ambientTemp: r.air_temp_c ?? 0,
        ambientHumidity: r.air_humidity_pct ?? 0,
        atmosphericPressure: r.pressure_hpa ?? 0,
        leafTemp: r.leaf_temp_c ?? 0,
        soilHumidity: r.soil_moisture_pct ?? 0,
        batteryLevel: r.battery_v ?? 0,
        rssi: r.rssi_dbm ?? 0,
      };
    }
  }

  return null;
}

export async function get24HourSensorHistory(
  parcelId: string
): Promise<SensorReading[]> {
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const history = await prisma.sensorData.findMany({
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

  if (history.length > 0) return history;

  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { nodeCode: true },
  });

  if (parcel?.nodeCode) {
    const iotReadings = await getNodeReadings(parcel.nodeCode, 100);
    if (iotReadings.length > 0) {
      return iotReadings.map((r) => ({
        id: r.id.toString(),
        timestamp: typeof r.measured_at === "string" ? new Date(r.measured_at) : r.measured_at,
        ambientTemp: r.air_temp_c ?? 0,
        ambientHumidity: r.air_humidity_pct ?? 0,
        atmosphericPressure: r.pressure_hpa ?? 0,
        leafTemp: r.leaf_temp_c ?? 0,
        soilHumidity: r.soil_moisture_pct ?? 0,
        batteryLevel: r.battery_v ?? 0,
        rssi: r.rssi_dbm ?? 0,
      }));
    }
  }

  return [];
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
