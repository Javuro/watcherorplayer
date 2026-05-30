const cities = [
  { name: "Seoul", status: "Genesis city", wallets: "0" },
  { name: "NYC", status: "Waiting for signal", wallets: "0" },
  { name: "LA", status: "Waiting for signal", wallets: "0" },
  { name: "Chicago", status: "Waiting for signal", wallets: "0" },
];

const steps = [
  "Connect or create a wallet",
  "Choose a city and role",
  "Claim 100 JXRO",
  "Return daily for Proof Logs and Signal Points",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070809] text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-zinc-500">
          <span>Watcher or Player</span>
          <span>JAVURO Signal 01</span>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 text-sm uppercase tracking-[0.35em] text-[#7dd3fc]">
              The arena is opening
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-7xl">
              AI can fake content.
              <span className="block text-zinc-500">
                It cannot fake presence.
              </span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-zinc-300">
              Enter with a wallet, choose your city, and decide whether you
              will watch the signal or become one.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button className="h-12 rounded-md bg-white px-6 text-sm font-semibold text-black transition hover:bg-zinc-200">
                Enter Arena
              </button>
              <button className="h-12 rounded-md border border-zinc-700 px-6 text-sm font-semibold text-zinc-100 transition hover:border-zinc-400">
                View Signal Feed
              </button>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-sm font-semibold text-white">Watcher</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Judge Real or Noise. Read the city. Build signal points.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-sm font-semibold text-white">Player</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Check in from your city. Drop proof. Move the map.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl shadow-sky-950/20">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Genesis Claim
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  First 10,000 wallets
                </p>
              </div>
              <div className="rounded-md bg-[#10202a] px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
                  Reward
                </p>
                <p className="text-lg font-semibold text-white">100 JXRO</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {steps.map((step, index) => (
                <div
                  className="flex items-center gap-3 rounded-lg bg-zinc-900/70 p-3"
                  key={step}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                    {index + 1}
                  </span>
                  <span className="text-sm text-zinc-300">{step}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-zinc-800">
              <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-white">
                City Arenas
              </div>
              {cities.map((city) => (
                <div
                  className="flex items-center justify-between border-b border-zinc-900 px-4 py-3 last:border-b-0"
                  key={city.name}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {city.name}
                    </p>
                    <p className="text-xs text-zinc-500">{city.status}</p>
                  </div>
                  <p className="text-sm text-zinc-400">{city.wallets} wallets</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
