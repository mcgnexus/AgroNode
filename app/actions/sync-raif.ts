"use server";

import { prisma } from "@/lib/prisma";
import { evaluateRaifAlertsForParcel } from "@/lib/services/raif-alert-agent.service";
import { notifyRaifHighAlerts } from "@/lib/services/raif-notifier.service";

export interface RaifSyncResult {
  ok: boolean;
  total: number;
  succeeded: number;
  failed: number;
  highAlerts: number;
  notificationsSent: number;
  details: {
    parcelName: string;
    highAlerts: number;
    notified: boolean;
    reason?: string;
    error?: string;
  }[];
  error?: string;
}

export async function syncRaifAlerts(): Promise<RaifSyncResult> {
  const parcels = await prisma.parcel.findMany({
    select: { id: true, name: true },
  });

  if (parcels.length === 0) {
    return {
      ok: true,
      total: 0,
      succeeded: 0,
      failed: 0,
      highAlerts: 0,
      notificationsSent: 0,
      details: [],
    };
  }

  const details: RaifSyncResult["details"] = [];
  let succeeded = 0;
  let failed = 0;
  let highAlerts = 0;
  let notificationsSent = 0;

  for (const parcel of parcels) {
    try {
      const evaluated = await evaluateRaifAlertsForParcel(parcel.id);
      if (!evaluated || evaluated.highAlerts.length === 0) {
        details.push({
          parcelName: parcel.name,
          highAlerts: 0,
          notified: false,
          reason: "Sin alertas high",
        });
        succeeded++;
        continue;
      }

      highAlerts += evaluated.highAlerts.length;

      const notifyResult = await notifyRaifHighAlerts(evaluated);
      const sent = notifyResult.attempts.filter((a) => a.ok).length;
      notificationsSent += sent;

      details.push({
        parcelName: parcel.name,
        highAlerts: evaluated.highAlerts.length,
        notified: notifyResult.notified,
        reason: notifyResult.reason,
      });
      succeeded++;
    } catch (error) {
      failed++;
      details.push({
        parcelName: parcel.name,
        highAlerts: 0,
        notified: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: failed === 0,
    total: parcels.length,
    succeeded,
    failed,
    highAlerts,
    notificationsSent,
    details,
  };
}
