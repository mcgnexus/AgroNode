"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

interface ChartPoint {
  time: string;
  ambientTemp: number;
  leafTemp: number;
  soilHumidity: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    unit: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {label ? new Date(label).toLocaleString("es-ES", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }) : ""}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-zinc-600 dark:text-zinc-400">{p.name}:</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
            {p.unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DualAxisSensorChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Sensores 24h — Temperatura &amp; Humedad
        </h3>
        <p className="mt-4 text-sm text-zinc-400">Sin datos disponibles</p>
      </div>
    );
  }

  const latestPoint = data[data.length - 1];
  const deltaT = latestPoint.leafTemp - latestPoint.ambientTemp;
  const hasStress = deltaT > 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Sensores 24h — Temperatura &amp; Humedad
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Eje izq. Temp (°C) &nbsp;|&nbsp; Eje der. Humedad suelo (%)
          </p>
        </div>
        {hasStress && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            ΔT +{deltaT.toFixed(1)}°C
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return `${d.getHours().toString().padStart(2, "0")}:00`;
            }}
            tick={{ fontSize: 10 }}
            stroke="#a1a1aa"
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="temp"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10 }}
            stroke="#a1a1aa"
            label={{ value: "°C", position: "insideTopLeft", offset: 0, fontSize: 10, fill: "#a1a1aa" }}
          />
          <YAxis
            yAxisId="humidity"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="#a1a1aa"
            label={{ value: "%", position: "insideTopRight", offset: 0, fontSize: 10, fill: "#a1a1aa" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => {
              const names: Record<string, string> = {
                ambientTemp: "T. Ambiente (°C)",
                leafTemp: "T. Foliar (°C)",
                soilHumidity: "H. Suelo (%)",
              };
              return names[value] ?? value;
            }}
          />

          {hasStress && (
            <ReferenceLine
              yAxisId="temp"
              segment={[
                { x: data[0].time, y: data[0].ambientTemp },
                { x: data[data.length - 1].time, y: data[data.length - 1].ambientTemp },
              ]}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}

          <Area
            yAxisId="humidity"
            type="monotone"
            dataKey="soilHumidity"
            fill="#06b6d4"
            fillOpacity={0.12}
            stroke="#06b6d4"
            strokeWidth={1.5}
            unit="%"
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="ambientTemp"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            unit="°C"
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="leafTemp"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            unit="°C"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
