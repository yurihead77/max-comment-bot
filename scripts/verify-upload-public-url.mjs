/**
 * Mirrors `apps/api/src/lib/upload-public-url.ts` (trim trailing slashes on base, single `/` before filename).
 * Run from repo root: `node scripts/verify-upload-public-url.mjs`
 */
function buildUploadPublicFileUrl(publicBase, filename) {
  const base = publicBase.replace(/\/+$/, "");
  return `${base}/${filename}`;
}

function pathHasAdjacentSlashes(url) {
  const u = new URL(url);
  return /\/{2,}/.test(u.pathname);
}

const filename = "abc-uuid.png";
const cases = [
  ["https://example.com/uploads", "https://example.com/uploads/abc-uuid.png"],
  ["https://example.com/uploads/", "https://example.com/uploads/abc-uuid.png"],
  ["https://example.com/api/v1/uploads/", "https://example.com/api/v1/uploads/abc-uuid.png"],
  ["http://localhost:3001/uploads///", "http://localhost:3001/uploads/abc-uuid.png"]
];

for (const [input, expected] of cases) {
  const got = buildUploadPublicFileUrl(input, filename);
  if (got !== expected) {
    throw new Error(`expected ${expected}, got ${got} for base=${JSON.stringify(input)}`);
  }
  if (pathHasAdjacentSlashes(got)) {
    throw new Error(`path must not contain // segments: ${got}`);
  }
}

console.log("UPLOAD_PUBLIC_URL_OK");
