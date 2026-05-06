interface ForecastItem {
  forecastDate: Date;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
  source?: string;
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
}

function getWeatherIcon(prob: number): string {
  if (prob >= 70) return "🌧";
  if (prob >= 40) return "⛅";
  if (prob >= 20) return "🌤";
  return "☀️";
}

function getTempBarWidth(min: number, max: number): { left: string; width: string } {
  const rangeMin = 0;
  const rangeMax = 40;
  const total = rangeMax - rangeMin;
  const left = ((min - rangeMin) / total) * 100;
  const width = ((max - min) / total) * 100;
  return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` };
}

function getPrecipColor(prob: number): string {
  if (prob >= 70) return "text-blue-600 dark:text-blue-400";
  if (prob >= 40) return "text-cyan-600 dark:text-cyan-400";
  return "text-zinc-500 dark:text-zinc-400";
}

const sourceConfig: Record<string, { label: string; color: string }> = {
  "open-meteo": { label: "Open-Meteo", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  "aemet": { label: "AEMET", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const baseSource = source.startsWith("aemet") ? "aemet" : source;
  const cfg = sourceConfig[baseSource];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${baseSource === "open-meteo" ? "bg-emerald-500" : "bg-blue-500"}`} />
      {cfg.label}
    </span>
  );
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function ForecastWidget({ forecasts }: { forecasts: ForecastItem[] }) {
  if (forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pronóstico
        </h3>
        <p className="text-sm text-zinc-400">Sin datos disponibles</p>
      </div>
    );
  }

  const openMeteo = forecasts.filter(f => f.source === "open-meteo").slice(0, 3);
  const aemet = forecasts.filter(f => f.source?.startsWith("aemet")).slice(0, 3);

  const renderForecastRows = (items: ForecastItem[]) =>
    items.map((f) => {
      const bar = getTempBarWidth(f.minTemp, f.maxTemp);
      return (
        <div key={`${f.source}-${f.forecastDate.toISOString()}`} className="flex items-center gap-3">
          <span className="w-12 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {getDayLabel(f.forecastDate)}
          </span>
          <span className="w-6 text-center text-base">
            {getWeatherIcon(f.precipitationProb)}
          </span>
          <span className="w-9 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {Math.round(f.minTemp)}°
          </span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="absolute inset-y-0 rounded-full bg-gradient-to-r from-cyan-400 to-orange-400"
              style={{ left: bar.left, width: bar.width }}
            />
          </div>
          <span className="w-9 text-xs tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
            {Math.round(f.maxTemp)}°
          </span>
          <div className="flex w-16 flex-col items-end">
            <span className={`text-xs font-medium tabular-nums ${getPrecipColor(f.precipitationProb)}`}>
              {f.precipitationProb}%
            </span>
            <span className="text-[10px] text-zinc-400">
              ET₀ {f.et0}mm
            </span>
          </div>
        </div>
      );
    });

  const sections: { source: string; items: ForecastItem[] }[] = [];
  if (openMeteo.length > 0) sections.push({ source: "open-meteo", items: openMeteo });
  if (aemet.length > 0) sections.push({ source: "aemet", items: aemet });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Pronóstico 3 días
        </h3>
        <div className="flex items-center gap-2">
          {sections.map((s) => (
            <SourceBadge key={s.source} source={s.source} />
          ))}
        </div>
      </div>

      {sections.length === 1 && (
        <div className="space-y-3">{renderForecastRows(sections[0].items)}</div>
      )}

      {sections.length === 2 && (
        <div className="space-y-4">
          {sections.map((s, idx) => (
            <div key={s.source}>
              {idx > 0 && <div className="mb-3 border-t border-zinc-100 dark:border-zinc-800" />}
              <div className="space-y-3">{renderForecastRows(s.items)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
