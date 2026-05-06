import { NextRequest, NextResponse } from "next/server";
import { isSiarEnabled, syncSiarDataForParcel } from "@/lib/services/siar.service";
import { syncRiaDataForParcel } from "@/lib/services/ria.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const parcel = await prisma.parcel.findUnique({ where: { id } });
    await prisma.$disconnect();

    if (!parcel) {
      return NextResponse.json(
        { error: "Parcela no encontrada" },
        { status: 404 }
      );
    }

    let siarValue: Awaited<ReturnType<typeof syncSiarDataForParcel>> | null = null;
    let riaValue: Awaited<ReturnType<typeof syncRiaDataForParcel>> | null = null;
    let siarError: string | null = null;
    let riaError: string | null = null;

    if (isSiarEnabled()) {
      try {
        siarValue = await syncSiarDataForParcel(parcel.latitude, parcel.longitude);
      } catch (error) {
        siarError = error instanceof Error ? error.message : "Error SIAR";
      }
    } else {
      siarError = "SIAR deshabilitado por configuración (SIAR_ENABLED=false).";
    }

    try {
      riaValue = await syncRiaDataForParcel(parcel.latitude, parcel.longitude);
    } catch (error) {
      riaError = error instanceof Error ? error.message : "Error RIA";
    }

    const siar = siarValue
      ? { station: siarValue.station, data: siarValue.dailyData, error: siarValue.error ?? siarError }
      : { station: null, data: [] as Record<string, unknown>[], error: siarError ?? "Error SIAR" };
    const ria = riaValue
      ? { station: riaValue.station, data: riaValue.dailyData, error: riaValue.error ?? riaError }
      : { station: null, data: [] as Record<string, unknown>[], error: riaError ?? "Error RIA" };

    return NextResponse.json({ siar, ria });
  } catch (error) {
    console.error("Error fetching station data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
