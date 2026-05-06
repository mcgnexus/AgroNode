import { NextResponse } from "next/server";
import { getRiaHourlyDataMany } from "@/lib/services/ria.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const estacion = searchParams.get("estacion");
    const estacionesCsv = searchParams.get("estaciones");
    const estacionesMulti = searchParams.getAll("estaciones");
    const fechaIni = searchParams.get("fecha_ini") ?? searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fecha_fin") ?? searchParams.get("fechaFin");

    if (!fechaIni || !fechaFin) {
      return NextResponse.json(
        { error: "Parámetros requeridos: fecha_ini, fecha_fin, y estacion(es)" },
        { status: 400 }
      );
    }

    const estacionesParsed = [
      ...estacionesMulti.flatMap((x) => x.split(",")),
      ...(estacionesCsv ? estacionesCsv.split(",") : []),
      ...(estacion ? estacion.split(",") : []),
    ]
      .map((x) => x.trim())
      .filter(Boolean);
    const estacionesUnique = [...new Set(estacionesParsed)];

    if (estacionesUnique.length === 0) {
      return NextResponse.json(
        { error: "Parámetro requerido: estacion o estaciones" },
        { status: 400 }
      );
    }

    const datos = await getRiaHourlyDataMany(estacionesUnique, fechaIni, fechaFin);
    return NextResponse.json({
      datos,
      meta: {
        source: "RIA WS v2",
        note: "RIA no expone endpoint horario nativo en riaws; este endpoint deriva horarios desde diarios (hour=0).",
      },
    });
  } catch (error) {
    console.error("RIA horarios Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
