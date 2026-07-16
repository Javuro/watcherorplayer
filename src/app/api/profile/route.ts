import { isAuthReady } from "@/lib/auth-config";
import { getCurrentViewer } from "@/lib/firebase-session";
import { prisma } from "@/lib/prisma";

type ProfilePayload = {
  cityName?: unknown;
  countryCode?: unknown;
  role?: unknown;
};

export async function PATCH(request: Request) {
  if (!isAuthReady()) {
    return Response.json({ error: "Authentication is not ready." }, { status: 503 });
  }

  const viewer = await getCurrentViewer();

  if (!viewer) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProfilePayload;
  const role = body.role === "watcher" ? "WATCHER" : body.role === "player" ? "PLAYER" : null;
  const cityName =
    typeof body.cityName === "string" ? body.cityName.trim().slice(0, 80) : "";
  const countryCode =
    typeof body.countryCode === "string"
      ? body.countryCode.trim().toUpperCase().slice(0, 2)
      : "";

  if (!role || !cityName) {
    return Response.json({ error: "Invalid profile payload." }, { status: 400 });
  }

  await prisma.user.update({
    data: {
      cityName,
      countryCode: countryCode || null,
      role,
    },
    where: { id: viewer.id },
  });

  return Response.json({ ok: true });
}
