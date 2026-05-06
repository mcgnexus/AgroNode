import type { RaifParcelAlertEvaluation, RaifSeverity } from "@/lib/services/raif-alert-agent.service";

function severityBadge(severity: RaifSeverity) {
  if (severity === "high") {
    return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  }
  if (severity === "medium") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
}

function severityLabel(severity: RaifSeverity) {
  if (severity === "high") return "ALTA";
  if (severity === "medium") return "MEDIA";
  return "BAJA";
}

export default function RaifAlerts({ result }: { result: RaifParcelAlertEvaluation | null }) {
  if (!result) return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Avisos RAIF
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Cultivo: <span className="font-medium">{result.cropName}</span>
            {result.province ? <> · Provincia: <span className="font-medium">{result.province}</span></> : null}
          </p>
        </div>
        <div className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          Fuente: {result.fromCache ? "Caché RAIF" : "RAIF tiempo real"} · Coincidencias: {result.totalCandidates}
        </div>
      </div>

      {result.alerts.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          Sin avisos RAIF relevantes para este cultivo/zona.
        </div>
      ) : (
        <div className="space-y-3">
          {result.alerts.map((alert) => (
            <article
              key={alert.signature}
              className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{alert.title}</h4>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${severityBadge(alert.severity)}`}>
                  {severityLabel(alert.severity)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {alert.date} · {alert.source}
              </p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{alert.reason}</p>
              <p className="mt-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Acción: {alert.recommendation}
              </p>
              {alert.url ? (
                <a
                  href={alert.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-green-700 underline underline-offset-2 dark:text-green-400"
                >
                  Ver aviso RAIF
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
