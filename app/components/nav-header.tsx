import Link from "next/link";

export default function NavHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 2v10l6.5-6.5" />
              <path d="M22 12a10 10 0 0 0-10-10" />
            </svg>
          </div>
          <span className="text-base font-bold text-zinc-800 dark:text-zinc-100">
            AgroNode
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-green-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-green-400"
          >
            Parcelas
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-green-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-green-400"
          >
            Dashboard
          </Link>
          <Link
            href="/iot"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-green-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-green-400"
          >
            IoT
          </Link>
        </nav>
      </div>
    </header>
  );
}
