"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import ParcelModal from "@/app/components/parcel-modal";
import NavHeader from "@/app/components/nav-header";
import { syncRaifAlerts, type RaifSyncResult } from "@/app/actions/sync-raif";

interface Parcel {
  id: string;
  name: string;
  cropType: string;
  latitude: number;
  longitude: number;
  locationId: string | null;
  municipioId: string | null;
  municipioNombre: string | null;
  zone: string | null;
  microclimate: string | null;
  description: string | null;
  irrigationType: string | null;
  nodeCode: string | null;
  createdAt: string | Date;
  totalReadings: number;
  lastReading: {
    timestamp: string | Date;
    ambientTemp: number;
    ambientHumidity: number;
    soilHumidity: number;
    batteryLevel: number | null;
  } | null;
}

function Icon({ name, className = "h-4 w-4" }: { name: "parcel" | "reading" | "sensor" | "status" | "alert" | "plus" | "temperature" | "humidity" | "soil" | "location" | "eye" | "trash"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "parcel" && <><path d="M3 20h18" /><path d="M5 20V8l7-4 7 4v12" /><path d="M9 20v-6h6v6" /></>}
      {name === "reading" && <><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7 15 3-4 3 2 4-7" /></>}
      {name === "sensor" && <><path d="M12 3v3M12 18v3M4.6 6.5l2.1 2.1M17.3 15.4l2.1 2.1M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4" /></>}
      {name === "status" && <><path d="M20 6 9 17l-5-5" /></>}
      {name === "alert" && <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>}
      {name === "plus" && <><path d="M12 5v14" /><path d="M5 12h14" /></>}
      {name === "temperature" && <><path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z" /><path d="M12 9v7" /></>}
      {name === "humidity" && <><path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" /></>}
      {name === "soil" && <><path d="M4 18h16" /><path d="M6 14c2.5 0 2.5-4 5-4s2.5 4 5 4" /></>}
      {name === "location" && <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>}
      {name === "eye" && <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
      {name === "trash" && <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>}
    </svg>
  );
}

function SummaryCard({ icon, label, value, accent }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}><Icon name={icon} /></span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="text-xl font-bold text-zinc-800 dark:text-zinc-100 sm:text-2xl">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRaifPending, startRaifTransition] = useTransition();
  const [raifResult, setRaifResult] = useState<RaifSyncResult | null>(null);

  const fetchParcels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/parcels");
      const data = await response.json();
      setParcels(data);
    } catch (error) {
      console.error("Error fetching parcels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const totalReadings = parcels.reduce((sum, p) => sum + p.totalReadings, 0);
  const activeSensors = parcels.filter((p) => p.totalReadings > 0).length;

  const getTimeAgo = (date: Date | string): string => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "ahora mismo";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `hace ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `hace ${diffD}d`;
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar parcela "${name}"?`)) return;

    try {
      const response = await fetch(`/api/parcels/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Error al eliminar");
      fetchParcels();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al eliminar la parcela");
    }
  };

  const handleSyncRaif = () => {
    setRaifResult(null);
    startRaifTransition(async () => {
      const result = await syncRaifAlerts();
      setRaifResult(result);
    });
  };

  return (
    <>
      <NavHeader />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8">
        <div className="mb-6 overflow-hidden rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4 dark:border-green-950/40 dark:from-green-950/30 dark:via-zinc-950 dark:to-emerald-950/20 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm">
                <Icon name="parcel" className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-2xl">
                  Gestión de parcelas
                </h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">
                  Supervisa cultivos, sensores y alertas desde un panel diseñado para seguimiento rápido en campo.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={handleSyncRaif}
                disabled={isRaifPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-all hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 sm:text-sm"
              >
                {isRaifPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Evaluando RAIF...
                  </>
                ) : (
                  <><Icon name="alert" />Evaluar RAIF</>
                )}
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-700 sm:text-sm"
              >
                <Icon name="plus" />Nueva parcela
              </button>
            </div>
          </div>
        </div>

        {raifResult && (
          <div className={`mb-6 rounded-xl border p-4 ${raifResult.ok ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"}`}>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-semibold ${raifResult.ok ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300"}`}>
                RAIF: {raifResult.succeeded}/{raifResult.total} parcelas evaluadas
                {raifResult.failed > 0 && ` · ${raifResult.failed} errores`}
                {raifResult.highAlerts > 0 && ` · ${raifResult.highAlerts} alertas alta`}
                {raifResult.notificationsSent > 0 && ` · ${raifResult.notificationsSent} notificaciones enviadas`}
              </p>
              <button
                onClick={() => setRaifResult(null)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                Cerrar
              </button>
            </div>
            {raifResult.details.length > 0 && (
              <div className="mt-2 space-y-1">
                {raifResult.details.map((d, i) => (
                  <p key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">{d.parcelName}</span>
                    {d.error
                      ? <span className="text-red-600 dark:text-red-400"> — Error: {d.error}</span>
                      : d.highAlerts > 0
                        ? <span> — {d.highAlerts} alta {d.notified ? "· notificado" : `· ${d.reason ?? ""}`}</span>
                        : <span> — Sin alertas high</span>
                    }
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <SummaryCard icon="parcel" label="Parcelas" value={parcels.length} accent="bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" />
          <SummaryCard icon="reading" label="Lecturas" value={totalReadings.toLocaleString()} accent="bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400" />
          <SummaryCard icon="sensor" label="Sensores" value={activeSensors} accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" />
          <SummaryCard icon="status" label="Estado" value="Online" accent="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" />
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-800 dark:text-zinc-100 sm:text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"><Icon name="parcel" /></span>
            Parcelas
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {parcels.length} registradas
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-500">Cargando...</div>
        ) : parcels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No hay parcelas registradas. Crea una nueva parcela para comenzar.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              Crear parcela
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {parcels.map((parcel) => (
              <div key={parcel.id}>
                <Link href={`/parcels/${parcel.id}`}>
                  <div className="group cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-green-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-green-800 sm:p-5">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-zinc-800 group-hover:text-green-700 dark:text-zinc-200 dark:group-hover:text-green-400">
                          {parcel.name}
                        </h3>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {parcel.cropType}
                        </p>
                      </div>
                      <span className="ml-2 flex-shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400 sm:text-xs">
                        {parcel.totalReadings} lecturas
                      </span>
                    </div>

                    {parcel.zone && (
                      <div className="mb-3 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Icon name="location" className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {parcel.zone === "altiplano"
                            ? "Altiplano"
                            : "Costa Tropical"}
                        </span>
                        {parcel.municipioNombre && (
                          <span className="ml-1">{parcel.municipioNombre}</span>
                        )}
                      </div>
                    )}

                    {parcel.lastReading ? (
                      <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                          <p className="flex items-center gap-1 text-[10px] text-zinc-400"><Icon name="temperature" className="h-3 w-3" />Temp</p>
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {parcel.lastReading.ambientTemp}°C
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                          <p className="flex items-center gap-1 text-[10px] text-zinc-400"><Icon name="humidity" className="h-3 w-3" />Hum</p>
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {parcel.lastReading.ambientHumidity}%
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
                          <p className="flex items-center gap-1 text-[10px] text-zinc-400"><Icon name="soil" className="h-3 w-3" />Suelo</p>
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {parcel.lastReading.soilHumidity}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400">Sin lecturas</p>
                    )}
                  </div>
                </Link>

                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/parcels/${parcel.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-300 py-1.5 text-center text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Icon name="eye" className="h-3.5 w-3.5" /> Ver
                  </Link>
                  <button
                    onClick={() => handleDelete(parcel.id, parcel.name)}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <ParcelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={fetchParcels}
      />
    </>
  );
}
