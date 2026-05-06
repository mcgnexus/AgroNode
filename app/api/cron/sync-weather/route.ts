import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncForecastForParcel } from "@/lib/services/weather.service";
import { evaluateParcelWeatherAlerts } from "@/lib/services/parcel-weather-alerts.service";
import { notifyHighAlerts, summarizeHighAlerts } from "@/lib/services/alert-notifier.service";
import { evaluateRaifAlertsForParcel } from "@/lib/services/raif-alert-agent.service";
import { notifyRaifHighAlerts } from "@/lib/services/raif-notifier.service";

export const dynamic = "force-dynamic";

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

  const succeeded: Awaited<ReturnType<typeof syncForecastForParcel>>[] = [];
  const failed: { parcelId: string; parcelName: string; error: string }[] = [];
  const notifications: {
    parcelId: string;
    parcelName: string;
    highAlerts: number;
    highAlertSummary: string;
    notified: boolean;
    reason?: string;
    delivery: { sent: number; failed: number };
  }[] = [];
  const raifNotifications: {
    parcelId: string;
    parcelName: string;
    totalCandidates: number;
    highAlerts: number;
    notified: boolean;
    reason?: string;
    delivery: { sent: number; failed: number };
  }[] = [];

  for (const parcel of parcels) {
    try {
      const synced = await syncForecastForParcel(parcel.id);
      succeeded.push(synced);
    } catch (error) {
      failed.push({
        parcelId: parcel.id,
        parcelName: parcel.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      const evaluated = await evaluateParcelWeatherAlerts(parcel.id);
      if (!evaluated || evaluated.highAlerts.length === 0) {
        notifications.push({
          parcelId: parcel.id,
          parcelName: parcel.name,
          highAlerts: 0,
          highAlertSummary: "",
          notified: false,
          reason: "Sin alertas high",
          delivery: { sent: 0, failed: 0 },
        });
        continue;
      }

      const notifyResult = await notifyHighAlerts(evaluated);
      const sent = notifyResult.attempts.filter((a) => a.ok).length;
      const failedDeliveries = notifyResult.attempts.length - sent;

      notifications.push({
        parcelId: parcel.id,
        parcelName: parcel.name,
        highAlerts: evaluated.highAlerts.length,
        highAlertSummary: summarizeHighAlerts(evaluated.highAlerts),
        notified: notifyResult.notified,
        reason: notifyResult.reason,
        delivery: { sent, failed: failedDeliveries },
      });
    } catch (error) {
      notifications.push({
        parcelId: parcel.id,
        parcelName: parcel.name,
        highAlerts: 0,
        highAlertSummary: "",
        notified: false,
        reason: `Error evaluando/notificando alertas: ${error instanceof Error ? error.message : String(error)}`,
        delivery: { sent: 0, failed: 0 },
      });
    }

    try {
      const evaluatedRaif = await evaluateRaifAlertsForParcel(parcel.id);
      if (!evaluatedRaif || evaluatedRaif.highAlerts.length === 0) {
        raifNotifications.push({
          parcelId: parcel.id,
          parcelName: parcel.name,
          totalCandidates: evaluatedRaif?.totalCandidates ?? 0,
          highAlerts: 0,
          notified: false,
          reason: "Sin alertas RAIF high",
          delivery: { sent: 0, failed: 0 },
        });
      } else {
        const notifyRaif = await notifyRaifHighAlerts(evaluatedRaif);
        const sent = notifyRaif.attempts.filter((a) => a.ok).length;
        raifNotifications.push({
          parcelId: parcel.id,
          parcelName: parcel.name,
          totalCandidates: evaluatedRaif.totalCandidates,
          highAlerts: evaluatedRaif.highAlerts.length,
          notified: notifyRaif.notified,
          reason: notifyRaif.reason,
          delivery: {
            sent,
            failed: notifyRaif.attempts.length - sent,
          },
        });
      }
    } catch (error) {
      raifNotifications.push({
        parcelId: parcel.id,
        parcelName: parcel.name,
        totalCandidates: 0,
        highAlerts: 0,
        notified: false,
        reason: `Error evaluando/notificando RAIF: ${error instanceof Error ? error.message : String(error)}`,
        delivery: { sent: 0, failed: 0 },
      });
    }
  }

  const notificationsSent = notifications.filter((n) => n.delivery.sent > 0).length;
  const raifNotificationsSent = raifNotifications.filter((n) => n.delivery.sent > 0).length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total: parcels.length,
    updated: succeeded.length,
    failed: failed.length,
    notificationsChecked: notifications.length,
    notificationsSent,
    raifNotificationsChecked: raifNotifications.length,
    raifNotificationsSent,
    details: { succeeded, failed, notifications, raifNotifications },
  });
}
