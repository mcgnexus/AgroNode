import { Suspense } from "react";
import NavHeader from "@/app/components/nav-header";
import IoTNodesList from "@/app/components/iot/nodes-list";
import { getNodesWithLatestReading } from "@/lib/iot-db";

export const dynamic = "force-dynamic";

async function getNodes() {
  return getNodesWithLatestReading();
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3 sm:space-y-4">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-24 sm:h-32 rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 py-16 sm:py-24 px-4">
      <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-700 dark:text-zinc-300">Sin nodos IoT</h2>
        <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          No hay nodos registrados en el sistema.
        </p>
      </div>
      <p className="text-[10px] sm:text-xs text-zinc-400 text-center max-w-xs">
        Registra un nodo usando la API: POST /api/nodes
      </p>
    </div>
  );
}

async function IoTContent() {
  try {
    const nodes = await getNodes();
    if (nodes.length === 0) return <EmptyState />;
    return <IoTNodesList nodes={nodes} />;
  } catch (err) {
    console.error("Error fetching IoT data:", err);
    return <EmptyState />;
  }
}

export default function IoTPage() {
  return (
    <>
      <NavHeader />
      <main className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100">
              Nodos IoT
            </h1>
          </div>
          <p className="mt-0.5 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
            Monitoreo de sensores ESP32 vía API REST
          </p>
        </div>
        <Suspense fallback={<LoadingSkeleton />}>
          <IoTContent />
        </Suspense>
      </main>
    </>
  );
}