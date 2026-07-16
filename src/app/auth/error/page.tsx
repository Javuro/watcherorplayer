import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060708] px-5 text-zinc-100">
      <section className="w-full max-w-lg rounded-lg border border-zinc-800 bg-[#0b0b0c] p-7">
        <p className="text-xs uppercase tracking-[0.26em] text-amber-300">
          Account signal interrupted
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">
          Google sign-in could not finish.
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-400">
          Return to the arena and try again. If this keeps happening, check the
          Firebase authorized domains and Google provider settings.
        </p>
        <Link
          className="mt-7 inline-flex h-12 items-center rounded-md bg-white px-5 text-sm font-semibold text-black"
          href="/"
        >
          Return to arena
        </Link>
      </section>
    </main>
  );
}
