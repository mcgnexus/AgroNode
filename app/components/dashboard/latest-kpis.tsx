interface KpiData {
  soilHumidity: number;
  leafTemp: number;
  ambientTemp: number;
  ambientHumidity: number;
}

function calculateVPD(tempC: number, rhPercent: number): number {
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const vpd = svp * (1 - rhPercent / 100);
  return Math.round(vpd * 100) / 100;
}

function getSoilHumidityStatus(value: number) {
  if (value < 30) return { label: "Crítico", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-900", bar: "bg-red-500" };
  if (value < 45) return { label: "Bajo", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900", bar: "bg-amber-500" };
  if (value < 60) return { label: "Óptimo", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-900", bar: "bg-green-500" };
  return { label: "Alto", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-900", bar: "bg-blue-500" };
}

function getVpdStatus(vpd: number) {
  if (vpd < 0.4) return { label: "Muy bajo", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-900" };
  if (vpd < 1.2) return { label: "Óptimo", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-200 dark:border-green-900" };
  if (vpd < 2.0) return { label: "Alto", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-900" };
  return { label: "Muy alto", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", border: "border-red-200 dark:border-red-900" };
}

function getDeltaT(leafTemp: number, ambientTemp: number) {
  const d = leafTemp - ambientTemp;
  if (d > 2) return { value: d, label: "Estrés", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/40" };
  if (d > 0) return { value: d, label: "Alerta", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" };
  return { value: d, label: "Normal", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/40" };
}

export default function LatestKPIs({ data }: { data: KpiData }) {
  const vpd = calculateVPD(data.leafTemp, data.ambientHumidity);
  const soilStatus = getSoilHumidityStatus(data.soilHumidity);
  const vpdStatus = getVpdStatus(vpd);
  const deltaT = getDeltaT(data.leafTemp, data.ambientTemp);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className={`rounded-xl border p-4 ${soilStatus.border} ${soilStatus.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Humedad Suelo
          </span>
          <span className={`text-xs font-bold ${soilStatus.color}`}>
            {soilStatus.label}
          </span>
        </div>
        <p className={`text-3xl font-bold ${soilStatus.color}`}>
          {data.soilHumidity}
          <span className="ml-1 text-base font-medium text-zinc-400">%</span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${soilStatus.bar}`}
            style={{ width: `${Math.min(data.soilHumidity, 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
          <span>0%</span>
          <span>30%</span>
          <span>60%</span>
          <span>100%</span>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${vpdStatus.border} ${vpdStatus.bg}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            VPD
          </span>
          <span className={`text-xs font-bold ${vpdStatus.color}`}>
            {vpdStatus.label}
          </span>
        </div>
        <p className={`text-3xl font-bold ${vpdStatus.color}`}>
          {vpd}
          <span className="ml-1 text-base font-medium text-zinc-400">kPa</span>
        </p>
        <p className="mt-2 text-[11px] leading-tight text-zinc-500 dark:text-zinc-400">
          SVP = {(0.6108 * Math.exp((17.27 * data.leafTemp) / (data.leafTemp + 237.3))).toFixed(2)} kPa
          &nbsp;&middot;&nbsp; HR = {data.ambientHumidity}%
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Temp. Foliar
          </span>
          <span className="text-xs font-medium text-zinc-400">
            T<sub>hoja</sub>
          </span>
        </div>
        <p className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
          {data.leafTemp}
          <span className="ml-1 text-base font-medium text-zinc-400">°C</span>
        </p>
        <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${deltaT.bg} ${deltaT.color}`}>
          <span>ΔT {deltaT.value > 0 ? "+" : ""}{deltaT.value.toFixed(1)}°C</span>
          <span>&middot; {deltaT.label}</span>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Temp. Ambiente
          </span>
          <span className="text-xs font-medium text-zinc-400">
            T<sub>amb</sub>
          </span>
        </div>
        <p className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
          {data.ambientTemp}
          <span className="ml-1 text-base font-medium text-zinc-400">°C</span>
        </p>
        <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          HR: {data.ambientHumidity}% &nbsp;&middot;&nbsp; {"T_hoja"}: {data.leafTemp}°C
        </p>
      </div>
    </div>
  );
}
