import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isAdminEmail,
  isAuthReady,
  isDatabaseConfigured,
  isFirebaseConfigured,
} from "@/lib/auth-config";
import { getCurrentViewer } from "@/lib/firebase-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAuthReady()) {
    return <AdminSetupState />;
  }

  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/?continue=account");
  }

  if (!isAdminEmail(viewer.email)) {
    return (
      <AdminShell title="Access restricted" eyebrow="Admin registry">
        <p className="max-w-xl text-sm leading-7 text-zinc-400">
          This Firebase account is authenticated, but it is not included in the
          ADMIN_EMAILS allowlist.
        </p>
        <Link
          className="mt-7 inline-flex h-11 items-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-white"
          href="/"
        >
          Return to arena
        </Link>
      </AdminShell>
    );
  }

  const [users, userCount, walletCount, pendingClaimCount, proofCount] =
    await Promise.all([
      prisma.user.findMany({
        include: {
          _count: {
            select: { claims: true, proofs: true, wallets: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.user.count(),
      prisma.wallet.count(),
      prisma.claim.count({ where: { status: "PENDING" } }),
      prisma.proof.count(),
    ]);

  return (
    <main className="min-h-screen bg-[#060708] px-5 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 border-b border-zinc-800 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7ee0bd]">
              Admin registry
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white">
              Live account records
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Latest 200 authenticated users. Emails remain admin-only.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-white"
            href="/"
          >
            Open arena
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Firebase users" value={userCount} />
          <Metric label="Linked wallets" value={walletCount} />
          <Metric label="Pending claims" value={pendingClaimCount} />
          <Metric label="Signal proofs" value={proofCount} />
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-800 bg-[#0b0b0c]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Account</th>
                  <th className="px-5 py-4 font-medium">Provider</th>
                  <th className="px-5 py-4 font-medium">Role / city</th>
                  <th className="px-5 py-4 font-medium">Wallets</th>
                  <th className="px-5 py-4 font-medium">Claims</th>
                  <th className="px-5 py-4 font-medium">Proofs</th>
                  <th className="px-5 py-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr className="border-b border-zinc-900" key={user.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">
                        {user.name ?? "Unnamed account"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{user.email}</p>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {user.authProvider}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {user.role ?? "-"} / {user.cityName ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-white">{user._count.wallets}</td>
                    <td className="px-5 py-4 text-white">{user._count.claims}</td>
                    <td className="px-5 py-4 text-white">{user._count.proofs}</td>
                    <td className="px-5 py-4 text-zinc-500">
                      {user.createdAt.toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-zinc-500" colSpan={7}>
                      No authenticated users yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminSetupState() {
  const checks = [
    { label: "PostgreSQL", ready: isDatabaseConfigured() },
    { label: "Firebase web config", ready: isFirebaseConfigured() },
  ];

  return (
    <AdminShell title="Connect the service credentials" eyebrow="Admin registry">
      <p className="max-w-2xl text-sm leading-7 text-zinc-400">
        The admin registry is implemented. Add the missing Railway variables,
        apply the database migration, and this page will begin collecting Firebase
        accounts automatically.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 p-4"
            key={check.label}
          >
            <span className="text-sm font-semibold text-white">{check.label}</span>
            <span
              className={`text-xs uppercase tracking-[0.18em] ${
                check.ready ? "text-[#7ee0bd]" : "text-amber-300"
              }`}
            >
              {check.ready ? "Ready" : "Required"}
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function AdminShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060708] px-5 text-zinc-100">
      <section className="w-full max-w-3xl rounded-lg border border-zinc-800 bg-[#0b0b0c] p-7">
        <p className="text-xs uppercase tracking-[0.26em] text-[#7ee0bd]">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0b0b0c] p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
