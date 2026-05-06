import { Suspense } from "react";
import Link from "next/link";
import NavHeader from "@/app/components/nav-header";
import LatestKPIs from "@/app/components/dashboard/latest-kpis";
import ForecastWidget from "@/app/components/dashboard/forecast-widget";
import SensorChartClient from "@/app/components/dashboard/sensor-chart-client";
import AiDiagnosis from "@/app/components/dashboard/ai-diagnosis";
import {
  getDefaultParcel,
  getLatestSensorData,
  get24HourSensorHistory,
  getWeeklyForecast,
} from "@/lib/data-fetching";
import AemetHourlySection from "@/app/components/dashboard/aemet-hourly-section";

export const dynamic = "force-dynamic";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-48 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

async function DashboardContent() {
  const parcel = await getDefaultParcel();

  if (!parcel) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Sin parcelas</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No hay parcelas registradas en el sistema.
          </p>
        </div>
        <code className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          npm run db:seed
        </code>
      </div>
    );
  }

  const [sensor, history, forecast] = await Promise.all([
    getLatestSensorData(parcel.id),
    get24HourSensorHistory(parcel.id),
    getWeeklyForecast(parcel.id),
  ]);

  if (!sensor) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Sin datos de sensor</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            La parcela <span className="font-medium">{parcel.name}</span> no tiene lecturas del ESP32.
          </p>
        </div>
      </div>
    );
  }

  const chartData = history.map((s) => ({
    time: s.timestamp.toISOString(),
    ambientTemp: s.ambientTemp,
    leafTemp: s.leafTemp,
    soilHumidity: s.soilHumidity,
  }));

  const lastUpdated = sensor.timestamp.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-zinc-400 transition-colors hover:text-green-600 dark:hover:text-green-400"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
              {parcel.name}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {parcel.cropType} &middot; {parcel.latitude}°N, {Math.abs(parcel.longitude)}°O &middot; Última lectura: {lastUpdated}
          </p>
        </div>
        <Link
          href={`/parcels/${parcel.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-green-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-green-400"
        >
          Ver detalle completo
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="space-y-4">
        <LatestKPIs
          data={{
            soilHumidity: sensor.soilHumidity,
            leafTemp: sensor.leafTemp,
            ambientTemp: sensor.ambientTemp,
            ambientHumidity: sensor.ambientHumidity,
          }}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SensorChartClient data={chartData} />
          </div>
          <div className="space-y-4">
            <ForecastWidget forecasts={forecast as { forecastDate: Date; maxTemp: number; minTemp: number; precipitationProb: number; et0: number; source: string }[]} />
            <AemetHourlySection parcelId={parcel.id} />
            <AiDiagnosis />
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <NavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Suspense fallback={<LoadingSkeleton />}>
          <DashboardContent />
        </Suspense>
      </main>
    </>
  );
}
