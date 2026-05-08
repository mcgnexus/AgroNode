import { notFound } from "next/navigation";
import Link from "next/link";
import NavHeader from "@/app/components/nav-header";
import StatCard from "@/app/components/stat-card";
import SensorChart from "@/app/components/sensor-chart";
import WeatherCard from "@/app/components/weather-card";
import AemetHourlySection from "@/app/components/dashboard/aemet-hourly-section";
import IrrigationCalculator from "@/app/components/dashboard/irrigation-calculator";
import StationWidget from "@/app/components/dashboard/station-widget";
import WeatherAlerts from "@/app/components/dashboard/weather-alerts";
import RaifAlerts from "@/app/components/dashboard/raif-alerts";
import AiChat from "@/app/components/ai-chat";
import { prisma } from "@/lib/prisma";
import { getNodeReadings, getNodeReadingCount } from "@/lib/iot-db";
import { syncRiaDataForParcel } from "@/lib/services/ria.service";
import { isSiarEnabled, syncSiarDataForParcel } from "@/lib/services/siar.service";
import { mapCropType, mapIrrigationType, getKcForDate } from "@/lib/services/irrigation.service";
import { evaluateWeatherAlerts } from "@/lib/services/weather-alerts.service";
import { evaluateRaifAlertsForParcel } from "@/lib/services/raif-alert-agent.service";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

function DetailIcon({ name, className = "h-4 w-4" }: { name: "back" | "parcel" | "crop" | "location" | "reading" | "forecast" | "ai"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "back" && <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>}
      {name === "parcel" && <><path d="M3 20h18" /><path d="M5 20V8l7-4 7 4v12" /><path d="M9 20v-6h6v6" /></>}
      {name === "crop" && <><path d="M5 19c9.5.5 14-5 14-14-9 0-14 4.5-14 14Z" /><path d="M5 19 15 9" /></>}
      {name === "location" && <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>}
      {name === "reading" && <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 4-7" /></>}
      {name === "forecast" && <><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.3 2" /><path d="M6 19h11.5" /></>}
      {name === "ai" && <><path d="M12 3v3" /><path d="M12 18v3" /><path d="M5.6 5.6 7.8 7.8" /><path d="M16.2 16.2l2.2 2.2" /><circle cx="12" cy="12" r="4" /></>}
    </svg>
  );
}

function CountPill({ icon, label }: { icon: Parameters<typeof DetailIcon>[0]["name"]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-300 dark:ring-zinc-800 sm:text-xs">
      <DetailIcon name={icon} className="h-3.5 w-3.5" />{label}
    </span>
  );
}

export default async function ParcelDetailPage({ params }: Props) {
  const { id } = await params;

  const parcel = await prisma.parcel.findUnique({
    where: { id },
    include: {
      sensorData: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
      _count: { select: { sensorData: true, weatherForecasts: true, aiInteractionLogs: true } },
    },
  });

  if (!parcel) notFound();

  const since48h = new Date();
  since48h.setHours(since48h.getHours() - 48);

  let sensorHistory = await prisma.sensorData.findMany({
    where: { parcelId: id, timestamp: { gte: since48h } },
    orderBy: { timestamp: "asc" },
  });

  // Fallback a lecturas IoT del nodo vinculado a esta parcela
  if (sensorHistory.length === 0 && parcel.nodeCode) {
    const iotReadings = await getNodeReadings(parcel.nodeCode, 100);
    sensorHistory = iotReadings.map((r) => ({
      id: r.id.toString(),
      parcelId: id,
      timestamp: typeof r.measured_at === "string" ? new Date(r.measured_at) : r.measured_at,
      ambientTemp: r.air_temp_c ?? 0,
      ambientHumidity: r.air_humidity_pct ?? 0,
      atmosphericPressure: r.pressure_hpa ?? 0,
      leafTemp: r.leaf_temp_c ?? 0,
      soilHumidity: r.soil_moisture_pct ?? 0,
      batteryLevel: r.battery_v ?? null,
      rssi: r.rssi_dbm ?? null,
      createdAt: new Date(),
    }));
  }

  let iotReadingsCount = 0;
  if (parcel.nodeCode && parcel._count.sensorData === 0) {
    iotReadingsCount = await getNodeReadingCount(parcel.nodeCode);
  }

  const latest = parcel.sensorData[0] ?? (sensorHistory.length > 0 ? sensorHistory[sensorHistory.length - 1] : null);

  const forecasts = await prisma.weatherForecast.findMany({
    where: { parcelId: id },
    orderBy: { forecastDate: "asc" },
  });

  const chartData = sensorHistory.map((s) => ({
    timestamp: s.timestamp.toISOString(),
    ambientTemp: s.ambientTemp,
    ambientHumidity: s.ambientHumidity,
    soilHumidity: s.soilHumidity,
    leafTemp: s.leafTemp,
    atmosphericPressure: s.atmosphericPressure,
  }));

  const forecastData = forecasts.map((f) => ({
    forecastDate: f.forecastDate.toISOString(),
    maxTemp: f.maxTemp,
    minTemp: f.minTemp,
    precipitationProb: f.precipitationProb,
    et0: f.et0,
    source: f.source,
  }));

  const cropId = mapCropType(parcel.cropType);
  const irrId = mapIrrigationType(parcel.irrigationType);
  const currentKc = getKcForDate(cropId);

  let siarData: Awaited<ReturnType<typeof syncSiarDataForParcel>> | null = null;
  let riaData: Awaited<ReturnType<typeof syncRiaDataForParcel>> | null = null;
  const siarEnabled = isSiarEnabled();

  if (siarEnabled) {
    try {
      siarData = await syncSiarDataForParcel(parcel.latitude, parcel.longitude);
    } catch (error) {
      console.error("Error syncing SIAR data:", error);
    }
  }

  try {
    riaData = await syncRiaDataForParcel(parcel.latitude, parcel.longitude);
  } catch (error) {
    console.error("Error syncing RIA data:", error);
  }

  const riaStation = riaData?.station ? riaData : null;
  const siarStation = siarData?.station ? siarData : null;

  const riaWeather = riaStation?.dailyData
    .filter((d) => d.et0 != null || d.precipitation != null)
    .map((d) => ({
      date: d.date,
      et0: d.et0 ?? 0,
      temperature: d.avgTemp ?? (d.maxTemp != null && d.minTemp != null ? (d.maxTemp + d.minTemp) / 2 : 20),
      humidity: d.avgHumidity ?? 60,
      precipitation: d.precipitation ?? 0,
      windSpeed: d.windSpeed ?? 2,
    })) ?? [];

  const siarWeather = siarStation?.dailyData
    .filter((d) => d.et0 != null || d.precipitation != null)
    .map((d) => ({
      date: d.date,
      et0: d.et0 ?? 0,
      temperature: d.avgTemp ?? (d.maxTemp != null && d.minTemp != null ? (d.maxTemp + d.minTemp) / 2 : 20),
      humidity: d.avgHumidity ?? 60,
      precipitation: d.precipitation ?? 0,
      windSpeed: d.windSpeed ?? 2,
    })) ?? [];

  const aemetForecasts = forecasts.filter((f) => f.source === "aemet");
  const openmeteoForecasts = forecasts.filter((f) => f.source === "open-meteo");

  const aemetHourly = await prisma.aemetHourlyForecast.findMany({
    where: { parcelId: id },
    orderBy: [{ forecastDate: "asc" }, { hour: "asc" }],
  });

  const aemetHourlyByDate = new Map<string, { humidity: number[]; windSpeed: number[]; precipProb: number[] }>();
  for (const h of aemetHourly) {
    const key = h.forecastDate.toISOString().split("T")[0];
    if (!aemetHourlyByDate.has(key)) aemetHourlyByDate.set(key, { humidity: [], windSpeed: [], precipProb: [] });
    const entry = aemetHourlyByDate.get(key)!;
    if (h.humidity != null) entry.humidity.push(h.humidity);
    if (h.windSpeed != null) entry.windSpeed.push(h.windSpeed);
    if (h.precipitationProb != null) entry.precipProb.push(h.precipitationProb);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const aemetWeather = aemetForecasts.map((f) => {
    const key = f.forecastDate.toISOString().split("T")[0];
    const hourly = aemetHourlyByDate.get(key);
    return {
      date: f.forecastDate.toISOString(),
      et0: f.et0 ?? 0,
      temperature: (f.maxTemp + f.minTemp) / 2,
      humidity: hourly ? avg(hourly.humidity) || 60 : 60,
      precipitation: hourly ? Math.max(...hourly.precipProb) * 0.3 / 100 : 0,
      windSpeed: hourly ? avg(hourly.windSpeed) || 2 : 2,
    };
  });

  const openmeteoWeather = openmeteoForecasts.map((f) => ({
    date: f.forecastDate.toISOString(),
    et0: f.et0 ?? 0,
    temperature: (f.maxTemp + f.minTemp) / 2,
    humidity: 60,
    precipitation: (f.precipitationProb ?? 0) * 0.3 / 100,
    windSpeed: 2,
  }));

  const irrigationSources = {
    ria: {
      label: "RIA",
      stationName: riaStation?.station?.nombre ? `RIA: ${riaStation.station.nombre}` : undefined,
      data: riaWeather,
    },
    siar: {
      label: "SIAR",
      stationName: siarStation?.station?.nombre ? `SIAR: ${siarStation.station.nombre}` : undefined,
      data: siarWeather,
    },
    aemet: {
      label: "AEMET",
      data: aemetWeather,
    },
    openmeteo: {
      label: "Open-Meteo",
      data: openmeteoWeather,
    },
  };

  const weatherAlertResult = evaluateWeatherAlerts({
    cropId,
    cropName: parcel.cropType,
    parcelZone: parcel.zone,
    microclimate: parcel.microclimate,
    municipioNombre: parcel.municipioNombre,
    latitude: parcel.latitude,
    longitude: parcel.longitude,
    dailyForecasts: forecasts.map((f) => ({
      date: f.forecastDate.toISOString(),
      maxTemp: f.maxTemp,
      minTemp: f.minTemp,
      precipitationProb: f.precipitationProb,
      et0: f.et0,
      source: f.source,
    })),
    hourlyForecasts: aemetHourly.map((h) => ({
      date: h.forecastDate.toISOString(),
      hour: h.hour,
      temperature: h.temperature,
      humidity: h.humidity,
      windSpeed: h.windSpeed,
      precipitationProb: h.precipitationProb,
    })),
    recentStationWeather: (riaWeather.length > 0 ? riaWeather : siarWeather).map((d) => ({
      date: d.date,
      et0: d.et0,
      precipitation: d.precipitation,
      temperature: d.temperature,
      humidity: d.humidity,
      windSpeed: d.windSpeed,
    })),
    latestSensor: latest
      ? {
          ambientTemp: latest.ambientTemp,
          ambientHumidity: latest.ambientHumidity,
          soilHumidity: latest.soilHumidity,
        }
      : null,
  });

  let raifAlertResult: Awaited<ReturnType<typeof evaluateRaifAlertsForParcel>> | null = null;
  try {
    raifAlertResult = await evaluateRaifAlertsForParcel(parcel.id);
  } catch (error) {
    console.error("Error evaluating RAIF alerts:", error);
  }

  return (
    <>
      <NavHeader />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <div className="mb-6 overflow-hidden rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-cyan-50 p-4 dark:border-green-950/40 dark:from-green-950/30 dark:via-zinc-950 dark:to-cyan-950/20 sm:p-5">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400 sm:text-sm"
          >
            <DetailIcon name="back" className="h-4 w-4" />
            Volver al Dashboard
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm sm:h-12 sm:w-12">
                <DetailIcon name="parcel" className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
                  {parcel.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  <span className="inline-flex items-center gap-1"><DetailIcon name="crop" className="h-4 w-4" />{parcel.cropType}</span>
                  <span className="inline-flex items-center gap-1"><DetailIcon name="location" className="h-4 w-4" />{parcel.latitude}°N, {Math.abs(parcel.longitude)}°O</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CountPill icon="reading" label={`${iotReadingsCount || parcel._count.sensorData} lecturas`} />
              <CountPill icon="forecast" label={`${parcel._count.weatherForecasts} pronósticos`} />
              <CountPill icon="ai" label={`${parcel._count.aiInteractionLogs} consultas AI`} />
            </div>
          </div>
        </div>

        <IrrigationCalculator
          sources={irrigationSources}
          cropType={cropId}
          currentKc={currentKc}
          area={1}
          irrigationType={irrId}
          latestSensor={latest ? {
            ambientTemp: latest.ambientTemp,
            ambientHumidity: latest.ambientHumidity,
            leafTemp: latest.leafTemp,
          } : null}
        />

        <WeatherAlerts result={weatherAlertResult} />
        <RaifAlerts result={raifAlertResult} />

        <StationWidget parcelId={parcel.id} />

        {latest && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Temp. Ambiente"
              value={latest.ambientTemp}
              unit="°C"
              color="bg-red-50 dark:bg-red-900/20"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                </svg>
              }
            />
            <StatCard
              label="Humedad Ambiente"
              value={latest.ambientHumidity}
              unit="%"
              color="bg-blue-50 dark:bg-blue-900/20"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              }
            />
            <StatCard
              label="Humedad Suelo"
              value={latest.soilHumidity}
              unit="%"
              color="bg-cyan-50 dark:bg-cyan-900/20"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                  <path d="M2 12h20M2 6h20M2 18h20" />
                  <path d="M6 2v20" />
                </svg>
              }
            />
            <StatCard
              label="Temp. Hoja"
              value={latest.leafTemp}
              unit="°C"
              color="bg-emerald-50 dark:bg-emerald-900/20"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" />
                </svg>
              }
            />
            <StatCard
              label="Presión"
              value={latest.atmosphericPressure}
              unit="hPa"
              color="bg-violet-50 dark:bg-violet-900/20"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              }
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-1">
          <div className="grid gap-6 lg:grid-cols-2">
            <SensorChart
              data={chartData}
              title="Temperatura (48h)"
              series={[
                { dataKey: "ambientTemp", color: "#ef4444", name: "Ambiente (°C)" },
                { dataKey: "leafTemp", color: "#10b981", name: "Hoja (°C)" },
              ]}
              yDomain={[-5, 45]}
            />
            <SensorChart
              data={chartData}
              title="Humedad (48h)"
              series={[
                { dataKey: "ambientHumidity", color: "#3b82f6", name: "Ambiente (%)" },
                { dataKey: "soilHumidity", color: "#06b6d4", name: "Suelo (%)" },
              ]}
              yDomain={[0, 100]}
            />
          </div>

          <SensorChart
            data={chartData}
            title="Presión Atmosférica (48h)"
            series={[
              { dataKey: "atmosphericPressure", color: "#8b5cf6", name: "Presión (hPa)" },
            ]}
            yDomain={[1000, 1030]}
          />

          <WeatherCard forecasts={forecastData} />
          <AemetHourlySection parcelId={parcel.id} />
        </div>
      </main>

      <AiChat parcelId={parcel.id} parcelName={parcel.name} />
    </>
  );
}
