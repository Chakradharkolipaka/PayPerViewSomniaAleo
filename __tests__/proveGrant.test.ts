import test from "node:test";
import assert from "node:assert/strict";
import { WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import { proveGrant, normalizeProofRecord, type GrantViewTransaction } from "@/lib/aleo/proveGrant";
import { ProofError, ProofLayerError, toProofLayerError } from "@/lib/aleo/proofErrors";

const grantViewTx: GrantViewTransaction = {
  address: "aleo1validaddressxyz",
  chainId: "testnetbeta",
  transitions: [
    {
      program: "video_access.aleo",
      functionName: "grant_view",
      inputs: ["aleo1validaddressxyz", "1field", "1u64"],
    },
  ],
  fee: 0.28,
  feePrivate: false,
};

test("normalizeProofRecord returns null on invalid schema", () => {
  const invalid = { id: "1", program_id: "p", microcredits: "1", spent: false };
  assert.equal(normalizeProofRecord(invalid), null);
});

test("proveGrant happy path", async () => {
  const adapter = {
    publicKey: "aleo1validaddressxyz",
    requestTransaction: async () => ({ transactionId: "tx-1" }),
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () =>
      JSON.stringify({
        id: "record-1",
        program_id: "video_access.aleo",
        microcredits: "0",
        spent: false,
        data: { key: "value" },
      }),
  };

  const result = await proveGrant({
    adapter,
    grantViewTx,
    fetchImpl: async () => new Response("ok", { status: 200 }),
    sleepImpl: async () => {},
    expectedNetwork: WalletAdapterNetwork.Testnet,
    deployedProgramNetwork: WalletAdapterNetwork.Testnet,
  });

  assert.equal(result.txId, "tx-1");
  assert.equal(result.status, "Finalized");
  assert.equal(result.normalizedRecord.program_id, "video_access.aleo");
});

test("failure mode A: wallet throws before proof begins", async () => {
  const adapter = {
    publicKey: "aleo1validaddressxyz",
    requestTransaction: async () => {
      throw new Error("adapter threw");
    },
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () => undefined,
  };

  await assert.rejects(
    proveGrant({ adapter, grantViewTx, sleepImpl: async () => {} }),
    (err: unknown) => {
      assert.ok(err instanceof ProofLayerError);
      assert.equal((err as ProofLayerError).code, ProofError.PROOF_CALL_FAILED);
      return true;
    }
  );
});

test("failure mode B: request resolves without usable txId", async () => {
  const adapter = {
    publicKey: "aleo1validaddressxyz",
    requestTransaction: async () => ({ ok: true }),
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () => undefined,
  };

  await assert.rejects(
    proveGrant({ adapter, grantViewTx, sleepImpl: async () => {} }),
    (err: unknown) => {
      assert.ok(err instanceof ProofLayerError);
      assert.equal((err as ProofLayerError).code, ProofError.PROOF_CALL_FAILED);
      return true;
    }
  );
});

test("failure mode C: record shape mismatch", async () => {
  const adapter = {
    publicKey: "aleo1validaddressxyz",
    requestTransaction: async () => "tx-1",
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () => ({ not: "proof-record" }),
  };

  await assert.rejects(
    proveGrant({ adapter, grantViewTx, sleepImpl: async () => {} }),
    (err: unknown) => {
      assert.ok(err instanceof ProofLayerError);
      assert.equal((err as ProofLayerError).code, ProofError.PROOF_RECORD_INVALID);
      return true;
    }
  );
});

test("failure mode D: verify endpoint rejects", async () => {
  const adapter = {
    publicKey: "aleo1validaddressxyz",
    requestTransaction: async () => "tx-1",
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () => ({
      id: "record-1",
      program_id: "video_access.aleo",
      microcredits: "0",
      spent: false,
      data: { any: "value" },
    }),
  };

  await assert.rejects(
    proveGrant({
      adapter,
      grantViewTx,
      fetchImpl: async () => new Response("denied", { status: 400 }),
      sleepImpl: async () => {},
    }),
    (err: unknown) => {
      assert.ok(err instanceof ProofLayerError);
      assert.equal((err as ProofLayerError).code, ProofError.VERIFY_REJECTED);
      return true;
    }
  );
});

test("WALLET_NOT_READY only fires on null/invalid publicKey", async () => {
  const adapter = {
    publicKey: null,
    requestTransaction: async () => "tx-1",
    transactionStatus: async () => "Finalized",
    transitionViewKeys: async () => undefined,
  };

  await assert.rejects(
    proveGrant({ adapter, grantViewTx, sleepImpl: async () => {} }),
    (err: unknown) => {
      assert.ok(err instanceof ProofLayerError);
      assert.equal((err as ProofLayerError).code, ProofError.WALLET_NOT_READY);
      return true;
    }
  );
});

test("proof phase errors never relabel as wallet/payment errors", () => {
  const relabeledWallet = toProofLayerError(new Error("wallet not detected"), 5);
  assert.equal(relabeledWallet.code, ProofError.UNKNOWN_PROOF_ERROR);

  const relabeledPayment = toProofLayerError(new Error("invalid payment"), 5);
  assert.equal(relabeledPayment.code, ProofError.UNKNOWN_PROOF_ERROR);
});
