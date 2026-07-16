import {
  createFirebaseSession,
  destroyCurrentSession,
} from "@/lib/firebase-session";
import { isAuthReady } from "@/lib/auth-config";

export async function POST(request: Request) {
  if (!isAuthReady()) {
    return Response.json(
      { error: "Authentication is not ready." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { idToken?: unknown };

    if (typeof body.idToken !== "string" || body.idToken.length < 100) {
      return Response.json({ error: "Invalid Firebase ID token." }, { status: 400 });
    }

    const viewer = await createFirebaseSession(body.idToken);
    return Response.json({ viewer });
  } catch {
    return Response.json(
      { error: "Firebase sign-in could not be completed." },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await destroyCurrentSession();
  return Response.json({ ok: true });
}
