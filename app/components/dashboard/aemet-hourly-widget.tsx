"use client";

import { useState } from "react";

interface HourlyData {
  hour: number;
  temperature: number | null;
  precipitationProb: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  skyState: string | null;
}

interface DayData {
  date: string;
  hours: HourlyData[];
}

interface AemetHourlyProps {
  data: DayData[];
  municipio: { id: string; nombre: string } | null;
}

function getSkyEmoji(skyState: string | null): string {
  if (!skyState) return "—";
  const lower = skyState.toLowerCase();
  if (lower.includes("tormenta")) return "⛈";
  if (lower.includes("nieve")) return "🌨";
  if (lower.includes("lluvia")) return "🌧";
  if (lower.includes("niebla") || lower.includes("bruma")) return "🌫";
  if (lower.includes("cubierto") || lower.includes("muy nuboso")) return "☁";
  if (lower.includes("nuboso") || lower.includes("intervalos")) return "⛅";
  if (lower.includes("poco nuboso")) return "🌤";
  if (lower.includes("despejado")) return "☀️";
  return "🌤";
}

function formatHour(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}

function getTempColor(temp: number | null): string {
  if (temp == null) return "text-zinc-400";
  if (temp >= 35) return "text-red-600 dark:text-red-400";
  if (temp >= 25) return "text-orange-500 dark:text-orange-400";
  if (temp >= 15) return "text-emerald-600 dark:text-emerald-400";
  if (temp >= 5) return "text-cyan-600 dark:text-cyan-400";
  return "text-blue-600 dark:text-blue-400";
}

function getPrecipBarWidth(prob: number | null): string {
  if (prob == null) return "0%";
  return `${Math.min(100, prob)}%`;
}

export default function AemetHourlyWidget({ data, municipio }: AemetHourlyProps) {
  const [selectedDay, setSelectedDay] = useState(0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            AEMET Predicción Horaria
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            AEMET Oficial
          </span>
        </div>
        <p className="text-sm text-zinc-400">Sin datos horarios disponibles</p>
      </div>
    );
  }

  const currentDay = data[selectedDay];
  const displayHours = currentDay.hours.filter(h => h.temperature != null);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            AEMET Predicción Horaria
          </h3>
          {municipio && (
            <p className="mt-0.5 text-[10px] text-zinc-400">
              Municipio: {municipio.nombre}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          AEMET Oficial
        </span>
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {data.slice(0, 4).map((day, i) => (
          <button
            key={day.date}
            onClick={() => setSelectedDay(i)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              i === selectedDay
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {getDayLabel(day.date)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              <th className="pb-2 pr-3 text-left font-medium text-zinc-400">Hora</th>
              <th className="pb-2 px-2 text-center font-medium text-zinc-400">Estado</th>
              <th className="pb-2 px-2 text-right font-medium text-zinc-400">Temp</th>
              <th className="pb-2 px-2 text-center font-medium text-zinc-400">Precip.</th>
              <th className="pb-2 px-2 text-right font-medium text-zinc-400">Hum.</th>
              <th className="pb-2 pl-2 text-right font-medium text-zinc-400">Viento</th>
            </tr>
          </thead>
          <tbody>
            {displayHours.map((h) => (
              <tr key={h.hour} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800/50">
                <td className="py-1.5 pr-3 font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
                  {formatHour(h.hour)}
                </td>
                <td className="py-1.5 px-2 text-center">
                  <span title={h.skyState ?? ""}>{getSkyEmoji(h.skyState)}</span>
                </td>
                <td className={`py-1.5 px-2 text-right font-medium tabular-nums ${getTempColor(h.temperature)}`}>
                  {h.temperature != null ? `${Math.round(h.temperature)}°` : "—"}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-blue-400 dark:bg-blue-500"
                        style={{ width: getPrecipBarWidth(h.precipitationProb) }}
                      />
                    </div>
                    <span className="w-7 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {h.precipitationProb != null ? `${Math.round(h.precipitationProb)}%` : "—"}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {h.humidity != null ? `${Math.round(h.humidity)}%` : "—"}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {h.windSpeed != null ? `${Math.round(h.windSpeed)} km/h` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
