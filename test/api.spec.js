/**
 * test/api.spec.js
 *
 * API endpoint correctness checks.
 * These tests run against a live Next.js dev server.
 *
 * Usage:
 *   1. Start the dev server: npm run dev
 *   2. Run this file:       node test/api.spec.js
 *
 * Requirements:
 *   - Node.js 18+ (built-in fetch, FormData, and Headers are required)
 *   - BASE_URL env var defaults to http://localhost:3000.
 *     Set it to your staging URL for remote checks.
 *
 * Each test calls a specific API route and asserts the HTTP status code
 * and key fields in the JSON response.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ ${message}`);
    passed++;
  } else {
    console.error(`  ✖ ${message}`);
    failed++;
  }
}

async function fetchJSON(path, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, opts);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ─── GET /api/health ─────────────────────────────────────────────────────────
async function testHealth() {
  console.log("\nGET /api/health");
  const { status, body } = await fetchJSON("/api/health");
  assert(status === 200, `status 200 (got ${status})`);
  assert(body?.status === "ok", `body.status === "ok" (got ${body?.status})`);
  assert(typeof body?.checks === "object", "body.checks is an object");
}

// ─── GET /api/videos ─────────────────────────────────────────────────────────
async function testGetVideos() {
  console.log("\nGET /api/videos");
  const { status, body } = await fetchJSON("/api/videos");
  assert(status === 200, `status 200 (got ${status})`);
  assert(Array.isArray(body?.videos), "body.videos is an array");
}

// ─── POST /api/mint – missing fields ─────────────────────────────────────────
async function testMintMissingFields() {
  console.log("\nPOST /api/mint (missing fields)");
  const form = new FormData();
  // Intentionally omit title, description, creator, file
  const { status, body } = await fetchJSON("/api/mint", {
    method: "POST",
    body: form,
  });
  assert(status === 400, `status 400 (got ${status})`);
  assert(typeof body?.error === "string", "body.error is a string");
}

// ─── POST /api/proof-verify – valid record ────────────────────────────────────
async function testProofVerifyValid() {
  console.log("\nPOST /api/proof-verify (valid record)");
  const { status, body } = await fetchJSON("/api/proof-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record: "record1abc.private" }),
  });
  assert(status === 200, `status 200 (got ${status})`);
  assert(body?.valid === true, `body.valid === true (got ${body?.valid})`);
  assert(typeof body?.message === "string", "body.message is a string");
}

// ─── POST /api/proof-verify – missing record ──────────────────────────────────
async function testProofVerifyMissingRecord() {
  console.log("\nPOST /api/proof-verify (missing record)");
  const { status, body } = await fetchJSON("/api/proof-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert(status === 400, `status 400 (got ${status})`);
  assert(typeof body?.message === "string", "body.message is a string");
}

// ─── POST /api/proof-verify – invalid body ────────────────────────────────────
async function testProofVerifyInvalidBody() {
  console.log("\nPOST /api/proof-verify (invalid body)");
  const { status, body } = await fetchJSON("/api/proof-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{{{",
  });
  assert(status === 400, `status 400 (got ${status})`);
}

// ─── POST /api/watch-gate/:videoId – missing body ────────────────────────────
async function testWatchGateMissingBody() {
  console.log("\nPOST /api/watch-gate/1 (missing body)");
  const { status, body } = await fetchJSON("/api/watch-gate/1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "bad{{{",
  });
  assert(status === 400, `status 400 (got ${status})`);
  assert(typeof body?.message === "string", "body.message is a string");
}

// ─── POST /api/watch-gate/:videoId – missing tokenId ─────────────────────────
async function testWatchGateMissingToken() {
  console.log("\nPOST /api/watch-gate/1 (missing tokenId)");
  const { status, body } = await fetchJSON("/api/watch-gate/1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewerAddress: "0x1234567890abcdef1234567890abcdef12345678" }),
  });
  assert(status === 400, `status 400 (got ${status})`);
  assert(typeof body?.message === "string", "body.message is a string");
}

// ─── POST /api/verify-and-serve – legacy route still works ───────────────────
async function testVerifyAndServeLegacy() {
  console.log("\nPOST /api/verify-and-serve (missing body – legacy route)");
  const { status, body } = await fetchJSON("/api/verify-and-serve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "bad{{{",
  });
  assert(status === 400, `status 400 (got ${status})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`API spec running against: ${BASE_URL}\n`);

  const tests = [
    testHealth,
    testGetVideos,
    testMintMissingFields,
    testProofVerifyValid,
    testProofVerifyMissingRecord,
    testProofVerifyInvalidBody,
    testWatchGateMissingBody,
    testWatchGateMissingToken,
    testVerifyAndServeLegacy,
  ];

  for (const test of tests) {
    try {
      await test();
    } catch (err) {
      console.error(`  ✖ UNCAUGHT: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
