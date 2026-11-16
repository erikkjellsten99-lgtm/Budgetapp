// Gör om Apple Hälsas export till en liten fil som Groundwork kan läsa in (Vanor → Mina vanor →
// Importera från Apple Hälsa). Körs på datorn, inget skickas någonstans:
//
//   node scripts/halsa-export.ts <export.zip eller export.xml> [mapp att spara i]
//
// Skriver groundwork-halsa.json (en post per dag) och groundwork-halsa-rapport.md (antal dagar och summa
// eller snitt per mått, för att jämföra med Groundwork efter importen).

import { spawn, execFileSync } from 'node:child_process';
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { AppleExportReader, HEALTH_FILE_FORMAT } from '../src/vanor/appleExport.ts';
import { summarizeHealth } from '../src/vanor/healthImport.ts';
import { METRICS } from '../supabase/functions/inbox/health.ts';

const [input, outDir] = process.argv.slice(2);
if (!input) {
  console.error('Ange exporten: node scripts/halsa-export.ts <export.zip eller export.xml> [mapp att spara i]');
  process.exit(1);
}

/** Strömmen med export.xml: direkt ur filen, eller ur zip-filen utan att packa upp den. */
function openXml(path) {
  if (!/\.zip$/i.test(path)) return createReadStream(path);
  const names = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n');
  // Filen heter export.xml (på svenska ibland exportera.xml). export_cda.xml är en annan fil.
  const xml = names.find((n) => /(^|\/)export[a-z]*\.xml$/i.test(n) && !/cda/i.test(n));
  if (!xml) throw new Error('Hittar ingen export.xml i zip-filen.');
  const child = spawn('unzip', ['-p', path, xml], { stdio: ['ignore', 'pipe', 'inherit'] });
  return child.stdout;
}

const reader = new AppleExportReader();
for await (const line of createInterface({ input: openXml(resolve(input)), crlfDelay: Infinity })) reader.line(line);

const days = reader.days();
if (!days.length) {
  console.error('Exporten innehåller inga mätningar som Groundwork har mått för.');
  process.exit(1);
}

const dir = resolve(outDir ?? dirname(resolve(input)));
mkdirSync(dir, { recursive: true });
const file = { format: HEALTH_FILE_FORMAT, version: 1, exported: reader.exported, days };
writeFileSync(join(dir, 'groundwork-halsa.json'), JSON.stringify(file));

const number = (n, decimals) => n.toLocaleString('sv-SE', { maximumFractionDigits: decimals });
const count = (map) => [...map].sort((a, b) => b[1] - a[1]);
const report = [
  '# Apple Hälsa → Groundwork',
  '',
  `Exporten gjordes ${reader.exported ?? 'okänt datum'}. Filen har ${number(days.length, 0)} dagar, ${days[0].date} – ${days[days.length - 1].date}.`,
  '',
  '## Per mått',
  '',
  '| Mått | Dagar | Summa eller snitt | Första dag | Sista dag |',
  '|---|---:|---:|---|---|',
  ...summarizeHealth(days).map((s) => {
    const info = METRICS[s.metric];
    const value = `${number(s.total, 2)} ${info.unit}${s.kind === 'sum' ? ' totalt' : ' i snitt'}`;
    return `| ${info.label} | ${number(s.days, 0)} | ${value} | ${s.first} | ${s.last} |`;
  }),
  '',
  '## Mätningar som lästes in',
  '',
  ...count(reader.read).map(([type, n]) => `- ${type}: ${number(n, 0)}`),
  '',
  '## Typer i Hälsa utan mått i Groundwork (inte med i filen)',
  '',
  ...count(reader.skipped).map(([type, n]) => `- ${type}: ${number(n, 0)}`),
  '',
];
writeFileSync(join(dir, 'groundwork-halsa-rapport.md'), report.join('\n'));
console.log(`Klart: ${days.length} dagar, ${days[0].date} – ${days[days.length - 1].date}.`);
console.log(join(dir, 'groundwork-halsa.json'));
console.log(join(dir, 'groundwork-halsa-rapport.md'));
