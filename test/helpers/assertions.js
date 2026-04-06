import { expect } from "chai";

export async function expectRevert(promiseOrFn, expectedMessagePart) {
  try {
    if (typeof promiseOrFn === "function") {
      await promiseOrFn();
    } else {
      await promiseOrFn;
    }
    expect.fail(`Expected transaction to revert with: ${expectedMessagePart}`);
  } catch (err) {
    const message = String(err?.message || err);
    expect(message).to.contain(expectedMessagePart);
  }
}

export async function expectConfirmed(txPromise) {
  const tx = await txPromise;
  return tx.wait();
}
