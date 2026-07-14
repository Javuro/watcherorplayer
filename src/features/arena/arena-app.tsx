"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { type ArenaRole, campaignStats, cities } from "./campaign";
import { MapLibreSignalGlobe } from "./components/maplibre-signal-globe";
import {
  type ArenaState,
  type ProofLog,
  clearArenaState,
  clearProofLogs,
  createLocalId,
  createLocalTxHash,
  createLocalWalletAddress,
  loadArenaState,
  loadProofLogs,
  saveArenaState,
  saveProofLogs,
  shortenAddress,
} from "./storage";

type AppTab = "arena" | "map" | "feed" | "signal";
type OnboardingStep =
  | "intro"
  | "role"
  | "location"
  | "manualCity"
  | "wallet"
  | "claim"
  | "done";

const roleOptions: Record<
  ArenaRole,
  { title: string; action: string; description: string }
> = {
  watcher: {
    title: "Watcher",
    action: "Watch the signal",
    description: "Judge human proof and read where the arena moves next.",
  },
  player: {
    title: "Player",
    action: "Become the signal",
    description: "Enter from your city and prove presence with your wallet.",
  },
};

const stepOrder: OnboardingStep[] = [
  "intro",
  "role",
  "location",
  "wallet",
  "claim",
  "done",
];

const cityDetectionRadiusKm = 80;

export function ArenaApp() {
  const [arenaState, setArenaState] = useState<ArenaState | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedRole, setSelectedRole] = useState<ArenaRole>("player");
  const [selectedCityId, setSelectedCityId] = useState(cities[0].id);
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [activeTab, setActiveTab] = useState<AppTab>("arena");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isFindingArena, setIsFindingArena] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [proofLogs, setProofLogs] = useState<ProofLog[]>([]);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const savedState = loadArenaState();

      if (savedState) {
        setArenaState(savedState);
        setWalletAddress(savedState.walletAddress);
        setSelectedRole(savedState.role);
        setSelectedCityId(savedState.cityId);

        if (savedState.firstSignalClaimed) {
          setStep("done");
          setActiveTab("map");
        }
      }

      setProofLogs(loadProofLogs());
    }, 0);

    return () => window.clearTimeout(hydrateTimer);
  }, []);

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId) ?? cities[0],
    [selectedCityId],
  );

  const stepIndex = Math.max(0, stepOrder.indexOf(step));
  const progress = Math.round((stepIndex / (stepOrder.length - 1)) * 100);

  function goToStep(nextStep: OnboardingStep) {
    setStep(nextStep);
    setActiveTab("arena");
  }

  function startAsRole(role: ArenaRole) {
    setSelectedRole(role);
    goToStep("location");
  }

  function handleConnectWallet() {
    const nextWallet = walletAddress || createLocalWalletAddress();
    setWalletAddress(nextWallet);
    goToStep("claim");
  }

  function handleManualCitySelect(cityId: string) {
    setSelectedCityId(cityId);
    setLocationMessage("Arena selected manually. Exact location remains hidden.");
    goToStep("wallet");
  }

  function handleFindArena() {
    if (!("geolocation" in navigator)) {
      setLocationMessage("Location is unavailable in this browser.");
      goToStep("manualCity");
      return;
    }

    setIsFindingArena(true);
    setLocationMessage("Finding your city-level arena...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestCity = findNearestSupportedCity(
          position.coords.latitude,
          position.coords.longitude,
        );

        if (nearestCity) {
          setSelectedCityId(nearestCity.id);
          setLocationMessage(
            `Arena found: ${nearestCity.name}. Exact location hidden.`,
          );
          setIsFindingArena(false);
          goToStep("wallet");
          return;
        }

        setLocationMessage(
          "No supported arena was found nearby. Choose one manually for now.",
        );
        setIsFindingArena(false);
        goToStep("manualCity");
      },
      () => {
        setLocationMessage("Location skipped. Choose your arena manually.");
        setIsFindingArena(false);
        goToStep("manualCity");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 8_000,
      },
    );
  }

  async function handleClaim() {
    const connectedWallet = walletAddress || createLocalWalletAddress();

    if (!walletAddress) {
      setWalletAddress(connectedWallet);
    }

    setIsClaiming(true);
    await new Promise((resolve) => setTimeout(resolve, 550));

    const nextState: ArenaState = {
      walletAddress: connectedWallet,
      cityId: selectedCityId,
      role: selectedRole,
      firstSignalClaimed: true,
      claimedAt: new Date().toISOString(),
      txHash: createLocalTxHash(),
    };

    saveArenaState(nextState);
    setArenaState(nextState);
    setIsClaiming(false);
    setStep("done");
    setActiveTab("map");
  }

  function handleSubmitProof(imageDataUrl: string, caption: string) {
    const connectedWallet = walletAddress || createLocalWalletAddress();

    if (!walletAddress) {
      setWalletAddress(connectedWallet);
    }

    const nextLog: ProofLog = {
      id: createLocalId("proof"),
      walletAddress: connectedWallet,
      cityName: selectedCity.name,
      role: "player",
      caption,
      imageDataUrl,
      createdAt: new Date().toISOString(),
      real: 0,
      noise: 0,
    };
    const nextLogs = [nextLog, ...proofLogs];

    saveProofLogs(nextLogs);
    setProofLogs(nextLogs);
    setSelectedRole("player");
    setActiveTab("feed");
  }

  function handleReactToProof(logId: string, reaction: "real" | "noise") {
    const nextLogs = proofLogs.map((log) => {
      if (log.id !== logId) {
        return log;
      }

      const hadReal = log.reaction === "real" ? 1 : 0;
      const hadNoise = log.reaction === "noise" ? 1 : 0;

      return {
        ...log,
        real: Math.max(0, log.real - hadReal) + (reaction === "real" ? 1 : 0),
        noise:
          Math.max(0, log.noise - hadNoise) + (reaction === "noise" ? 1 : 0),
        reaction,
      };
    });

    saveProofLogs(nextLogs);
    setProofLogs(nextLogs);
  }

  function handleReset() {
    clearArenaState();
    setArenaState(null);
    setWalletAddress("");
    setSelectedRole("player");
    setSelectedCityId(cities[0].id);
    setLocationMessage("");
    clearProofLogs();
    setProofLogs([]);
    setStep("intro");
    setActiveTab("arena");
  }

  return (
    <main className="min-h-screen bg-[#060708] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col bg-[#0b0b0c]">
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-black uppercase text-white">
              Watcher or Player
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              A JAVURO signal
            </p>
          </div>
          <nav className="flex items-center gap-2">
            {arenaState?.firstSignalClaimed ? (
              <>
                <HeaderButton onClick={() => setActiveTab("map")}>Map</HeaderButton>
                <HeaderButton onClick={() => setActiveTab("feed")}>Feed</HeaderButton>
                <HeaderButton onClick={() => setActiveTab("signal")}>
                  My Signal
                </HeaderButton>
              </>
            ) : (
              <button
                className="rounded-md bg-[#7ee0bd] px-5 py-2.5 text-sm font-semibold text-[#07100d]"
                onClick={() => startAsRole("player")}
                type="button"
              >
                Join Signal
              </button>
            )}
          </nav>
        </header>

        <section className="relative flex-1 overflow-x-hidden">
          {activeTab === "arena" ? (
            <>
              <CampaignHome
                onEnterRole={startAsRole}
                selectedCity={selectedCity}
              />
              {step !== "intro" && step !== "done" ? (
                <OnboardingOverlay onClose={() => setStep("intro")}>
                  <ArenaOnboarding
                    isClaiming={isClaiming}
                    isFindingArena={isFindingArena}
                    locationMessage={locationMessage}
                    onClaim={handleClaim}
                    onConnectWallet={handleConnectWallet}
                    onFindArena={handleFindArena}
                    onSelectCity={handleManualCitySelect}
                    onSelectRole={(role) => {
                      setSelectedRole(role);
                      goToStep("location");
                    }}
                    onStart={() => goToStep("role")}
                    progress={progress}
                    selectedCityId={selectedCityId}
                    selectedRole={selectedRole}
                    step={step}
                    walletAddress={walletAddress}
                  />
                </OnboardingOverlay>
              ) : null}
            </>
          ) : null}

          {activeTab === "map" ? (
            <SignalMap
              arenaState={arenaState}
              selectedCity={selectedCity}
              selectedCityName={selectedCity.name}
            />
          ) : null}

          {activeTab === "feed" ? (
            <ProofFeed
              arenaState={arenaState}
              onReact={handleReactToProof}
              onSubmitProof={handleSubmitProof}
              proofLogs={proofLogs}
              selectedCityName={selectedCity.name}
              selectedRole={selectedRole}
            />
          ) : null}

          {activeTab === "signal" ? (
            <MySignal
              arenaState={arenaState}
              onReset={handleReset}
              selectedCityName={selectedCity.name}
              selectedRole={selectedRole}
              walletAddress={walletAddress}
              proofCount={proofLogs.length}
            />
          ) : null}
        </section>

        {arenaState?.firstSignalClaimed ? (
          <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
        ) : null}
      </div>
    </main>
  );
}

function CampaignHome({
  onEnterRole,
  selectedCity,
}: {
  onEnterRole: (role: ArenaRole) => void;
  selectedCity: (typeof cities)[number];
}) {
  return (
    <div>
      <section className="relative min-h-[calc(100vh-73px)] overflow-hidden">
        <MapLibreSignalGlobe
          cities={cities}
          selectedCity={selectedCity}
          variant="immersive"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,6,0.98)_0%,rgba(3,5,6,0.9)_34%,rgba(3,5,6,0.22)_58%,rgba(3,5,6,0.02)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(3,5,6,0.9)_0%,transparent_34%)]" />

        <div className="pointer-events-none relative z-10 flex min-h-[calc(100vh-73px)] flex-col px-5 py-7 sm:px-9 lg:px-14 lg:py-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#7ee0bd] shadow-[0_0_16px_rgba(126,224,189,0.8)]" />
              <span className="text-xs font-semibold uppercase tracking-[0.26em] text-[#a7f3d8]">
                Genesis network live
              </span>
            </div>
            <div className="rounded-md border border-white/10 bg-black/35 px-3 py-2 text-right backdrop-blur">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                City signal
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {selectedCity.name}
              </p>
            </div>
          </div>

          <div className="my-auto max-w-2xl py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#ffbd78]">
              Human signal protocol / 01
            </p>
            <h1 className="mt-6 text-5xl font-semibold leading-[0.94] text-white sm:text-7xl lg:text-8xl">
              Prove you
              <span className="block text-zinc-500">were here.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-300">
              AI can generate the image. It cannot stand in your city, open a
              wallet, and leave a live human signal.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                className="pointer-events-auto h-13 rounded-md bg-[#7ee0bd] px-7 text-sm font-bold text-[#07100d] transition hover:bg-[#9aebcf]"
                onClick={() => onEnterRole("player")}
                type="button"
              >
                Become a Player
              </button>
              <button
                className="pointer-events-auto h-13 rounded-md border border-white/20 bg-black/30 px-7 text-sm font-bold text-white backdrop-blur transition hover:border-white/40"
                onClick={() => onEnterRole("watcher")}
                type="button"
              >
                Enter as Watcher
              </button>
            </div>
          </div>

          <div className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
            <SignalStage label="Role" value="Choose your side" />
            <SignalStage label="Location" value="Verify city-level presence" />
            <SignalStage label="Wallet" value="Save your Signal ID" />
            <SignalStage label="Genesis" value="Claim 100 JXRO" />
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-t border-zinc-800 bg-[#0b0b0c] px-5 py-12 sm:px-9 lg:grid-cols-[1fr_1.4fr] lg:px-14">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            What grows here
          </p>
          <h2 className="mt-4 text-3xl font-semibold text-white">
            The map is the content.
          </h2>
        </div>
        <p className="max-w-2xl text-lg leading-8 text-zinc-400">
          Wallets create city pins. Players add live camera proofs. Watchers
          separate Real from Noise. The first {campaignStats.walletCap.toLocaleString()} wallets become the Genesis record.
        </p>
      </section>
    </div>
  );
}

function SignalStage({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/55 p-4 backdrop-blur">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#7ee0bd]">
        {label}
      </p>
      <p className="mt-2 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function OnboardingOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="relative max-h-[96vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#08090b] shadow-2xl sm:rounded-3xl">
        <button
          aria-label="Close onboarding"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-zinc-700 bg-black/70 text-lg text-zinc-300"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="hidden rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 sm:block"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ArenaOnboarding({
  isClaiming,
  isFindingArena,
  locationMessage,
  onClaim,
  onConnectWallet,
  onFindArena,
  onSelectCity,
  onSelectRole,
  onStart,
  progress,
  selectedCityId,
  selectedRole,
  step,
  walletAddress,
}: {
  isClaiming: boolean;
  isFindingArena: boolean;
  locationMessage: string;
  onClaim: () => void;
  onConnectWallet: () => void;
  onFindArena: () => void;
  onSelectCity: (cityId: string) => void;
  onSelectRole: (role: ArenaRole) => void;
  onStart: () => void;
  progress: number;
  selectedCityId: string;
  selectedRole: ArenaRole;
  step: OnboardingStep;
  walletAddress: string;
}) {
  return (
    <div className="flex min-h-[620px] flex-col px-5 py-6">
      <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-sky-300 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {step === "intro" ? (
        <StepFrame
          eyebrow="The first human signal arena"
          title={
            <>
              AI can fake content.
              <span className="block text-zinc-500">
                It cannot fake presence.
              </span>
            </>
          }
          body="Enter with a wallet. Let the arena find your city. Place your first pin on the Genesis map."
        >
          <button
            className="mt-10 h-13 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            onClick={onStart}
            type="button"
          >
            Start
          </button>
        </StepFrame>
      ) : null}

      {step === "role" ? (
        <StepFrame
          eyebrow="Choose role"
          title="Watcher or Player?"
          body="This choice sets how your wallet enters the arena."
        >
          <div className="mt-8 grid gap-3">
            {(Object.keys(roleOptions) as ArenaRole[]).map((role) => (
              <button
                className={`rounded-xl border p-5 text-left transition ${
                  selectedRole === role
                    ? "border-sky-300 bg-sky-300/10"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                }`}
                key={role}
                onClick={() => onSelectRole(role)}
                type="button"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-sky-300">
                  {roleOptions[role].action}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {roleOptions[role].title}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {roleOptions[role].description}
                </p>
              </button>
            ))}
          </div>
        </StepFrame>
      ) : null}

      {step === "location" ? (
        <StepFrame
          eyebrow="Find arena"
          title="Let your city find you."
          body="We only use city-level location. Exact coordinates stay hidden."
        >
          <button
            className="mt-10 h-13 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            disabled={isFindingArena}
            onClick={onFindArena}
            type="button"
          >
            {isFindingArena ? "Finding Arena..." : "Use My Location"}
          </button>
          <button
            className="mt-3 h-12 rounded-md border border-zinc-800 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600"
            onClick={() => onSelectCity(selectedCityId)}
            type="button"
          >
            Choose manually
          </button>
          {locationMessage ? (
            <p className="mt-5 text-sm leading-6 text-zinc-500">
              {locationMessage}
            </p>
          ) : null}
        </StepFrame>
      ) : null}

      {step === "manualCity" ? (
        <StepFrame
          eyebrow="Manual arena"
          title="Choose a city for now."
          body="If location is unavailable, you can still enter as a city-level signal."
        >
          {locationMessage ? (
            <p className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-6 text-zinc-400">
              {locationMessage}
            </p>
          ) : null}
          <div className="mt-6 grid gap-2">
            {cities.map((city) => (
              <button
                className={`flex items-center justify-between rounded-xl border px-4 py-4 text-left transition ${
                  selectedCityId === city.id
                    ? "border-sky-300 bg-sky-300/10"
                    : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                }`}
                key={city.id}
                onClick={() => onSelectCity(city.id)}
                type="button"
              >
                <span>
                  <span className="block text-lg font-semibold text-white">
                    {city.name}
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    {city.status}
                  </span>
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                  {city.region}
                </span>
              </button>
            ))}
          </div>
        </StepFrame>
      ) : null}

      {step === "wallet" ? (
        <StepFrame
          eyebrow="Wallet"
          title="Your wallet is your seat."
          body="Connect once. Your Genesis record is attached to this address."
        >
          <button
            className="mt-10 h-13 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            onClick={onConnectWallet}
            type="button"
          >
            {walletAddress ? "Wallet Connected" : "Connect Wallet"}
          </button>
        </StepFrame>
      ) : null}

      {step === "claim" ? (
        <StepFrame
          eyebrow="First Signal"
          title="Claim your Genesis seat."
          body={`First ${campaignStats.walletCap.toLocaleString()} wallets receive the entry signal.`}
        >
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-sky-300">
              Entry reward
            </p>
            <p className="mt-3 text-5xl font-semibold text-white">
              {campaignStats.rewardPerWallet}
              <span className="ml-2 text-lg font-medium text-sky-300">
                JXRO
              </span>
            </p>
          </div>
          <button
            className="mt-5 h-13 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            disabled={isClaiming}
            onClick={onClaim}
            type="button"
          >
            {isClaiming ? "Claiming..." : "Claim First Signal"}
          </button>
        </StepFrame>
      ) : null}

      {step === "done" ? (
        <StepFrame
          eyebrow="Signal recorded"
          title="Your pin is on the map."
          body="Open the Map tab to see the Genesis arena."
        />
      ) : null}
    </div>
  );
}

function StepFrame({
  body,
  children,
  eyebrow,
  title,
}: {
  body: string;
  children?: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center py-10">
      <p className="text-xs uppercase tracking-[0.32em] text-sky-300">
        {eyebrow}
      </p>
      <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-400">{body}</p>
      {children}
    </div>
  );
}

function SignalMap({
  arenaState,
  selectedCity,
  selectedCityName,
}: {
  arenaState: ArenaState | null;
  selectedCity: (typeof cities)[number];
  selectedCityName: string;
}) {
  return (
    <div className="min-h-[calc(100vh-121px)] px-5 py-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_360px]">
        <section>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            Global Signal Map
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Wallets become pins.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Zoom from Earth-level context into city-level signals. Exact
            location stays hidden; only the city signal is saved.
          </p>

          <MapLibreSignalGlobe cities={cities} selectedCity={selectedCity} />
        </section>

        <aside className="space-y-4 lg:pt-20">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7ee0bd]">
              Your city
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {selectedCityName}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              {arenaState
                ? `${selectedCityName} is attached to your Signal ID.`
                : "Complete onboarding to place your first pin."}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
              Live city ranking
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              This will rank every city by verified wallets, live proofs, and
              Watcher judgments once server data is connected.
            </p>
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-black/30 p-5">
              <p className="text-sm font-semibold text-white">
                Waiting for live city data.
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                The ranking should be generated from the backend, not from a
                preset city list.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProofFeed({
  arenaState,
  onReact,
  onSubmitProof,
  proofLogs,
  selectedCityName,
  selectedRole,
}: {
  arenaState: ArenaState | null;
  onReact: (logId: string, reaction: "real" | "noise") => void;
  onSubmitProof: (imageDataUrl: string, caption: string) => void;
  proofLogs: ProofLog[];
  selectedCityName: string;
  selectedRole: ArenaRole;
}) {
  return (
    <div className="min-h-[calc(100vh-121px)] overflow-y-auto px-5 py-6 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
            Signal Feed
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white">
            Live proof, judged by the crowd.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            A consumable feed of city-level human signals. Players can only
            post from the live camera; Watchers separate Real from Noise.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SignalMetric label="Live signals" value={String(proofLogs.length)} />
            <SignalMetric label="Your city" value={selectedCityName} />
            <SignalMetric
              label="Mode"
              value={selectedRole === "player" ? "Player" : "Watcher"}
            />
          </div>

          <div className="mt-6 grid gap-4">
            {proofLogs.length ? (
              proofLogs.map((log) => (
                <ProofLogCard key={log.id} log={log} onReact={onReact} />
              ))
            ) : (
              <EmptySignalFeed selectedCityName={selectedCityName} />
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <LiveProofCapture
            arenaState={arenaState}
            onSubmitProof={onSubmitProof}
            selectedCityName={selectedCityName}
            selectedRole={selectedRole}
          />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
              Feed rule
            </p>
            <h2 className="mt-3 text-xl font-semibold text-white">
              No camera, no signal.
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              This keeps the feed closer to Setlog and BeReal than a normal
              upload wall. The content is the proof that someone moved now.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SignalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function EmptySignalFeed({ selectedCityName }: { selectedCityName: string }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-dashed border-zinc-800 bg-zinc-950">
      <div className="grid min-h-[460px] place-items-center px-5 py-10 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#7ee0bd]/30 bg-[#7ee0bd]/10">
            <span className="h-2.5 w-2.5 rounded-full bg-[#7ee0bd] shadow-[0_0_18px_rgba(126,224,189,0.75)]" />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.26em] text-zinc-500">
            {selectedCityName} feed
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">
            No live signals yet.
          </h2>
          <p className="mt-4 text-sm leading-7 text-zinc-500">
            The feed starts empty by design. The first card should come from a
            live camera proof, then Watchers can judge whether it is Real or
            Noise.
          </p>
        </div>
      </div>
    </article>
  );
}

function LiveProofCapture({
  arenaState,
  onSubmitProof,
  selectedCityName,
  selectedRole,
}: {
  arenaState: ArenaState | null;
  onSubmitProof: (imageDataUrl: string, caption: string) => void;
  selectedCityName: string;
  selectedRole: ArenaRole;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [caption, setCaption] = useState("");
  const [capturedImage, setCapturedImage] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  async function handleOpenCamera() {
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera is unavailable in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      streamRef.current = stream;
      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError("Camera permission was not granted.");
    }
  }

  function handleCapture() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Could not capture this frame.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  }

  function handleSubmit() {
    const trimmedCaption = caption.trim();

    if (!capturedImage || !trimmedCaption) {
      return;
    }

    onSubmitProof(capturedImage, trimmedCaption);
    setCapturedImage("");
    setCaption("");
  }

  const canSubmit = capturedImage && caption.trim();
  const isPlayer = selectedRole === "player";

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">
            Live Camera Proof
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            Take a photo now.
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {selectedCityName} / city-level only / exact location hidden
          </p>
        </div>
        <span className="rounded-md border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-400">
          Player
        </span>
      </div>

      {!arenaState ? (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
          Claim your Genesis seat before submitting proof.
        </p>
      ) : null}

      {arenaState && !isPlayer ? (
        <p className="mt-4 rounded-xl border border-sky-300/20 bg-sky-300/10 p-3 text-sm leading-6 text-sky-100">
          Your current role is Watcher. Switch to Player in the Arena flow to
          submit live proof.
        </p>
      ) : null}

      {isCameraOpen ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-black">
          <video
            className="aspect-[4/5] w-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />
        </div>
      ) : null}

      {capturedImage ? (
        <img
          alt="Captured live proof"
          className="mt-4 aspect-[4/5] w-full rounded-xl border border-zinc-800 object-cover"
          src={capturedImage}
        />
      ) : null}

      <textarea
        className="mt-4 min-h-24 w-full resize-none rounded-xl border border-zinc-800 bg-black p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-300"
        maxLength={96}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Add one line from this moment..."
        value={caption}
      />

      {cameraError ? (
        <p className="mt-3 text-sm leading-6 text-amber-200">{cameraError}</p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {!capturedImage ? (
          <button
            className="h-12 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            disabled={!arenaState || !isPlayer}
            onClick={isCameraOpen ? handleCapture : handleOpenCamera}
            type="button"
          >
            {isCameraOpen ? "Capture Now" : "Open Camera"}
          </button>
        ) : (
          <button
            className="h-12 rounded-md border border-zinc-800 px-5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600"
            onClick={() => setCapturedImage("")}
            type="button"
          >
            Retake
          </button>
        )}

        <button
          className="h-12 rounded-md bg-sky-300 px-5 text-sm font-semibold text-black transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={!canSubmit}
          onClick={handleSubmit}
          type="button"
        >
          Submit Proof
        </button>
      </div>
    </section>
  );
}

function ProofLogCard({
  log,
  onReact,
}: {
  log: ProofLog;
  onReact: (logId: string, reaction: "real" | "noise") => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <img
        alt={log.caption}
        className="aspect-[4/5] w-full object-cover"
        src={log.imageDataUrl}
      />
      <div className="p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          {log.cityName} / Live Player Proof
        </p>
        <p className="mt-3 text-xl leading-8 text-zinc-100">
          &quot;{log.caption}&quot;
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          {new Date(log.createdAt).toLocaleString()}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              log.reaction === "real"
                ? "border-emerald-300 bg-emerald-300 text-black"
                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
            }`}
            onClick={() => onReact(log.id, "real")}
            type="button"
          >
            REAL {log.real}
          </button>
          <button
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              log.reaction === "noise"
                ? "border-amber-300 bg-amber-300 text-black"
                : "border-amber-400/20 bg-amber-400/10 text-amber-200"
            }`}
            onClick={() => onReact(log.id, "noise")}
            type="button"
          >
            NOISE {log.noise}
          </button>
        </div>
      </div>
    </article>
  );
}

function MySignal({
  arenaState,
  onReset,
  proofCount,
  selectedCityName,
  selectedRole,
  walletAddress,
}: {
  arenaState: ArenaState | null;
  onReset: () => void;
  proofCount: number;
  selectedCityName: string;
  selectedRole: ArenaRole;
  walletAddress: string;
}) {
  return (
    <div className="min-h-[calc(100vh-121px)] px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
          My Signal
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white">
          {arenaState ? "Your Genesis signal is active." : "No signal yet."}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Role, city, reward state, and live proof history stay attached to
          one Signal ID.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-[#7ee0bd]">
              Signal ID
            </p>
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/40 p-5">
              <p className="text-sm text-zinc-500">Wallet</p>
              <p className="mt-2 break-all text-2xl font-semibold text-white">
                {walletAddress ? shortenAddress(walletAddress) : "Not connected"}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SignalRow label="Role" value={roleOptions[selectedRole].title} />
              <SignalRow label="City" value={selectedCityName} />
              <SignalRow
                label="First Signal"
                value={arenaState ? "100 JXRO claimed" : "Not claimed"}
              />
              <SignalRow label="Live Proofs" value={String(proofCount)} />
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-[#7ee0bd]/20 bg-[#7ee0bd]/10 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-[#a7f3d8]">
                Genesis reward
              </p>
              <p className="mt-4 text-5xl font-semibold text-white">
                {arenaState ? "100" : "0"}
                <span className="ml-2 text-lg text-[#a7f3d8]">JXRO</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                {arenaState
                  ? "This allocation is ready to be linked to the token distribution layer."
                  : "Claim First Signal to prepare your entry allocation."}
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">
                Next loop
              </p>
              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                <p>1. Watch city signals.</p>
                <p>2. Judge Real or Noise.</p>
                <p>3. Capture live proof as Player.</p>
              </div>
            </div>
          </aside>
        </div>

        <button
          className="mt-5 h-12 w-full rounded-md border border-zinc-800 text-sm font-semibold text-zinc-300"
          onClick={onReset}
          type="button"
        >
          Clear this device
        </button>
      </div>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
      <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">
        {label}
      </span>
      <span className="mt-2 block text-base font-semibold text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function findNearestSupportedCity(lat: number, lng: number) {
  let nearest:
    | {
        city: (typeof cities)[number];
        distance: number;
      }
    | undefined;

  for (const city of cities) {
    const distance = getDistanceKm(
      lat,
      lng,
      city.coordinates.lat,
      city.coordinates.lng,
    );

    if (!nearest || distance < nearest.distance) {
      nearest = { city, distance };
    }
  }

  if (!nearest || nearest.distance > cityDetectionRadiusKm) {
    return null;
  }

  return nearest.city;
}

function getDistanceKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function BottomTabs({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const tabs: { id: AppTab; label: string }[] = [
    { id: "arena", label: "Arena" },
    { id: "map", label: "Map" },
    { id: "feed", label: "Feed" },
    { id: "signal", label: "Signal" },
  ];

  return (
    <nav className="grid grid-cols-4 border-t border-zinc-900 bg-[#08090b]">
      {tabs.map((tab) => (
        <button
          className={`h-16 text-xs font-semibold transition ${
            activeTab === tab.id ? "text-sky-300" : "text-zinc-600"
          }`}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
