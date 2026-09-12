import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';

// Run the unmodified V0 suite while refusing its final evidence rewrite.
const originalWrite = fs.writeFileSync;
const protectedRoot = resolve('research/experiments/appraisal-exact-input-reuse-shadow-v0');
fs.writeFileSync = function (path, data, ...rest) {
  if (resolve(String(path)).startsWith(protectedRoot)) {
    assert.equal(resolve(String(path)), resolve(protectedRoot, 'deterministic-evidence.json'));
    assert.equal(fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n'), String(data).replaceAll('\r\n', '\n'), 'V0 regression changed prior deterministic evidence');
    return;
  }
  return originalWrite.call(this, path, data, ...rest);
};
syncBuiltinESMExports();
