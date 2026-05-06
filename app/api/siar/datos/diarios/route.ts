import { NextResponse } from "next/server";
import { getDatosDiarios } from "@/lib/siar-client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const estacion = searchParams.get("estacion");
    const estacionesCsv = searchParams.get("estaciones");
    const estacionesMulti = searchParams.getAll("estaciones");
    const ambito = searchParams.get("ambito");
    const id = searchParams.get("id");
    const fechaIni = searchParams.get("fecha_ini");
    const fechaFin = searchParams.get("fecha_fin");
    const datosCalculados = searchParams.get("datos_calculados") ?? "true";

    if (!fechaIni || !fechaFin) {
      return NextResponse.json(
        { error: "Parámetros requeridos: fecha_ini, fecha_fin (+ estacion o ambito+id)" },
        { status: 400 }
      );
    }

    let datos: unknown[] = [];
    const estacionesParsed = [
      ...estacionesMulti.flatMap((x) => x.split(",")),
      ...(estacionesCsv ? estacionesCsv.split(",") : []),
      ...(estacion ? estacion.split(",") : []),
    ]
      .map((x) => x.trim())
      .filter(Boolean);
    const estacionesUnique = [...new Set(estacionesParsed)];

    if (estacionesUnique.length > 0) {
      datos = await getDatosDiarios(
        estacionesUnique,
        fechaIni,
        fechaFin,
        datosCalculados.toLowerCase() === "true"
      );
    } else if (ambito && id) {
      const normalizedAmbito = ambito.toUpperCase();
      const valid = new Set(["CCAA", "PROVINCIA", "ESTACION"]);
      if (!valid.has(normalizedAmbito)) {
        return NextResponse.json(
          { error: "ambito inválido. Usa CCAA, PROVINCIA o ESTACION" },
          { status: 400 }
        );
      }

      const token = process.env.SIAR_TOKEN?.trim();
      if (!token) {
        return NextResponse.json({ error: "SIAR_TOKEN no configurado" }, { status: 500 });
      }

      const url = new URL(`https://servicio.mapa.gob.es/siarapi/API/V1/Datos/Diarios/${normalizedAmbito}`);
      url.searchParams.set("token", token);
      url.searchParams.set("Id", id);
      url.searchParams.set("FechaInicial", fechaIni);
      url.searchParams.set("FechaFinal", fechaFin);
      url.searchParams.set("DatosCalculados", datosCalculados);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `SIAR API error ${res.status}: ${text.substring(0, 220)}` }, { status: res.status });
      }

      const payload = await res.json();
      datos = Array.isArray(payload?.datos) ? payload.datos : [];
    } else {
      return NextResponse.json(
        { error: "Parámetros requeridos: estacion(es), o ambito+id" },
        { status: 400 }
      );
    }

    return NextResponse.json({ datos });
  } catch (error) {
    console.error("SIAR Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
