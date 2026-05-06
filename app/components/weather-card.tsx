interface WeatherForecast {
  forecastDate: string;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  et0: number;
  source?: string;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return days[d.getDay()];
}

function getWeatherEmoji(precipProb: number): string {
  if (precipProb >= 70) return "🌧";
  if (precipProb >= 40) return "⛅";
  if (precipProb >= 20) return "🌤";
  return "☀️";
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

function ForecastGrid({ forecasts }: { forecasts: WeatherForecast[] }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {forecasts.map((f) => (
        <div
          key={`${f.source}-${f.forecastDate}`}
          className="flex flex-col items-center gap-1 rounded-lg bg-zinc-50 px-2 py-3 dark:bg-zinc-800"
        >
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {getDayLabel(f.forecastDate)}
          </span>
          <span className="text-lg">{getWeatherEmoji(f.precipitationProb)}</span>
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {Math.round(f.maxTemp)}°
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {Math.round(f.minTemp)}°
          </span>
          <span className={`text-xs font-medium ${getPrecipColor(f.precipitationProb)}`}>
            {f.precipitationProb}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function WeatherCard({ forecasts }: { forecasts: WeatherForecast[] }) {
  if (forecasts.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Pronóstico 7 días
        </h3>
        <p className="text-sm text-zinc-400">Sin datos de pronóstico</p>
      </div>
    );
  }

  const openMeteo = forecasts.filter(f => f.source === "open-meteo").slice(0, 7);
  const aemet = forecasts.filter(f => f.source?.startsWith("aemet")).slice(0, 7);
  const sources: { key: string; label: string }[] = [];
  if (openMeteo.length > 0) sources.push({ key: "open-meteo", label: "Open-Meteo" });
  if (aemet.length > 0) sources.push({ key: "aemet", label: "AEMET Oficial" });

  const totalEt0 = forecasts
    .filter(f => f.source === "open-meteo")
    .reduce((sum, f) => sum + f.et0, 0);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Pronóstico 7 días
        </h3>
        <div className="flex items-center gap-2">
          {sources.map((s) => (
            <SourceBadge key={s.key} source={s.key} />
          ))}
        </div>
      </div>

      {openMeteo.length > 0 && (
        <div>
          {aemet.length > 0 && (
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Open-Meteo
            </p>
          )}
          <ForecastGrid forecasts={openMeteo} />
        </div>
      )}

      {aemet.length > 0 && (
        <div className={openMeteo.length > 0 ? "mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800" : ""}>
          {openMeteo.length > 0 && (
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
              AEMET Oficial
            </p>
          )}
          <ForecastGrid forecasts={aemet} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">ET₀ acumulada (Open-Meteo)</span>
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {totalEt0.toFixed(1)} mm
        </span>
      </div>
    </div>
  );
}
