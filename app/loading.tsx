export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex items-center gap-3 rounded-full border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Завантаження Лінивця…
      </div>
    </main>
  );
}
