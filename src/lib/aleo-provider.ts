type AleoProvider = {
  requestAccount?: () => Promise<unknown>;
  connect?: () => Promise<unknown>;
  getAccount?: () => Promise<unknown>;
  getAccounts?: () => Promise<unknown>;
  request?: (payload: unknown) => Promise<unknown>;
  account?: unknown;
  address?: unknown;
  publicKey?: unknown;
  selectedAccount?: unknown;
  currentAccount?: unknown;
  requestCiphertext?: (payload: {
    program: string;
    transition: string;
    inputs: string[];
  }) => Promise<unknown>;
};

type WalletCandidate = {
  id: string;
  provider: AleoProvider;
};

export type DetectedAleoWallet = {
  id: string;
  label: string;
  supportsConnect: boolean;
  supportsCiphertext: boolean;
};

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return [];
}

function extractAddress(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;

  if (value && typeof value === "object") {
    const maybeAddress =
      (value as { address?: unknown }).address ||
      (value as { account?: unknown }).account ||
      (value as { publicKey?: unknown }).publicKey;
    if (typeof maybeAddress === "string" && maybeAddress.trim()) return maybeAddress;
  }

  const first = asArray(value)[0];
  if (typeof first === "string" && first.trim()) return first;

  return null;
}

function formatLabel(source: string): string {
  if (source === "aleo_appName") return "Aleo App Wallet";
  if (source === "leoWallet") return "Leo Wallet";
  if (source === "aleoWallet") return "Aleo Wallet";
  if (source === "aleo_wallet") return "Aleo Wallet (legacy)";
  if (source === "aleo") return "Aleo Provider";
  if (source === "leo") return "Leo Provider";
  return source;
}

function canConnect(provider: AleoProvider): boolean {
  return (
    typeof provider.requestAccount === "function" ||
    typeof provider.connect === "function" ||
    typeof provider.getAccount === "function" ||
    typeof provider.getAccounts === "function" ||
    typeof provider.request === "function"
  );
}

function hasCiphertextSupport(provider: AleoProvider): boolean {
  return typeof provider.requestCiphertext === "function" || typeof provider.request === "function";
}

function collectCandidates(): WalletCandidate[] {
  if (typeof window === "undefined") return [];

  const w = window as unknown as Record<string, unknown>;
  const sources: Array<[string, unknown]> = [
    ["aleo_appName", w.aleo_appName],
    ["leoWallet", w.leoWallet],
    ["leo", w.leo],
    ["aleo", w.aleo],
    ["aleoWallet", w.aleoWallet],
    ["aleo_wallet", w.aleo_wallet],
  ];

  for (const [key, value] of Object.entries(w)) {
    if (!/(leo|aleo)/i.test(key)) continue;
    if (sources.find(([known]) => known === key)) continue;
    sources.push([key, value]);
  }

  const seen = new Set<string>();
  const candidates: WalletCandidate[] = [];

  for (const [id, candidate] of sources) {
    if (!candidate || typeof candidate !== "object") continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const provider = candidate as AleoProvider;
    if (!canConnect(provider) && !hasCiphertextSupport(provider)) continue;

    candidates.push({ id, provider });
  }

  return candidates;
}

export function listDetectedAleoWallets(): DetectedAleoWallet[] {
  const candidates = collectCandidates();
  return candidates.map(({ id, provider }) => ({
    id,
    label: formatLabel(id),
    supportsConnect: canConnect(provider),
    supportsCiphertext: hasCiphertextSupport(provider),
  }));
}

export function resolveAleoProvider(preferredId?: string): AleoProvider | null {
  const candidates = collectCandidates();

  if (preferredId) {
    const preferred = candidates.find((candidate) => candidate.id === preferredId);
    if (preferred) {
      return preferred.provider;
    }
  }

  const first = candidates.find((candidate) => canConnect(candidate.provider));
  return first?.provider ?? null;
}

async function requestWithMethod(provider: AleoProvider, method: string, params: unknown[] = []) {
  if (typeof provider.request !== "function") {
    return null;
  }

  try {
    return await provider.request({ method, params });
  } catch {
    try {
      return await provider.request({ method });
    } catch {
      try {
        return await provider.request(method);
      } catch {
        return null;
      }
    }
  }
}

async function readConnectedAddress(provider: AleoProvider): Promise<string | null> {
  const direct = [
    provider.account,
    provider.address,
    provider.publicKey,
    provider.selectedAccount,
    provider.currentAccount,
  ];

  for (const value of direct) {
    const extracted = extractAddress(value);
    if (extracted) return extracted;
  }

  const methodAttempts: Array<() => Promise<unknown>> = [];
  if (typeof provider.getAccount === "function") methodAttempts.push(() => provider.getAccount!());
  if (typeof provider.getAccounts === "function") methodAttempts.push(() => provider.getAccounts!());
  methodAttempts.push(() => requestWithMethod(provider, "getAccount"));
  methodAttempts.push(() => requestWithMethod(provider, "getAccounts"));
  methodAttempts.push(() => requestWithMethod(provider, "aleo_getAccount"));
  methodAttempts.push(() => requestWithMethod(provider, "aleo_getAccounts"));

  for (const attempt of methodAttempts) {
    try {
      const value = await attempt();
      const extracted = extractAddress(value);
      if (extracted) return extracted;
    } catch {
      // continue probing
    }
  }

  return null;
}

async function connectProvider(provider: AleoProvider): Promise<unknown> {
  const attempts: Array<() => Promise<unknown>> = [];

  if (typeof provider.requestAccount === "function") attempts.push(() => provider.requestAccount!());
  if (typeof provider.connect === "function") attempts.push(() => provider.connect!());
  if (typeof provider.getAccount === "function") attempts.push(() => provider.getAccount!());
  if (typeof provider.getAccounts === "function") attempts.push(() => provider.getAccounts!());
  attempts.push(() => requestWithMethod(provider, "requestAccount"));
  attempts.push(() => requestWithMethod(provider, "connect"));
  attempts.push(() => requestWithMethod(provider, "aleo_requestAccount"));
  attempts.push(() => requestWithMethod(provider, "aleo_connect"));

  for (const attempt of attempts) {
    try {
      const response = await attempt();
      if (extractAddress(response)) {
        return response;
      }

      const connectedAddress = await readConnectedAddress(provider);
      if (connectedAddress) {
        return connectedAddress;
      }
    } catch {
      // try next strategy
    }
  }

  throw new Error("Leo wallet did not respond to account connection methods.");
}

export async function requestAleoAccount(preferredId?: string): Promise<string> {
  const provider = resolveAleoProvider(preferredId);
  if (!provider) {
    throw new Error("Leo wallet not detected. Install/enable Leo Wallet, unlock it, and refresh this tab.");
  }

  const response = await connectProvider(provider);
  const address = extractAddress(response) || (await readConnectedAddress(provider));
  if (!address) {
    throw new Error("Leo wallet responded without an address. Reconnect the wallet and try again.");
  }

  return address;
}

export async function requestAleoCiphertext(payload: {
  program: string;
  transition: string;
  inputs: string[];
}): Promise<string> {
  const provider = resolveAleoProvider();
  if (!provider) {
    throw new Error(
      "Leo wallet API is missing requestCiphertext. Ensure the extension is the latest version and reconnect it."
    );
  }

  let record: unknown;

  if (typeof provider.requestCiphertext === "function") {
    record = await provider.requestCiphertext(payload);
  } else {
    record =
      (await requestWithMethod(provider, "requestCiphertext", [payload])) ??
      (await requestWithMethod(provider, "aleo_requestCiphertext", [payload])) ??
      (await requestWithMethod(provider, "request_ciphertext", [payload]));
  }

  if (typeof record !== "string" || !record.trim()) {
    throw new Error("Leo wallet returned an invalid Aleo proof record.");
  }

  return record;
}