import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parcel = await prisma.parcel.findUnique({
    where: { id },
    include: {
      sensorData: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
      _count: { select: { sensorData: true, weatherForecasts: true, aiInteractionLogs: true } },
    },
  });

  if (!parcel) {
    return NextResponse.json(
      { error: "Parcela no encontrada" },
      { status: 404 }
    );
  }

  return NextResponse.json(parcel);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.parcel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Parcela no encontrada" },
        { status: 404 }
      );
    }

    const parcel = await prisma.parcel.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        latitude: body.latitude ?? existing.latitude,
        longitude: body.longitude ?? existing.longitude,
        cropType: body.cropType ?? existing.cropType,
        locationId: body.locationId ?? existing.locationId,
        municipioId: body.municipioId ?? existing.municipioId,
        municipioNombre: body.municipioNombre ?? existing.municipioNombre,
        zone: body.zone ?? existing.zone,
        microclimate: body.microclimate ?? existing.microclimate,
        description: body.description ?? existing.description,
        irrigationType: body.irrigationType ?? existing.irrigationType,
        nodeCode: body.nodeCode !== undefined ? body.nodeCode : existing.nodeCode,
      },
    });

    return NextResponse.json(parcel);
  } catch (error) {
    console.error("Error updating parcel:", error);
    return NextResponse.json(
      { error: "Error al actualizar la parcela" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.parcel.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Parcela no encontrada" },
        { status: 404 }
      );
    }

    await prisma.parcel.delete({ where: { id } });

    return NextResponse.json({ message: "Parcela eliminada correctamente" });
  } catch (error) {
    console.error("Error deleting parcel:", error);
    return NextResponse.json(
      { error: "Error al eliminar la parcela" },
      { status: 500 }
    );
  }
}