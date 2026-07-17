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

  const now = new Date();
  const [
    users,
    walletCount,
    claimCount,
    pendingClaimCount,
    proofCount,
    reactionCount,
    activeSessionCount,
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        claims: {
          include: { wallet: { select: { address: true } } },
          orderBy: { createdAt: "desc" },
        },
        proofs: {
          include: {
            reactions: {
              include: { user: { select: { email: true, id: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        reactions: {
          include: {
            proof: { select: { caption: true, cityName: true, id: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, expires: true, id: true },
        },
        wallets: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wallet.count(),
    prisma.claim.count(),
    prisma.claim.count({ where: { status: "PENDING" } }),
    prisma.proof.count(),
    prisma.reaction.count(),
    prisma.session.count({ where: { expires: { gt: now } } }),
  ]);

  return (
    <main className="min-h-screen bg-[#060708] px-4 py-7 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col justify-between gap-5 border-b border-zinc-800 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#7ee0bd]">
              Admin registry
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-white">
              Subscriber data
            </h1>
            <p className="mt-3 text-sm text-zinc-500">
              Complete authenticated account and participation records.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-700 px-4 text-sm font-semibold text-white"
            href="/"
          >
            Open arena
          </Link>
        </header>

        <section className="mt-6 grid gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric label="Subscribers" value={users.length} />
          <Metric label="Active sessions" value={activeSessionCount} />
          <Metric label="Wallets" value={walletCount} />
          <Metric label="Claims" value={claimCount} />
          <Metric label="Pending claims" value={pendingClaimCount} />
          <Metric label="Proofs" value={proofCount} />
          <Metric label="Reactions" value={reactionCount} />
        </section>

        <section className="mt-6 overflow-hidden rounded-md border border-zinc-800 bg-[#0b0b0c]">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">All subscribers</h2>
            <p className="mt-1 text-xs text-zinc-500">
              No row limit. Newest accounts appear first.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-950 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <tr>
                  <TableHead>Account</TableHead>
                  <TableHead>Firebase UID</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Role / city</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>Proofs</TableHead>
                  <TableHead>Joined</TableHead>
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
                    <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                      {user.firebaseUid}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {user.authProvider}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {user.role ?? "-"} / {user.cityName ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {user.emailVerified ? "Yes" : "No"}
                    </td>
                    <td className="px-5 py-4 text-white">
                      {user.wallets.length}
                    </td>
                    <td className="px-5 py-4 text-white">
                      {user.claims.length}
                    </td>
                    <td className="px-5 py-4 text-white">
                      {user.proofs.length}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
                {!users.length ? (
                  <tr>
                    <td className="px-5 py-12 text-center text-zinc-500" colSpan={9}>
                      No authenticated subscribers yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-white">Full records</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Expand an account to inspect every stored operational record.
            </p>
          </div>
          <div className="space-y-2">
            {users.map((user) => (
              <details
                className="group rounded-md border border-zinc-800 bg-[#0b0b0c] open:border-zinc-700"
                key={user.id}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-white">
                      {user.name ?? "Unnamed account"}
                    </span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">
                      {user.email ?? "No email"} · {user.role ?? "NO ROLE"} · {user.cityName ?? "NO CITY"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-[#7ee0bd] group-open:text-white">
                    View record
                  </span>
                </summary>

                <div className="border-t border-zinc-800 px-5 py-5">
                  <RecordGrid
                    values={[
                      ["Database ID", user.id],
                      ["Firebase UID", user.firebaseUid],
                      ["Provider", user.authProvider],
                      ["Name", user.name],
                      ["Email", user.email],
                      ["Email verified", formatOptionalDate(user.emailVerified)],
                      ["Image URL", user.image],
                      ["Role", user.role],
                      ["City", user.cityName],
                      ["Country", user.countryCode],
                      ["Created", formatDate(user.createdAt)],
                      ["Updated", formatDate(user.updatedAt)],
                    ]}
                  />

                  <DataSection title={`Sessions (${user.sessions.length})`}>
                    <DataTable headers={["Session ID", "Created", "Expires", "State"]}>
                      {user.sessions.map((session) => (
                        <tr className="border-t border-zinc-900" key={session.id}>
                          <DataCell mono>{session.id}</DataCell>
                          <DataCell>{formatDate(session.createdAt)}</DataCell>
                          <DataCell>{formatDate(session.expires)}</DataCell>
                          <DataCell>
                            {session.expires > now ? "Active" : "Expired"}
                          </DataCell>
                        </tr>
                      ))}
                      <EmptyDataRow colSpan={4} show={!user.sessions.length} />
                    </DataTable>
                  </DataSection>

                  <DataSection title={`Wallets (${user.wallets.length})`}>
                    <DataTable headers={["Address", "Chain", "Primary", "Verified", "Connected"]}>
                      {user.wallets.map((wallet) => (
                        <tr className="border-t border-zinc-900" key={wallet.id}>
                          <DataCell mono>{wallet.address}</DataCell>
                          <DataCell>{wallet.chainId}</DataCell>
                          <DataCell>{wallet.isPrimary ? "Yes" : "No"}</DataCell>
                          <DataCell>{formatOptionalDate(wallet.verifiedAt)}</DataCell>
                          <DataCell>{formatDate(wallet.createdAt)}</DataCell>
                        </tr>
                      ))}
                      <EmptyDataRow colSpan={5} show={!user.wallets.length} />
                    </DataTable>
                  </DataSection>

                  <DataSection title={`Claims (${user.claims.length})`}>
                    <DataTable headers={["Campaign", "Amount", "Status", "Wallet", "Transaction", "Created", "Submitted", "Paid", "Failure"]}>
                      {user.claims.map((claim) => (
                        <tr className="border-t border-zinc-900" key={claim.id}>
                          <DataCell>{claim.campaignKey}</DataCell>
                          <DataCell>{claim.amount.toString()} JXRO</DataCell>
                          <DataCell>{claim.status}</DataCell>
                          <DataCell mono>{claim.wallet.address}</DataCell>
                          <DataCell mono>{claim.transactionHash ?? "-"}</DataCell>
                          <DataCell>{formatDate(claim.createdAt)}</DataCell>
                          <DataCell>{formatOptionalDate(claim.submittedAt)}</DataCell>
                          <DataCell>{formatOptionalDate(claim.paidAt)}</DataCell>
                          <DataCell>{claim.failureReason ?? "-"}</DataCell>
                        </tr>
                      ))}
                      <EmptyDataRow colSpan={9} show={!user.claims.length} />
                    </DataTable>
                  </DataSection>

                  <DataSection title={`Proofs (${user.proofs.length})`}>
                    <DataTable headers={["Caption", "City", "Image", "Captured", "Status", "Reactions"]}>
                      {user.proofs.map((proof) => (
                        <tr className="border-t border-zinc-900" key={proof.id}>
                          <DataCell>{proof.caption}</DataCell>
                          <DataCell>{proof.cityName} {proof.countryCode ?? ""}</DataCell>
                          <DataCell>
                            <a className="text-[#7ee0bd] underline" href={proof.imageUrl} rel="noreferrer" target="_blank">
                              Open image
                            </a>
                          </DataCell>
                          <DataCell>{formatDate(proof.capturedAt)}</DataCell>
                          <DataCell>{proof.status}</DataCell>
                          <DataCell>
                            {proof.reactions.length
                              ? proof.reactions.map((reaction) => `${reaction.kind}: ${reaction.user.email ?? reaction.user.id}`).join(", ")
                              : "-"}
                          </DataCell>
                        </tr>
                      ))}
                      <EmptyDataRow colSpan={6} show={!user.proofs.length} />
                    </DataTable>
                  </DataSection>

                  <DataSection title={`Reactions made (${user.reactions.length})`}>
                    <DataTable headers={["Kind", "Proof", "City", "Caption", "Created"]}>
                      {user.reactions.map((reaction) => (
                        <tr className="border-t border-zinc-900" key={reaction.id}>
                          <DataCell>{reaction.kind}</DataCell>
                          <DataCell mono>{reaction.proof.id}</DataCell>
                          <DataCell>{reaction.proof.cityName}</DataCell>
                          <DataCell>{reaction.proof.caption}</DataCell>
                          <DataCell>{formatDate(reaction.createdAt)}</DataCell>
                        </tr>
                      ))}
                      <EmptyDataRow colSpan={5} show={!user.reactions.length} />
                    </DataTable>
                  </DataSection>
                </div>
              </details>
            ))}
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
        Add the missing Railway variables and apply the database migration to
        activate the registry.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {checks.map((check) => (
          <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 p-4" key={check.label}>
            <span className="text-sm font-semibold text-white">{check.label}</span>
            <span className={`text-xs uppercase tracking-[0.18em] ${check.ready ? "text-[#7ee0bd]" : "text-amber-300"}`}>
              {check.ready ? "Ready" : "Required"}
            </span>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

function AdminShell({ children, eyebrow, title }: { children: React.ReactNode; eyebrow: string; title: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060708] px-5 text-zinc-100">
      <section className="w-full max-w-3xl rounded-md border border-zinc-800 bg-[#0b0b0c] p-7">
        <p className="text-xs uppercase tracking-[0.26em] text-[#7ee0bd]">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
        <div className="mt-4">{children}</div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0b0b0c] p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-4 font-medium">{children}</th>;
}

function RecordGrid({ values }: { values: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-px overflow-hidden border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {values.map(([label, value]) => (
        <div className="min-w-0 bg-zinc-950 px-4 py-3" key={label}>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">{label}</dt>
          <dd className="mt-2 break-all font-mono text-xs text-zinc-300">{value == null || value === "" ? "-" : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mt-6 border-t border-zinc-800 pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function DataTable({ children, headers }: { children: React.ReactNode; headers: string[] }) {
  return (
    <table className="w-full min-w-[760px] border-collapse text-left text-xs">
      <thead className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
        <tr>{headers.map((header) => <th className="px-3 py-2 font-medium" key={header}>{header}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function DataCell({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`max-w-[360px] break-words px-3 py-3 text-zinc-400 ${mono ? "font-mono" : ""}`}>{children}</td>;
}

function EmptyDataRow({ colSpan, show }: { colSpan: number; show: boolean }) {
  return show ? (
    <tr className="border-t border-zinc-900">
      <td className="px-3 py-5 text-center text-zinc-600" colSpan={colSpan}>No records</td>
    </tr>
  ) : null;
}

function formatDate(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function formatOptionalDate(value: Date | null) {
  return value ? formatDate(value) : "-";
}
