"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface SensorReading {
  id: bigint | string;
  node_id: string;
  measured_at: Date;
  air_temp_c: number | null;
  air_humidity_pct: number | null;
  pressure_hpa: number | null;
  leaf_temp_c: number | null;
  soil_moisture_raw: number | null;
  soil_moisture_pct: number | null;
  battery_v: number | null;
  rssi_dbm: number | null;
}

interface NodeData {
  id: string;
  node_code: string;
  name: string | null;
  location_name: string | null;
  crop: string | null;
  active: boolean;
  sensor_readings: SensorReading[];
}

interface NodesListProps {
  nodes: NodeData[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
        {label ? new Date(label).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-600 dark:text-zinc-400">{p.name}:</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function NodeCard({ node, isExpanded, onToggle, chartData }: { node: NodeData; isExpanded: boolean; onToggle: () => void; chartData: any[] }) {
  const latest = node.sensor_readings[0];
  const lastUpdated = latest ? new Date(latest.measured_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin datos";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${node.active ? "bg-green-100 dark:bg-green-900/30" : "bg-zinc-100 dark:bg-zinc-800"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={node.active ? "#16a34a" : "#71717a"} strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">{node.node_code}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {node.name || "Sin nombre"} · {node.crop || "Sin cultivo"}
            </p>
            {node.location_name && (
              <p className="text-[10px] text-zinc-400">{node.location_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {Number(latest.air_temp_c).toFixed(1)}°C
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                HR: {Number(latest.air_humidity_pct).toFixed(0)}% · Suelo: {Number(latest.soil_moisture_pct).toFixed(0)}%
              </p>
            </div>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {isExpanded && latest && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Temperatura Aire</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.air_temp_c).toFixed(1) ?? "-"}°C</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Humedad Aire</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.air_humidity_pct).toFixed(0) ?? "-"}%</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Humedad Suelo</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.soil_moisture_pct).toFixed(1) ?? "-"}%</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Presión</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.pressure_hpa).toFixed(0) ?? "-"} hPa</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Temp. Hoja</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.leaf_temp_c).toFixed(1) ?? "-"}°C</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Batería</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{Number(latest.battery_v).toFixed(2) ?? "-"} V</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">RSSI</p>
              <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{latest.rssi_dbm ?? "-"} dBm</p>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Última Lectura</p>
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{lastUpdated}</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Histórico (últimas 24h)</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(v: string) => new Date(v).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    tick={{ fontSize: 10 }}
                    stroke="#a1a1aa"
                  />
                  <YAxis yAxisId="temp" domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="#a1a1aa" />
                  <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#a1a1aa" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="air_temp_c" name="T. Aire (°C)" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line yAxisId="temp" type="monotone" dataKey="leaf_temp_c" name="T. Hoja (°C)" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line yAxisId="hum" type="monotone" dataKey="soil_moisture_pct" name="H. Suelo (%)" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function IoTNodesList({ nodes }: NodesListProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const fetchChartData = async (nodeCode: string) => {
    const res = await fetch(`/api/iot/readings?node_code=${nodeCode}&limit=100`);
    const data = await res.json();
    if (data.ok) {
      return data.data.map((r: any) => ({
        time: r.measured_at,
        air_temp_c: parseFloat(r.air_temp_c) || null,
        leaf_temp_c: parseFloat(r.leaf_temp_c) || null,
        air_humidity_pct: parseFloat(r.air_humidity_pct) || null,
        soil_moisture_pct: parseFloat(r.soil_moisture_pct) || null,
      })).filter((r: any) => r.air_temp_c || r.leaf_temp_c || r.soil_moisture_pct);
    }
    return [];
  };

  const [chartDataMap, setChartDataMap] = useState<Record<string, any[]>>({});

  const handleToggle = async (nodeId: string, nodeCode: string) => {
    if (expandedNode === nodeId) {
      setExpandedNode(null);
    } else {
      setExpandedNode(nodeId);
      if (!chartDataMap[nodeCode]) {
        const data = await fetchChartData(nodeCode);
        setChartDataMap(prev => ({ ...prev, [nodeCode]: data }));
      }
    }
  };

  return (
    <div className="space-y-3">
      {nodes.map((node) => (
        <NodeCard
          key={node.id}
          node={node}
          isExpanded={expandedNode === node.id}
          onToggle={() => handleToggle(node.id, node.node_code)}
          chartData={chartDataMap[node.node_code] || []}
        />
      ))}
    </div>
  );
}