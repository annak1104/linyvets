import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-primary-hover">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Сторінку не знайдено</h1>
        <Link className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary-hover underline-offset-4 hover:underline" href="/">
          <ArrowLeft className="size-4" />
          На головну
        </Link>
      </div>
    </main>
  );
}
