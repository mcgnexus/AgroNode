import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncForecastForParcel } from "@/lib/services/weather.service";

export async function GET() {
  const parcels = await prisma.parcel.findMany({
    select: { id: true, name: true },
  });

  if (parcels.length === 0) {
    return NextResponse.json({
      message: "No hay parcelas registradas",
      updated: 0,
      failed: 0,
      results: [],
    });
  }

  const results = await Promise.allSettled(
    parcels.map((p) => syncForecastForParcel(p.id))
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof syncForecastForParcel>>> => r.status === "fulfilled")
    .map((r) => r.value);

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r, i) => ({
      parcelId: parcels[i].id,
      parcelName: parcels[i].name,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }));

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total: parcels.length,
    updated: succeeded.length,
    failed: failed.length,
    details: { succeeded, failed },
  });
}
