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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Monitoreo agrícola en tiempo real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncRaif}
              disabled={isRaifPending}
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-all hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
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
                <>Evaluar Alertas RAIF</>
              )}
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              + Nueva parcela
            </button>
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

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Parcelas</p>
            <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {parcels.length}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Lecturas totales</p>
            <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {totalReadings.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Sensores activos</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {activeSensors}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Estado</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              Online
            </p>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Parcelas
        </h2>

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
                  <div className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-green-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-green-800">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-800 group-hover:text-green-700 dark:text-zinc-200 dark:group-hover:text-green-400">
                          {parcel.name}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {parcel.cropType}
                        </p>
                      </div>
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {parcel.totalReadings} lecturas
                      </span>
                    </div>

                    {parcel.zone && (
                      <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
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
                      <div className="grid grid-cols-3 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                        <div>
                          <p className="text-xs text-zinc-400">Temp</p>
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {parcel.lastReading.ambientTemp}°C
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Humedad</p>
                          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                            {parcel.lastReading.ambientHumidity}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Suelo</p>
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
                    className="flex-1 rounded border border-zinc-300 py-1 text-center text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Ver
                  </Link>
                  <button
                    onClick={() => handleDelete(parcel.id, parcel.name)}
                    className="flex-1 rounded border border-red-200 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                  >
                    Eliminar
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