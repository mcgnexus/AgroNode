import { NextResponse } from "next/server";
import { getEstaciones, getEstacionesAndalucia, getEstacionesProvincia } from "@/lib/siar-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provincia = searchParams.get("provincia");
    const soloAndalucia = searchParams.get("andalucia");
    const soloGranada = searchParams.get("granada");

    let estaciones;
    if (soloGranada === "true") {
      estaciones = await getEstacionesProvincia("GR");
    } else if (provincia) {
      estaciones = await getEstacionesProvincia(provincia);
    } else if (soloAndalucia === "true") {
      estaciones = await getEstacionesAndalucia();
    } else {
      estaciones = await getEstaciones();
    }

    return NextResponse.json({ datos: estaciones });
  } catch (error) {
    console.error("SIAR Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
