import Link from "next/link";
import { useState } from "react";
import ParcelModal from "./parcel-modal";

interface ParcelSummary {
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

export default function ParcelCard({ parcel, onRefresh }: { parcel: ParcelSummary; onRefresh: () => void }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const last = parcel.lastReading;
  const timeAgo = last
    ? getTimeAgo(new Date(last.timestamp))
    : null;

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la parcela "${parcel.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/parcels/${parcel.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar");
      }

      onRefresh();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al eliminar la parcela");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Link href={`/parcels/${parcel.id}`}>
        <div className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-green-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-green-800">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-800 group-hover:text-green-700 dark:text-zinc-200 dark:group-hover:text-green-400">
                {parcel.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{parcel.cropType}</p>
            </div>
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {parcel.totalReadings} lecturas
            </span>
          </div>

          {parcel.zone && (
            <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                {parcel.zone === "altiplano" ? "Altiplano" : "Costa Tropical"}
              </span>
              {parcel.municipioNombre && (
                <span className="ml-1">{parcel.municipioNombre}</span>
              )}
            </div>
          )}

          {last ? (
            <div className="grid grid-cols-3 gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <div>
                <p className="text-xs text-zinc-400">Temp</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {last.ambientTemp}°C
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Humedad</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {last.ambientHumidity}%
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Suelo</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {last.soilHumidity}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Sin lecturas recientes</p>
          )}

          {timeAgo && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Última lectura: {timeAgo}
            </p>
          )}
        </div>
      </Link>

      <div className="mt-2 flex gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            setIsModalOpen(true);
          }}
          className="flex-1 rounded border border-zinc-300 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Editar
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            handleDelete();
          }}
          disabled={isDeleting}
          className="flex-1 rounded border border-red-200 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/20"
        >
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>

      <ParcelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        parcel={parcel}
        onSave={onRefresh}
      />
    </>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}