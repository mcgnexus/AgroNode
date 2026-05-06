"use client";

import { useState, useEffect } from "react";

interface StationData {
  station: {
    id: string;
    nombre: string;
    latitud: number;
    longitud: number;
    altitud: number;
  } | null;
  data: {
    date: string;
    maxTemp: number | null;
    minTemp: number | null;
    avgTemp: number | null;
    avgHumidity: number | null;
    precipitation: number | null;
    windSpeed: number | null;
    solarRadiation: number | null;
    et0: number | null;
  }[];
  error: string | null;
}

interface StationWidgetProps {
  parcelId: string;
}

export default function StationWidget({ parcelId }: StationWidgetProps) {
  const [data, setData] = useState<{
    siar: StationData | null;
    ria: StationData | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"siar" | "ria">("ria");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/parcels/${parcelId}/weather/stations`
        );
        if (response.ok) {
          const result = await response.json();
          setData(result);
          if (result.ria?.station) setActiveTab("ria");
          else if (result.siar?.station) setActiveTab("siar");
        }
      } catch (error) {
        console.error("Error fetching station data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [parcelId]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Cargando datos de estaciones SIAR/RIA...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500">Sin datos de estaciones disponibles</p>
      </div>
    );
  }

  const activeData = activeTab === "siar" ? data.siar : data.ria;
  const hasSiar = data.siar?.station && data.siar.data.length > 0;
  const hasRia = data.ria?.station && data.ria.data.length > 0;

  if (!hasSiar && !hasRia) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Estaciones SIAR / RIA
        </h3>
        <div className="space-y-2">
          {data.siar?.error && (
            <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              SIAR: {data.siar.error}
            </div>
          )}
          {data.ria?.error && (
            <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              RIA: {data.ria.error}
            </div>
          )}
          {!data.siar?.error && !data.ria?.error && (
            <p className="text-sm text-zinc-500">No se encontraron estaciones cercanas</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Estaciones Agroclimáticas
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("ria")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              activeTab === "ria"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            } ${!hasRia ? "opacity-40 cursor-not-allowed" : ""}`}
            disabled={!hasRia}
          >
            RIA Andalucía
          </button>
          <button
            onClick={() => setActiveTab("siar")}
            className={`rounded-md px-3 py-1 text-xs font-medium ${
              activeTab === "siar"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            } ${!hasSiar ? "opacity-40 cursor-not-allowed" : ""}`}
            disabled={!hasSiar}
          >
            SIAR
          </button>
        </div>
      </div>

      {activeData?.station && (
        <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {activeData.station.nombre}
              </p>
              <p className="text-xs text-zinc-500">
                Altitud: {activeData.station.altitud}m · Lat:{" "}
                {activeData.station.latitud.toFixed(4)} · Lon:{" "}
                {activeData.station.longitud.toFixed(4)}
              </p>
            </div>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {activeTab === "ria" ? "RIA" : "SIAR"}
            </span>
          </div>
        </div>
      )}

      {activeData?.data && activeData.data.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Fecha</span>
            <span>Temp (°C)</span>
            <span>Lluvia (mm)</span>
            <span>ET₀ (mm)</span>
          </div>
          {activeData.data.slice(0, 7).map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-2 rounded-lg bg-zinc-50 p-2 text-sm dark:bg-zinc-800"
            >
              <span className="text-zinc-600 dark:text-zinc-400">
                {row.date?.slice(0, 10) ?? "—"}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {row.maxTemp != null && row.minTemp != null
                  ? `${row.maxTemp.toFixed(1)}/${row.minTemp.toFixed(1)}`
                  : "—"}
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                {row.precipitation != null
                  ? row.precipitation.toFixed(1)
                  : "—"}
              </span>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {row.et0 != null ? row.et0.toFixed(2) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {activeData?.error && (
        <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          {activeData.error}
        </div>
      )}
    </div>
  );
}