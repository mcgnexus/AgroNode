"use client";

import { useState } from "react";
import ParcelForm from "./parcel-form";

interface Parcel {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  cropType: string;
  locationId: string | null;
  municipioId: string | null;
  municipioNombre: string | null;
  zone: string | null;
  microclimate: string | null;
  description: string | null;
  irrigationType: string | null;
  createdAt: string | Date;
}

interface ParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcel?: Parcel | null;
  onSave: () => void;
}

export default function ParcelModal({
  isOpen,
  onClose,
  parcel,
  onSave,
}: ParcelModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (data: any) => {
    setIsLoading(true);
    try {
      const url = parcel
        ? `/api/parcels/${parcel.id}`
        : "/api/parcels";
      const method = parcel ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Error al guardar la parcela");
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar la parcela");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-zinc-900">
        <h2 className="mb-4 text-xl font-bold">
          {parcel ? "Editar parcela" : "Nueva parcela"}
        </h2>
        <ParcelForm
          initialData={parcel ?? undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}