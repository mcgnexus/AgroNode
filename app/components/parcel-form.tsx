"use client";

import { useState, useEffect } from "react";
import { granadaZones, GranadaLocation } from "@/lib/granada-locations";

interface ParcelFormData {
  name: string;
  latitude: number;
  longitude: number;
  cropType: string;
  locationId?: string | null;
  municipioId?: string | null;
  municipioNombre?: string | null;
  zone?: string | null;
  microclimate?: string | null;
  description?: string | null;
  irrigationType?: string | null;
  nodeCode?: string | null;
}

interface ParcelFormProps {
  initialData?: Partial<ParcelFormData>;
  onSubmit: (data: ParcelFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const defaultCropTypes = [
  "Vitis vinifera (Uva de mesa)",
  "Vitis vinifera (Uva para vino)",
  "Olivo (Olea europaea)",
  "Almendro (Prunus dulcis)",
  "Higuera (Ficus carica)",
  "Granado (Punica granatum)",
  "Aguacate (Persea americana)",
  "Mango (Mangifera indica)",
  "Chirimoyo (Annona cherimola)",
  "Naranjo (Citrus sinensis)",
  "Limonero (Citrus limon)",
  "Hortalizas",
  "Frutales de hueso",
  "Frutales de pepita",
  "Cereal",
  "Otro",
];

const irrigationTypes = [
  { value: "goteo", label: "Riego por goteo" },
  { value: "aspersion", label: "Riego por aspersión" },
  { value: "gravedad", label: "Riego por gravedad" },
  { value: "subterraneo", label: "Riego subterráneo" },
  { value: "manual", label: "Riego manual" },
  { value: "sin_sistema", label: "Sin sistema de riego" },
];

export default function ParcelForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: ParcelFormProps) {
  const [formData, setFormData] = useState<ParcelFormData>({
    name: initialData?.name ?? "",
    latitude: initialData?.latitude ?? 0,
    longitude: initialData?.longitude ?? 0,
    cropType: initialData?.cropType ?? "",
    locationId: initialData?.locationId ?? "",
    municipioId: initialData?.municipioId ?? "",
    municipioNombre: initialData?.municipioNombre ?? "",
    zone: initialData?.zone ?? "",
    microclimate: initialData?.microclimate ?? "",
    description: initialData?.description ?? "",
    irrigationType: initialData?.irrigationType ?? "",
    nodeCode: initialData?.nodeCode ?? "",
  });

  const [selectedZone, setSelectedZone] = useState<string>(initialData?.zone ?? "");
  const [selectedLocation, setSelectedLocation] = useState<string>(initialData?.locationId ?? "");
  const [isInitialized, setIsInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const locationsInZone = selectedZone
    ? granadaZones.find((z) => z.id === selectedZone)?.locations ?? []
    : [];

  useEffect(() => {
    if (!isInitialized && selectedLocation && selectedZone) {
      const location = locationsInZone.find((l) => l.id === selectedLocation);
      if (location) {
        setFormData((prev) => ({
          ...prev,
          locationId: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
          municipioId: location.id,
          municipioNombre: location.name,
          zone: location.zone,
          microclimate: location.microclimate,
        }));
        setIsInitialized(true);
      }
    }
  }, [selectedLocation, locationsInZone, selectedZone, isInitialized]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "El nombre es requerido";
    if (!formData.cropType) newErrors.cropType = "El tipo de cultivo es requerido";
    if (formData.latitude === 0 || formData.latitude === undefined || formData.latitude === null) newErrors.latitude = "La latitud es requerida";
    if (formData.longitude === 0 || formData.longitude === undefined || formData.longitude === null) newErrors.longitude = "La longitud es requerida";
    if (!selectedZone) newErrors.zone = "Selecciona una zona";
    if (!selectedLocation) newErrors.locationId = "Selecciona una localidad";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nombre de la parcela *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="Ej: Viña El Cerrito"
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Zona geográfica *
        </label>
        <select
          value={selectedZone}
          onChange={(e) => {
            setSelectedZone(e.target.value);
            setSelectedLocation("");
          }}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Selecciona una zona</option>
          {granadaZones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name} - {zone.microclimate}
            </option>
          ))}
        </select>
        {errors.zone && <p className="mt-1 text-sm text-red-600">{errors.zone}</p>}
      </div>

      {selectedZone && (
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Localidad *
          </label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">Selecciona una localidad</option>
            {locationsInZone.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.municipality}) - {loc.microclimate}
              </option>
            ))}
          </select>
          {errors.locationId && (
            <p className="mt-1 text-sm text-red-600">{errors.locationId}</p>
          )}
        </div>
      )}

      {selectedLocation && (
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <strong>Coordenadas:</strong> {formData.latitude}, {formData.longitude}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <strong>Altitud:</strong>{" "}
            {locationsInZone.find((l) => l.id === selectedLocation)?.altitude}m
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <strong>Microclima:</strong> {formData.microclimate}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Latitud
          </label>
          <input
            type="number"
            step="any"
            name="latitude"
            value={formData.latitude || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
          {errors.latitude && (
            <p className="mt-1 text-sm text-red-600">{errors.latitude}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Longitud
          </label>
          <input
            type="number"
            step="any"
            name="longitude"
            value={formData.longitude || ""}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
          {errors.longitude && (
            <p className="mt-1 text-sm text-red-600">{errors.longitude}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Tipo de cultivo *
        </label>
        <select
          name="cropType"
          value={formData.cropType}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Selecciona el cultivo</option>
          {defaultCropTypes.map((crop) => (
            <option key={crop} value={crop}>
              {crop}
            </option>
          ))}
        </select>
        {errors.cropType && (
          <p className="mt-1 text-sm text-red-600">{errors.cropType}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sistema de riego
        </label>
        <select
          name="irrigationType"
          value={formData.irrigationType ?? ""}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">Selecciona el sistema</option>
          {irrigationTypes.map((irr) => (
            <option key={irr.value} value={irr.value}>
              {irr.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Código de nodo IoT
        </label>
        <input
          type="text"
          name="nodeCode"
          value={formData.nodeCode ?? ""}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="Ej: ANODE-001"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Vincula esta parcela a un nodo IoT existente para que sus lecturas aparezcan en el dashboard.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Descripción
        </label>
        <textarea
          name="description"
          value={formData.description ?? ""}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
          placeholder="Notas adicionales sobre la parcela..."
        />
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "Guardando..." : "Guardar parcela"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 dark:border-zinc-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}