import { ArenaApp } from "@/features/arena/arena-app";
import { isAuthReady } from "@/lib/auth-config";
import { getCurrentViewer } from "@/lib/firebase-session";

export default async function Home() {
  const authReady = isAuthReady();
  const viewer = authReady ? await getCurrentViewer() : null;

  return (
    <ArenaApp
      authReady={authReady}
      viewer={viewer}
    />
  );
}
