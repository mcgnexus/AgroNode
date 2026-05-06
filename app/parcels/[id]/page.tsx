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
import { syncRiaDataForParcel } from "@/lib/services/ria.service";
import { isSiarEnabled, syncSiarDataForParcel } from "@/lib/services/siar.service";
import { mapCropType, mapIrrigationType, getKcForDate } from "@/lib/services/irrigation.service";
import { evaluateWeatherAlerts } from "@/lib/services/weather-alerts.service";
import { evaluateRaifAlertsForParcel } from "@/lib/services/raif-alert-agent.service";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
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

  const sensorHistory = await prisma.sensorData.findMany({
    where: { parcelId: id, timestamp: { gte: since48h } },
    orderBy: { timestamp: "asc" },
  });

  const forecasts = await prisma.weatherForecast.findMany({
    where: { parcelId: id },
    orderBy: { forecastDate: "asc" },
  });

  const latest = parcel.sensorData[0];

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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-green-600 dark:text-zinc-400 dark:hover:text-green-400"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Volver al Dashboard
          </Link>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
                {parcel.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {parcel.cropType} &middot; {parcel.latitude}°N, {Math.abs(parcel.longitude)}°O
              </p>
            </div>
            <div className="flex gap-2 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{parcel._count.sensorData} lecturas</span>
              <span>&middot;</span>
              <span>{parcel._count.weatherForecasts} pronósticos</span>
              <span>&middot;</span>
              <span>{parcel._count.aiInteractionLogs} consultas AI</span>
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
