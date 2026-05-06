import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncForecastForParcel } from "@/lib/services/weather.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  try {
    console.log(`[SYNC] Starting sync for parcel ${id} (${parcel.name})`);
    const result = await syncForecastForParcel(id);
    console.log(`[SYNC] Completed for parcel ${id}:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[SYNC] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al sincronizar" },
      { status: 500 }
    );
  }
}