import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const hours = parseInt(searchParams.get("hours") ?? "48", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500", 10), 2000);

  const parcel = await prisma.parcel.findUnique({ where: { id } });
  if (!parcel) {
    return NextResponse.json({ error: "Parcela no encontrada" }, { status: 404 });
  }

  const since = new Date();
  since.setHours(since.getHours() - hours);

  const data = await prisma.sensorData.findMany({
    where: {
      parcelId: id,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "asc" },
    take: limit,
  });

  return NextResponse.json(data);
}
