type AleoProvider = {
  requestAccount?: () => Promise<unknown>;
  requestCiphertext?: (payload: {
    program: string;
    transition: string;
    inputs: string[];
  }) => Promise<unknown>;
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

export function resolveAleoProvider(): AleoProvider | null {
  if (typeof window === "undefined") return null;

  const w = window as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    w.aleo_appName,
    w.leoWallet,
    w.leo,
    w.aleo,
    w.aleoWallet,
    w.aleo_wallet,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    const provider = candidate as AleoProvider;
    if (typeof provider.requestAccount === "function") {
      return provider;
    }
  }

  return null;
}

export async function requestAleoAccount(): Promise<string> {
  const provider = resolveAleoProvider();
  if (!provider || typeof provider.requestAccount !== "function") {
    throw new Error("Leo wallet not detected. Install/enable Leo Wallet, unlock it, and refresh this tab.");
  }

  const response = await provider.requestAccount();
  const address = extractAddress(response);
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
  if (!provider || typeof provider.requestCiphertext !== "function") {
    throw new Error(
      "Leo wallet API is missing requestCiphertext. Ensure the extension is the latest version and reconnect it."
    );
  }

  const record = await provider.requestCiphertext(payload);
  if (typeof record !== "string" || !record.trim()) {
    throw new Error("Leo wallet returned an invalid Aleo proof record.");
  }

  return record;
}