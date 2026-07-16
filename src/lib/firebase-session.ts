import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isAdminEmail, isAuthReady } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

const sessionCookieName = "javuro_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

type FirebaseAccount = {
  disabled?: boolean;
  displayName?: string;
  email?: string;
  emailVerified?: boolean;
  localId?: string;
  photoUrl?: string;
  providerUserInfo?: Array<{ providerId?: string }>;
};

export type ServerViewer = {
  email: string;
  id: string;
  image: string | null;
  isAdmin: boolean;
  name: string;
};

export async function createFirebaseSession(idToken: string) {
  if (!isAuthReady()) {
    throw new Error("Authentication is not configured.");
  }

  const firebaseAccount = await lookupFirebaseAccount(idToken);

  if (
    !firebaseAccount?.localId ||
    !firebaseAccount.email ||
    firebaseAccount.disabled
  ) {
    throw new Error("Firebase account could not be verified.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid: firebaseAccount.localId },
        { email: firebaseAccount.email.toLowerCase() },
      ],
    },
  });
  const userData = {
    authProvider:
      firebaseAccount.providerUserInfo?.[0]?.providerId ?? "firebase",
    email: firebaseAccount.email.toLowerCase(),
    emailVerified: firebaseAccount.emailVerified ? new Date() : null,
    firebaseUid: firebaseAccount.localId,
    image: firebaseAccount.photoUrl ?? null,
    name: firebaseAccount.displayName ?? null,
  };
  const user = existingUser
    ? await prisma.user.update({
        data: userData,
        where: { id: existingUser.id },
      })
    : await prisma.user.create({ data: userData });

  const rawToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionMaxAgeSeconds * 1000);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expires: { lte: new Date() } } }),
    prisma.session.create({
      data: {
        expires,
        tokenHash: hashSessionToken(rawToken),
        userId: user.id,
      },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, rawToken, {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return toViewer(user);
}

export async function getCurrentViewer(): Promise<ServerViewer | null> {
  if (!isAuthReady()) {
    return null;
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(sessionCookieName)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    include: { user: true },
    where: { tokenHash: hashSessionToken(rawToken) },
  });

  if (!session || session.expires <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }

    return null;
  }

  return toViewer(session.user);
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(sessionCookieName)?.value;

  if (rawToken && process.env.DATABASE_URL) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(rawToken) },
    });
  }

  cookieStore.set(sessionCookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function lookupFirebaseAccount(idToken: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey ?? "")}`,
    {
      body: JSON.stringify({ idToken }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { users?: FirebaseAccount[] };
  return payload.users?.[0] ?? null;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toViewer(user: {
  email: string | null;
  id: string;
  image: string | null;
  name: string | null;
}): ServerViewer {
  return {
    email: user.email ?? "",
    id: user.id,
    image: user.image,
    isAdmin: isAdminEmail(user.email),
    name: user.name ?? "JAVURO user",
  };
}
