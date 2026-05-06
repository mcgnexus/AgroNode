"use client";

import { useMemo, useState } from "react";
import {
  calculateSensorIndices,
  calculateIrrigationNeed,
  WeatherForIrrig,
  CROPS,
  IRRIGATION_SYSTEMS,
} from "@/lib/services/irrigation.service";

interface WeatherPoint {
  date: string;
  et0: number;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
}

interface IrrigationSource {
  label: string;
  stationName?: string;
  data: WeatherPoint[];
}

interface IrrigationWidgetProps {
  sources: {
    ria: IrrigationSource;
    siar: IrrigationSource;
    aemet: IrrigationSource;
    openmeteo: IrrigationSource;
  };
  cropType: string;
  currentKc: number;
  area: number;
  irrigationType: string;
  latestSensor?: {
    ambientTemp: number;
    ambientHumidity: number;
    leafTemp: number;
  } | null;
}

type SourceKey = "ria" | "siar" | "aemet" | "openmeteo";

function computeResult(weatherData: WeatherPoint[], cropType: string, currentKc: number, area: number, irrigationType: string) {
  if (!weatherData || weatherData.length === 0) return null;

  const weatherForCalc: WeatherForIrrig[] = weatherData.map((w) => ({
    temperature: w.temperature,
    humidity: w.humidity,
    windSpeed: w.windSpeed ?? 2,
    precipitation: w.precipitation,
    et0: w.et0,
    date: new Date(w.date),
  }));

  return calculateIrrigationNeed(weatherForCalc, cropType, currentKc, area, irrigationType);
}

export default function IrrigationCalculator({
  sources,
  cropType,
  currentKc,
  area,
  irrigationType,
  latestSensor,
}: IrrigationWidgetProps) {
  const available: SourceKey[] = (["ria", "siar", "aemet", "openmeteo"] as SourceKey[]).filter(
    (k) => sources[k].data.length > 0
  );
  const [active, setActive] = useState<SourceKey>(available[0] ?? "ria");

  const result = useMemo(
    () => computeResult(sources[active].data, cropType, currentKc, area, irrigationType),
    [sources, active, cropType, currentKc, area, irrigationType]
  );

  const sensorIndices = useMemo(() => {
    if (!latestSensor) return null;
    return calculateSensorIndices(
      latestSensor.ambientTemp,
      latestSensor.ambientHumidity,
      latestSensor.leafTemp
    );
  }, [latestSensor]);

  const crop = CROPS[cropType] || CROPS.olive;
  const irrSystem = IRRIGATION_SYSTEMS[irrigationType] || IRRIGATION_SYSTEMS.drip;

  if (available.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Calculadora de Riego
        </h3>
        <p className="text-sm text-zinc-500">Sin datos meteorológicos disponibles</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Calculadora de Riego
        </h3>
        <p className="text-sm text-zinc-500">Sin datos para la fuente seleccionada</p>
      </div>
    );
  }

  const urgencyColor =
    result.urgency === "high"
      ? "text-red-600"
      : result.urgency === "medium"
      ? "text-amber-600"
      : result.urgency === "low"
      ? "text-yellow-600"
      : "text-green-600";

  const source = sources[active];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Calculadora de Riego
        </h3>
        <div className="flex gap-1">
          {available.map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                active === key
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {sources[key].label}
            </button>
          ))}
        </div>
      </div>

      {source.stationName && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Estación
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {source.stationName} &middot; {source.data.length} días
          </span>
        </div>
      )}

      {!source.stationName && (
        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          Datos de pronóstico ({source.data.length} días) &middot; Precipitación estimada
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
          <p className="text-xs text-green-700 dark:text-green-400">ETc (cultivo)</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            {result.etc.toFixed(2)}
            <span className="text-xs font-normal"> mm/d</span>
          </p>
          <p className="text-xs text-green-600 dark:text-green-500">
            ET₀ × Kc ({currentKc})
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-xs text-blue-700 dark:text-blue-400">Necesidad riego</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
            {result.irrigationNeed.toFixed(2)}
            <span className="text-xs font-normal"> mm/d</span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500">
            ETc - lluvia efect.
          </p>
        </div>

        <div className="rounded-lg bg-cyan-50 p-3 dark:bg-cyan-900/20">
          <p className="text-xs text-cyan-700 dark:text-cyan-400">Volumen total</p>
          <p className="text-xl font-bold text-cyan-700 dark:text-cyan-400">
            {result.totalVolume.toFixed(1)}
            <span className="text-xs font-normal"> m³</span>
          </p>
          <p className="text-xs text-cyan-600 dark:text-cyan-500">para {area} ha</p>
        </div>

        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-xs text-amber-700 dark:text-amber-400">Déficit 7 días</p>
          <p className={`text-xl font-bold ${urgencyColor}`}>
            {result.deficit7Days.toFixed(1)}
            <span className="text-xs font-normal"> mm</span>
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Umbral: {crop.maxDeficit} mm
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Próximo riego:
          </span>
          <span className={`text-sm font-bold ${urgencyColor}`}>
            {result.nextIrrigation}
          </span>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Cultivo:</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {crop.nameEs}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Sistema:</span>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {irrSystem.nameEs} ({irrSystem.efficiency}%)
          </span>
        </div>
      </div>

      {result.recommendations.length > 0 && (
        <div className="space-y-2">
          {result.recommendations.map((rec, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 text-sm ${
                rec.includes("urgente") || rec.includes("URGENTE")
                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : rec.includes("exceso")
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                  : "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              }`}
            >
              {rec}
            </div>
          ))}
        </div>
      )}

      {sensorIndices && (
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Índices del sensor (ESP32)
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500">CWSI</p>
              <p
                className={`text-lg font-bold ${
                  sensorIndices.cwsi >= 0.5
                    ? "text-red-600"
                    : sensorIndices.cwsi >= 0.3
                    ? "text-amber-600"
                    : "text-green-600"
                }`}
              >
                {sensorIndices.cwsi}
              </p>
              <p className="text-xs text-zinc-500">{sensorIndices.cwsiStatus}</p>
            </div>

            <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500">VPD</p>
              <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
                {sensorIndices.vpd}
                <span className="text-xs font-normal"> kPa</span>
              </p>
              <p className="text-xs text-zinc-500">{sensorIndices.vpdStatus}</p>
            </div>

            <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
              <p className="text-xs text-zinc-500">ΔT hoja-aire</p>
              <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
                {sensorIndices.deltaT}
                <span className="text-xs font-normal"> °C</span>
              </p>
              <p className="text-xs text-zinc-500">{sensorIndices.deltaTStatus}</p>
            </div>
          </div>

          <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {sensorIndices.recommendation}
          </div>
        </div>
      )}
    </div>
  );
}
