/**
 * Regenera src/data/knockoutThirdPlaceMatrix.json desde Annex C (reglamento FIFA).
 * Uso: npx tsx scripts/buildKnockoutMatrix.ts
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const annexPath =
  process.env.FIFA_ANNEX_C_TEXT ??
  'C:/Users/Nicoy/.cursor/projects/c-Users-Nicoy-Downloads-prode/agent-tools/98c79026-acf3-4539-9c3b-fb6d7ef0cfba.txt';

const slots = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L'] as const;
const text = readFileSync(annexPath, 'utf8');
const re = /\b(\d{1,3})\s+(3[A-L](?:\s+3[A-L]){7})\b/g;
const map: Record<string, Record<string, string>> = {};

let m: RegExpExecArray | null;
while ((m = re.exec(text)) !== null) {
  const nums = m[2].trim().split(/\s+/);
  if (nums.length !== 8) continue;
  const groups = nums.map(x => x.slice(1)).sort().join('');
  const entry: Record<string, string> = {};
  slots.forEach((s, i) => {
    entry[s] = nums[i];
  });
  map[groups] = entry;
}

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/knockoutThirdPlaceMatrix.json', JSON.stringify(map, null, 2));
console.log(`Combinaciones generadas: ${Object.keys(map).length}`);
