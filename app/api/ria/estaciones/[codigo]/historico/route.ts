import { NextResponse } from "next/server";
import { getRiaDailyData } from "@/lib/services/ria.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaIni = searchParams.get("fecha_ini") ?? searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fecha_fin") ?? searchParams.get("fechaFin");
    const { codigo } = await params;

    if (!fechaIni || !fechaFin) {
      return NextResponse.json(
        { error: "Parámetros requeridos: fecha_ini, fecha_fin" },
        { status: 400 }
      );
    }

    const datos = await getRiaDailyData(codigo, fechaIni, fechaFin);
    return NextResponse.json({ datos });
  } catch (error) {
    console.error("RIA Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
