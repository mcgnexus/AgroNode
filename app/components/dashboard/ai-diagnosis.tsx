"use client";

import { useState, useTransition } from "react";
import { generateDashboardReport, type DiagnosisReport } from "@/app/actions/generate-report";

type RiskLevel = "LOW" | "MED" | "HIGH";

function getRiskStyle(level: RiskLevel | string) {
  switch (level) {
    case "HIGH":
      return "bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400";
    case "MED":
      return "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400";
    default:
      return "bg-green-50 border-green-300 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-400";
  }
}

function getRiskLabel(level: RiskLevel | string) {
  switch (level) {
    case "HIGH": return "ALTO";
    case "MED": return "MEDIO";
    case "LOW": return "BAJO";
    default: return level;
  }
}

function getRiskIcon(level: RiskLevel | string) {
  switch (level) {
    case "HIGH":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "MED":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
  }
}

function getIrrigationStyle(decision: string) {
  switch (decision) {
    case "IRRIGATE_NOW":
      return { label: "Regar ahora", bg: "bg-red-600 text-white" };
    case "DELAY":
      return { label: "Posponer riego", bg: "bg-amber-500 text-white" };
    default:
      return { label: "Sin riego necesario", bg: "bg-green-600 text-white" };
  }
}

function RiskBadge({ label, level }: { label: string; level: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${getRiskStyle(level)}`}>
      {getRiskIcon(level)}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider opacity-75">{label}</p>
        <p className="text-sm font-bold">{getRiskLabel(level)}</p>
      </div>
    </div>
  );
}

export default function AiDiagnosis() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    report: DiagnosisReport | null;
    error: string | null;
  } | null>(null);

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateDashboardReport();
      setResult({ report: res.report, error: res.error });
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Diagnóstico IA
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Análisis automatizado con DeepSeek
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analizando...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Generar Diagnóstico
            </>
          )}
        </button>
      </div>

      {result?.error && !result.report && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
          {result.error}
        </div>
      )}

      {result?.report && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <RiskBadge label="Estrés hídrico" level={result.report.waterStress} />
            <RiskBadge label="Riesgo hongos" level={result.report.diseaseRisk} />
            <RiskBadge label="Riesgo helada" level={result.report.frostRisk} />
          </div>

          <div className={`rounded-lg px-4 py-2.5 text-center text-sm font-bold ${getIrrigationStyle(result.report.irrigationDecision).bg}`}>
            {getIrrigationStyle(result.report.irrigationDecision).label}
          </div>

          <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
            {result.report.soilStatus && (
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold text-zinc-500">Suelo:</span> {result.report.soilStatus}
              </p>
            )}
            {result.report.deltaTAssessment && (
              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold text-zinc-500">ΔT:</span> {result.report.deltaTAssessment}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-xs font-medium text-green-800 dark:text-green-300">
              {result.report.actionableAdvice}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
