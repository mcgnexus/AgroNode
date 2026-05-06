import { NextRequest, NextResponse } from "next/server";
import { consultarAlertasRaif } from "@/lib/services/raif.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const provincia = request.nextUrl.searchParams.get("provincia") ?? undefined;
  const cultivo = request.nextUrl.searchParams.get("cultivo") ?? undefined;

  try {
    const result = await consultarAlertasRaif(provincia, cultivo);
    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido consultando RAIF",
      },
      { status: 500 }
    );
  }
}
