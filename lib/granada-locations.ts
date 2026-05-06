export interface GranadaLocation {
  id: string;
  name: string;
  municipality: string;
  latitude: number;
  longitude: number;
  zone: "altiplano" | "costa-tropical";
  microclimate: string;
  altitude: number;
  isComarcaCapital: boolean;
  comarca: string;
}

export interface GranadaZone {
  id: string;
  name: string;
  description: string;
  microclimate: string;
  locations: GranadaLocation[];
}

export const granadaLocations: GranadaLocation[] = [
  {
    id: "granada-city",
    name: "Granada",
    municipality: "Granada",
    latitude: 37.1773,
    longitude: -3.5986,
    zone: "altiplano",
    microclimate: "Continental urbano",
    altitude: 680,
    isComarcaCapital: true,
    comarca: "Granada",
  },
  {
    id: "guadix",
    name: "Guadix",
    municipality: "Guadix",
    latitude: 37.1772,
    longitude: -3.1075,
    zone: "altiplano",
    microclimate: "Continental seco",
    altitude: 917,
    isComarcaCapital: true,
    comarca: "Guadix",
  },
  {
    id: "baza",
    name: "Baza",
    municipality: "Baza",
    latitude: 37.2992,
    longitude: -2.7726,
    zone: "altiplano",
    microclimate: "Continental de altiplano",
    altitude: 844,
    isComarcaCapital: true,
    comarca: "Baza",
  },
  {
    id: "huescar",
    name: "Huéscar",
    municipality: "Huéscar",
    latitude: 37.8151,
    longitude: -2.5366,
    zone: "altiplano",
    microclimate: "Continental de alta montaña",
    altitude: 1088,
    isComarcaCapital: true,
    comarca: "Huéscar",
  },
  {
    id: "huercal-overa",
    name: "Huércal-Overa",
    municipality: "Huércal-Overa",
    latitude: 37.2963,
    longitude: -1.9483,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Semiárido",
    altitude: 430,
    isComarcaCapital: true,
    comarca: "Huércal-Overa",
  },
  {
    id: "motril",
    name: "Motril",
    municipality: "Motril",
    latitude: 36.7562,
    longitude: -3.5188,
    zone: "costa-tropical",
    microclimate: "Mediterráneo costero",
    altitude: 12,
    isComarcaCapital: true,
    comarca: "Motril",
  },
  {
    id: "almeria",
    name: "Almería",
    municipality: "Almería",
    latitude: 36.8341,
    longitude: -2.4637,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Semiárido",
    altitude: 18,
    isComarcaCapital: true,
    comarca: "Almería",
  },
  {
    id: "loja",
    name: "Loja",
    municipality: "Loja",
    latitude: 37.1688,
    longitude: -4.0633,
    zone: "altiplano",
    microclimate: "Continental de transición",
    altitude: 484,
    isComarcaCapital: true,
    comarca: "Loja",
  },
  {
    id: "iznalloz",
    name: "Iznalloz",
    municipality: "Iznalloz",
    latitude: 37.3438,
    longitude: -3.5144,
    zone: "altiplano",
    microclimate: "Continental de vega",
    altitude: 670,
    isComarcaCapital: true,
    comarca: "Iznalloz",
  },
  {
    id: "santafe",
    name: "Santa Fe",
    municipality: "Santa Fe",
    latitude: 37.3833,
    longitude: -3.6833,
    zone: "altiplano",
    microclimate: "Continental de vega",
    altitude: 595,
    isComarcaCapital: true,
    comarca: "Santa Fe",
  },
  {
    id: "alhama-granada",
    name: "Alhama de Granada",
    municipality: "Alhama de Granada",
    latitude: 37.0224,
    longitude: -3.9847,
    zone: "altiplano",
    microclimate: "Continental de montaña",
    altitude: 1104,
    isComarcaCapital: true,
    comarca: "Alhama",
  },
  {
    id: "diezma",
    name: "Diezma",
    municipality: "Diezma",
    latitude: 37.3208,
    longitude: -3.2219,
    zone: "altiplano",
    microclimate: "Continental de alta montaña",
    altitude: 1200,
    isComarcaCapital: true,
    comarca: "Diezma",
  },
  {
    id: "hueneja",
    name: "Huéneja",
    municipality: "Huéneja",
    latitude: 37.1833,
    longitude: -3.0833,
    zone: "altiplano",
    microclimate: "Continental de altiplano",
    altitude: 1050,
    isComarcaCapital: false,
    comarca: "Guadix",
  },
  {
    id: "calahorra",
    name: "La Calahorra",
    municipality: "La Calahorra",
    latitude: 37.2333,
    longitude: -3.0833,
    zone: "altiplano",
    microclimate: "Continental de montaña",
    altitude: 1150,
    isComarcaCapital: false,
    comarca: "Guadix",
  },
  {
    id: "lugros",
    name: "Lugros",
    municipality: "Lugros",
    latitude: 37.25,
    longitude: -3.1667,
    zone: "altiplano",
    microclimate: "Continental de montaña",
    altitude: 1250,
    isComarcaCapital: false,
    comarca: "Diezma",
  },
  {
    id: "purullena",
    name: "Purullena",
    municipality: "Purullena",
    latitude: 37.3167,
    longitude: -3.0833,
    zone: "altiplano",
    microclimate: "Continental seco",
    altitude: 920,
    isComarcaCapital: false,
    comarca: "Guadix",
  },
  {
    id: "benamaur",
    name: "BenAMAUR",
    municipality: "BenAMAUR",
    latitude: 37.0833,
    longitude: -3.25,
    zone: "altiplano",
    microclimate: "Continental de transición",
    altitude: 980,
    isComarcaCapital: false,
    comarca: "Baza",
  },
  {
    id: "alquife",
    name: "Alquife",
    municipality: "Alquife",
    latitude: 37.15,
    longitude: -3.0833,
    zone: "altiplano",
    microclimate: "Continental de minería",
    altitude: 1020,
    isComarcaCapital: false,
    comarca: "Guadix",
  },
  {
    id: "almijara",
    name: "Almijara",
    municipality: "Almijara",
    latitude: 36.8833,
    longitude: -3.8333,
    zone: "costa-tropical",
    microclimate: "Mediterráneo de montaña costera",
    altitude: 450,
    isComarcaCapital: false,
    comarca: "Motril",
  },
  {
    id: "cadiar",
    name: "Cádiar",
    municipality: "Cádiar",
    latitude: 36.9333,
    longitude: -3.25,
    zone: "costa-tropical",
    microclimate: "Mediterráneo de transición",
    altitude: 620,
    isComarcaCapital: false,
    comarca: "Almería",
  },
  {
    id: "valor",
    name: "Valor",
    municipality: "Valor",
    latitude: 36.9,
    longitude: -3.2,
    zone: "costa-tropical",
    microclimate: "Mediterráneo de transición",
    altitude: 680,
    isComarcaCapital: false,
    comarca: "Almería",
  },
  {
    id: "yator",
    name: "Yátor",
    municipality: "Yátor",
    latitude: 36.95,
    longitude: -3.2833,
    zone: "costa-tropical",
    microclimate: "Mediterráneo de montaña",
    altitude: 780,
    isComarcaCapital: false,
    comarca: "Almería",
  },
  {
    id: "pampaneira",
    name: "Pampaneira",
    municipality: "Pampaneira",
    latitude: 36.95,
    longitude: -3.3667,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Alpujarreño",
    altitude: 1050,
    isComarcaCapital: false,
    comarca: "Motril",
  },
  {
    id: "bubion",
    name: "Bubión",
    municipality: "Bubión",
    latitude: 36.9667,
    longitude: -3.35,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Alpujarreño",
    altitude: 1280,
    isComarcaCapital: false,
    comarca: "Motril",
  },
  {
    id: "capileira",
    name: "Capileira",
    municipality: "Capileira",
    latitude: 36.9833,
    longitude: -3.3167,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Alpujarreño",
    altitude: 1436,
    isComarcaCapital: false,
    comarca: "Motril",
  },
  {
    id: "torrenueva",
    name: "Torrenueva",
    municipality: "Torrenueva",
    latitude: 36.7333,
    longitude: -3.2,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Semiárido",
    altitude: 320,
    isComarcaCapital: false,
    comarca: "Motril",
  },
  {
    id: "lubrin",
    name: "Lúbrin",
    municipality: "Lúbrin",
    latitude: 37.0333,
    longitude: -2.0833,
    zone: "costa-tropical",
    microclimate: "Mediterráneo de montaña",
    altitude: 750,
    isComarcaCapital: false,
    comarca: "Huércal-Overa",
  },
  {
    id: "sorbas",
    name: "Sorbas",
    municipality: "Sorbas",
    latitude: 37.1,
    longitude: -2.1167,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Semiárido",
    altitude: 520,
    isComarcaCapital: false,
    comarca: "Huércal-Overa",
  },
  {
    id: "cuevas-campo",
    name: "Cuevas del Campo",
    municipality: "Cuevas del Campo",
    latitude: 37.3333,
    longitude: -2.7333,
    zone: "costa-tropical",
    microclimate: "Mediterráneo Semiárido",
    altitude: 680,
    isComarcaCapital: false,
    comarca: "Baza",
  },
  {
    id: "sanjuan-terreros",
    name: "San Juan de los Terreros",
    municipality: "Pulpi",
    latitude: 37.3667,
    longitude: -1.7833,
    zone: "costa-tropical",
    microclimate: "Mediterráneo costero",
    altitude: 15,
    isComarcaCapital: false,
    comarca: "Huércal-Overa",
  },
  {
    id: "alhambra",
    name: "La Alhambra",
    municipality: "Granada",
    latitude: 37.166,
    longitude: -3.588,
    zone: "altiplano",
    microclimate: "Continental urbano",
    altitude: 745,
    isComarcaCapital: false,
    comarca: "Granada",
  },
  {
    id: "monachil",
    name: "Monachil",
    municipality: "Monachil",
    latitude: 37.1333,
    longitude: -3.5167,
    zone: "altiplano",
    microclimate: "Continental de sierra",
    altitude: 792,
    isComarcaCapital: false,
    comarca: "Granada",
  },
  {
    id: "pradollano",
    name: "Pradollano",
    municipality: "Monachil",
    latitude: 37.1,
    longitude: -3.4333,
    zone: "altiplano",
    microclimate: "Alta montaña",
    altitude: 1400,
    isComarcaCapital: false,
    comarca: "Granada",
  },
];

export const granadaZones: GranadaZone[] = [
  {
    id: "altiplano",
    name: "Altiplano de Granada",
    description: "Zona de interior de alta montaña con inviernos fríos y veranos suaves",
    microclimate: "Continental moderado a seco",
    locations: [],
  },
  {
    id: "costa-tropical",
    name: "Costa Tropical de Granada",
    description: "Zona costera con inviernos suaves y veranos cálido-húmedos",
    microclimate: "Mediterráneo costero a Semiárido",
    locations: [],
  },
];

granadaZones.find((z) => z.id === "altiplano")!.locations = granadaLocations.filter(
  (l) => l.zone === "altiplano"
);
granadaZones.find((z) => z.id === "costa-tropical")!.locations = granadaLocations.filter(
  (l) => l.zone === "costa-tropical"
);

export function getLocationsByZone(zone: "altiplano" | "costa-tropical"): GranadaLocation[] {
  return granadaLocations.filter((l) => l.zone === zone);
}

export function getLocationById(id: string): GranadaLocation | undefined {
  return granadaLocations.find((l) => l.id === id);
}

export function findNearestLocation(
  lat: number,
  lon: number
): GranadaLocation | null {
  let nearest: GranadaLocation | null = null;
  let minDist = Infinity;

  for (const location of granadaLocations) {
    const dist = Math.sqrt(
      Math.pow(lat - location.latitude, 2) + Math.pow(lon - location.longitude, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = location;
    }
  }

  return nearest;
}

export function getComarcaCapitals(): GranadaLocation[] {
  return granadaLocations.filter((l) => l.isComarcaCapital === true);
}

export function getLocationsByComarca(comarca: string): GranadaLocation[] {
  return granadaLocations.filter((l) => l.comarca === comarca);
}

export function getUniqueComarcas(): string[] {
  const comarcas = new Set(granadaLocations.map((l) => l.comarca).filter((c): c is string => !!c));
  return Array.from(comarcas).sort();
}