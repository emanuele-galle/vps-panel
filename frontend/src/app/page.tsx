export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Pannello Controllo VPS</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Gestione VPS moderna e semplice
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition"
          >
            Accedi
          </a>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-border rounded-md hover:bg-accent transition"
          >
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
