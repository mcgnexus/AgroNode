import { NextResponse } from "next/server";
import { getRiaStations, getRiaStationsByProvince } from "@/lib/services/ria.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provincia = searchParams.get("provincia");
    const soloGranada = searchParams.get("granada");

    const estaciones = soloGranada === "true"
      ? await getRiaStationsByProvince("18")
      : provincia
      ? await getRiaStationsByProvince(provincia)
      : await getRiaStations();

    return NextResponse.json({ datos: estaciones });
  } catch (error) {
    console.error("RIA Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
