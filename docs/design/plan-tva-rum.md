# Två rum – genomförandeplan

> **För agenter:** Använd superpowers:executing-plans eller superpowers:subagent-driven-development. Stegen följs
> med kryssrutor (`- [ ]`).

**Mål:** Groundwork får designen "Två rum": ett lugnt vardagsrum (Idag, Ekonomi, Vanor, Nyheter) och ett mörkt
specialrum (Jarvis och galaxen) som öppnas med en orb.

**Arkitektur:** Nya färg- och typsnittstokens i `styles.css`, med de gamla variabelnamnen kvar som alias så att
befintliga regler fortsätter fungera medan vyerna byggs om en i taget. HUD-stilen flyttas från `hud.css` till
`room.css` och gäller bara inuti `.room`. Jarvis lämnar flikmenyn och visas i en `Room`-komponent ovanpå appen.

**Teknik:** Vite, React 19, TypeScript, vitest (utan DOM-miljö), Playwright för skärmbilder.

**Spec:** `Design/designspec-tva-rum.md`. Läs den före varje uppgift; värden i planen är kopierade därifrån.

## Globala villkor

- Kräver Node 20.19+ eller 22.12+ och Playwright. Erik Macs `Documents/groundwork` saknar Node; kör där Node finns.
- Gren `claude/tva-rum` från `origin/main` (3109d86 eller senare). Aldrig push till `main`. En commit per uppgift.
- Commit-meddelanden på svenska och avslutas med `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Inga nya beroenden och inga nya typsnitt.
- Ekonomins data och uträkningar rörs inte. Belopp skrivs med `formatKr` (`money.ts`). Svenska datum.
- IndexedDB-versioner (`db.ts`, `vanor/store.ts`) rörs inte.
- Varje uppgift slutar med `npm test` och `npm run build` gröna.
- Skärmbilder med Playwright: 375 × 812 i ljust och mörkt läge, samt 1200 × 800. Blockera `supabase.co`. Tom lokal
  databas. Testdata bara lokalt.
- Färger, exakt enligt specen:

  | Token | Ljust | Mörkt |
  |---|---|---|
  | `--bg` | #F2F4F5 | #111518 |
  | `--surface` | #FFFFFF | #1A2025 |
  | `--line` | #DCE2E6 | #2A333A |
  | `--ink` | #1A1F24 | #E8ECEF |
  | `--muted` | #56616B | #9BA7B1 |
  | `--pine` | #23614F | #6FC4A2 |
  | `--cobalt` | #2E4FD8 | #9AAEFF |
  | `--lingon` | #C2362F | #FF8F86 |

- Typsnitt: `--font-text: system-ui, -apple-system, sans-serif`, `--font-amount: ui-rounded, system-ui,
  -apple-system, sans-serif` med `font-variant-numeric: tabular-nums` och vikt 600.
- Typskala 13, 15, 17 (bas), 20, 28, 44 px. Hörn: grupp 14 px, kontroll 10 px, chips 999 px.
- Inga skuggor, ingen rutnätsbakgrund, inga versaler eller mono i vardagsrummet.

## Granskningsfokus

1. **Sparad flik från gammal version.** `localStorage` innehåller `jarvis` → appen öppnar Idag, aldrig en tom vy.
   Test i uppgift 2.
2. **Stora och negativa belopp i huvudsiffran.** "−123 456 kr" vid 375 px får inte flöda över eller brytas mitt i
   siffran. Skärmbild med lokal testdata i uppgift 3 och 4.
3. **Rummet stängs på alla sätt.** Tillbaka-knappen och Escape stänger, Jarvis slutar lyssna och prata, fokus
   återgår till orben och sidan går att rulla igen. Kontroll i uppgift 2.
4. **Temat väljs i appen.** Konto → Utseende sätter `data-theme`; vardagsrummet följer, rummet förblir mörkt. Test i
   uppgift 1, skärmbild i uppgift 2.
5. **Nyhet utan tid.** `published = 0` ger metaraden "SVT Sport" utan avslutande komma. Test i uppgift 6.

---

### Task 1 (uppgift 1): Tokens, typografi och avgränsat rum

**Filer:**
- Ändra: `src/styles.css` (`:root` och de två mörka blocken, rad 1–75)
- Flytta: `src/hud.css` → `src/room.css`
- Ändra: `src/main.tsx`, `src/Jarvis.tsx`, `src/vanor/CosmosView.tsx`, `src/vanor/Galaxy.tsx`, `src/vanor/Vanor.tsx:14`
- Skapa: `src/design.test.ts`
- Kopiera in: `docs/design/designspec-tva-rum.md` och `docs/design/plan-tva-rum.md` från Design-mappen

**Gränssnitt:**
- Ger: CSS-variablerna i tabellen ovan plus `--font-text`, `--font-amount`, `--radius-group: 14px`,
  `--radius-control: 10px`. De gamla namnen blir alias: `--card: var(--surface)`, `--card-raised: var(--surface)`,
  `--text: var(--ink)`, `--border: var(--line)`, `--accent: var(--cobalt)`, `--danger: var(--lingon)`,
  `--accent-soft` och `--danger-soft` som `color-mix(in srgb, <färg> 12%, var(--surface))`.
- Ger: klassen `room`. Allt i `room.css` gäller bara inuti `.room`, och `.room` sätter alltid HUD-färgerna och
  `color-scheme: dark`.

- [ ] **Steg 1: Skapa grenen och kopiera in spec och plan**

```bash
git fetch origin && git checkout -b claude/tva-rum origin/main
mkdir -p docs/design && cp <Design-mappen>/designspec-tva-rum.md <Design-mappen>/plan-tva-rum.md docs/design/
```

- [ ] **Steg 2: Skriv det fallerande testet `src/design.test.ts`**

Testet läser `src/styles.css` och `src/room.css` med `fs`. Hjälpfunktion i testfilen:
`tokensIn(css: string, selector: string): Record<string, string>` som plockar `--namn: värde` ur blocket som börjar
med selektorn. Kontrastfunktionen enligt WCAG 2 (relativ luminans).

```ts
const LIGHT = { '--bg': '#F2F4F5', '--surface': '#FFFFFF', '--line': '#DCE2E6', '--ink': '#1A1F24',
  '--muted': '#56616B', '--pine': '#23614F', '--cobalt': '#2E4FD8', '--lingon': '#C2362F' };
const DARK = { '--bg': '#111518', '--surface': '#1A2025', '--line': '#2A333A', '--ink': '#E8ECEF',
  '--muted': '#9BA7B1', '--pine': '#6FC4A2', '--cobalt': '#9AAEFF', '--lingon': '#FF8F86' };

it('ljusa tokens är specens', () => expect(pick(tokensIn(css, ':root {'), LIGHT)).toEqual(LIGHT));
it('mörka tokens är lika i systemläge och valt läge', () => {
  expect(pick(tokensIn(css, ":root:not([data-theme='light']) {"), DARK)).toEqual(DARK);
  expect(pick(tokensIn(css, ":root[data-theme='dark'] {"), DARK)).toEqual(DARK);
});
it.each([['ljust', LIGHT], ['mörkt', DARK]])('all text klarar 4,5:1 i %s läge', (_, t) => {
  for (const fg of ['--ink', '--muted', '--pine', '--cobalt', '--lingon'])
    for (const bg of ['--bg', '--surface']) expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
});
it('room.css rör inget utanför rummet', () => {
  expect(room).not.toMatch(/(^|[},]\s*)(body|html|:root)\b/m);
  expect(room).not.toMatch(/(^|}\s*)\.(?!room)[\w-]+[^{]*\{/m); // varje regel börjar med .room
});
```

- [ ] **Steg 3: Kör testet och se det falla**

Kör: `npx vitest run src/design.test.ts`. Väntat: FAIL, `room.css` finns inte och tokens saknas.

- [ ] **Steg 4: Inför tokens och alias i `styles.css`**

Byt värdena i de tre `:root`-blocken mot tabellen, lägg till alias, typsnitts- och hörnvariabler. Ta bort
`--shadow` (sätt till `none`) och `--hero-*`-variablerna ersätts av `--surface`/`--ink`. `button.primary` har vit
text i ljust läge och text i `var(--bg)` i båda mörka blocken. Basregeln för `h3` tappar `text-transform` och
`letter-spacing`, så att rubrikerna står i vanlig skrift.

- [ ] **Steg 5: Flytta HUD-stilen till `room.css`**

`git mv src/hud.css src/room.css`. Ta bort allt som gäller vardagsrummet: `:root`-blocken, `body`-rutnätet,
`.app-header`, rubriker, belopp, `.balance-hero`, `.app-nav`, `button.primary`, `.vanor`-blocken, `.forecast-chart`,
Idag, Nyheter och `.sub-nav`. Kvar blir Jarvis- och galax-reglerna, var och en med prefixet `.room`. Lägg först in
ett `.room`-block med HUD-färgerna från dagens mörka läge och `color-scheme: dark`. Byt importen i `main.tsx`.

- [ ] **Steg 6: Sätt `room` på rummets rötter**

Lägg till klassen `room` på `.jarvis-screen` i `Jarvis.tsx`, på `.galaxy-view` i `CosmosView.tsx` och på
laddningsvyn `.galaxy-view loading` i `Galaxy.tsx`.

- [ ] **Steg 7: Ladda HUD-typsnitten bara i rummet**

Flytta de fyra `@fontsource`-importerna från `main.tsx` till toppen av `Jarvis.tsx` och `CosmosView.tsx`. Ta bort
`@fontsource/jetbrains-mono/500.css` från `Vanor.tsx`. Sätt `font-family: var(--font-text)` på `:root` och
`--hud-display`/`--hud-mono` i `.room`-blocket.

- [ ] **Steg 8: Kör tester och bygge**

Kör: `npm test && npm run build`. Väntat: alla gröna, bygget går igenom.

- [ ] **Steg 9: Skärmbilder**

Alla flikar i 375 ljust och mörkt, samt 1200. Väntat: ingen rutnätsbakgrund, frostvit eller nattblå bakgrund, kobolt
som accent. Jarvis och galaxen ser ut som före, även i ljust läge.

- [ ] **Steg 10: Commit**

```bash
git add -A && git commit -m "Två rum 1/7: nya färger och typsnitt, HUD-stilen bara i rummet"
```

---

### Task 2 (uppgift 2): Navigering och rummet

**Filer:**
- Skapa: `src/nav.ts`, `src/nav.test.ts`, `src/Room.tsx`, `src/JarvisOrb.tsx`
- Ändra: `src/App.tsx` (rad 34–60, 80–122, 177–209, 299–300), `src/Jarvis.tsx`, `src/Today.tsx:10,69`,
  `src/styles.css` (bottenmeny, sidhuvud)

**Gränssnitt:**
- Konsumerar: klassen `room` från uppgift 1.
- Ger `src/nav.ts`:
  - `type Section = 'idag' | 'ekonomi' | 'vanor' | 'nyheter'`
  - `type EconomyView = 'overview' | 'budget' | 'goal' | 'assets' | 'wishlist'`
  - `type View = 'idag' | 'nyheter' | 'vanor' | 'account' | EconomyView`
  - `SECTIONS: { id: Section; label: string; icon: string }[]` (flyttas från App.tsx, utan Jarvis)
  - `ECONOMY: { id: EconomyView; label: string }[]` (oförändrad här)
  - `isEconomy(view: string): view is EconomyView`
  - `restoreView(saved: string | null): View`
- Ger `src/Room.tsx`: `export default function Room({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode })`
- Ger `src/JarvisOrb.tsx`: `export default function JarvisOrb({ onOpen }: { onOpen: () => void })`. Egen fil,
  så att `Jarvis.tsx` (med HUD-typsnitten) kan laddas lazy och inte följer med vid start.
- Ger App: `openRoom(): void` och `roomOpen: boolean`. `Today` får prop `onJarvis: () => void`.

- [ ] **Steg 1: Skriv det fallerande testet `src/nav.test.ts`**

```ts
it('fyra flikar i rätt ordning', () =>
  expect(SECTIONS.map((s) => s.id)).toEqual(['idag', 'ekonomi', 'vanor', 'nyheter']));
it('gammal sparad Jarvis-flik öppnar Idag', () => expect(restoreView('jarvis')).toBe('idag'));
it('okänd eller saknad vy öppnar Idag', () => {
  expect(restoreView(null)).toBe('idag');
  expect(restoreView('galax')).toBe('idag');
});
it('giltiga vyer behålls', () => {
  for (const v of ['idag', 'vanor', 'nyheter', 'account', 'overview', 'budget', 'goal', 'assets', 'wishlist'])
    expect(restoreView(v)).toBe(v);
});
```

- [ ] **Steg 2: Kör och se det falla**

Kör: `npx vitest run src/nav.test.ts`. Väntat: FAIL, modulen finns inte.

- [ ] **Steg 3: Skapa `src/nav.ts` och använd den i `App.tsx`**

Flytta typerna, `SECTIONS`, `ECONOMY`, `isEconomy` hit. `restoreView` ersätter logiken på rad 82 i App.tsx.

- [ ] **Steg 4: Kör testet och se det gå igenom**

Kör: `npx vitest run src/nav.test.ts`. Väntat: PASS.

- [ ] **Steg 5: Bygg `Room`**

Renderas bara när `open`. Ett `div.room.room-sheet` med `role="dialog"`, `aria-modal="true"`, `position: fixed;
inset: 0; z-index: 30`. Knappen "Tillbaka" uppe till vänster (synlig text, minst 44 px). Escape anropar `onClose`.
Medan rummet är öppet: `document.body.style.overflow = 'hidden'` och alla `meta[name="theme-color"]` får `#050912`;
båda återställs när det stängs. Fokus flyttas till Tillbaka-knappen när det öppnas.

- [ ] **Steg 6: Bygg `JarvisOrb` och koppla in rummet**

Orben är en 40 px rund knapp med `aria-label="Öppna Jarvis"`, i sidhuvudet före kontoknappen. Den andas med en
långsam skalning som stängs av under `prefers-reduced-motion`. App: `const JarvisView = lazy(() =>
import('./Jarvis'))`, `const [roomOpen, setRoomOpen] = useState(false)`, `<Room open={roomOpen}
onClose={closeRoom}><Suspense fallback={null}><JarvisView active={roomOpen} /></Suspense></Room>`. Ta bort `div
hidden={view !== 'jarvis'}`. I `Jarvis.tsx` flyttas ögonknappen från vänster till höger sida i `.jarvis-top`,
bredvid röstknappen, så att rummets Tillbaka får vänstra hörnet. Kontrollera i byggutdata att Space Grotesk och
JetBrains Mono inte längre ligger i startfilens CSS. `closeRoom` flyttar fokus tillbaka till orben. `Today` anropar `onJarvis` där den förut anropade
`onOpen('jarvis')`, och `'jarvis'` tas bort ur `Target`.

- [ ] **Steg 7: Bottenmenyn med fyra flikar**

Ta bort Jarvis ur menyn. Aktiv flik i `--cobalt`, övriga i `--muted`, etikett 13 px.

- [ ] **Steg 8: Kontrollera rummet för hand i Playwright**

Öppna med orben, stäng med Tillbaka och med Escape. Väntat varje gång: rummet borta, sidan går att rulla,
`document.activeElement` är orben, `theme-color` tillbaka till temats värde. Sätt `data-theme='light'`: rummet är
fortfarande mörkt. Sätt `localStorage` för sparad vy till `jarvis` och ladda om: Idag visas.

- [ ] **Steg 9: Tester, bygge, skärmbilder och commit**

Kör: `npm test && npm run build`. Skärmbilder av Idag med orben och av öppet rum i 375 ljust och mörkt.

```bash
git add -A && git commit -m "Två rum 2/7: fyra flikar, Jarvis som rum bakom orben"
```

---

### Task 3 (uppgift 3): Idag

**Filer:**
- Ändra: `src/Today.tsx` (rad 62–203), `src/styles.css` (Idag-blocken från rad ~2770 och ~3293)
- Ta bort ur `Jarvis.tsx`: `JarvisButton` och dess CSS (`.jarvis-open*`)

**Gränssnitt:**
- Ger CSS-komponenter som uppgift 4–6 använder:
  - `.hero` (ingen ram, ingen bakgrund), `.hero-amount` (`--font-amount`, `font-size: clamp(2.25rem, 11vw, 2.75rem)`,
    `white-space: nowrap`), `.hero-amount.negative` (`--lingon`), `.hero-amount.positive` (`--pine`),
    `.hero-text` (15 px, `--muted`)
  - `.group` (`--surface`, radie 14 px), `.group-title` (15 px, halvfet, `--muted`, utanför ytan),
    `.group-row` (minst 52 px, namn vänster med ellips, värde höger i `--font-amount`, linje `--line` mellan rader),
    `button.group-row` med pil till höger
  - `.empty` (streckad ram 1px `--line`, en mening, en knapp), `.skeleton-row`

- [ ] **Steg 1: Bygg om strukturen**

Ordning: hälsning och datum, `.hero` med "Blir över i {månad}", beloppet och meningen "Efter utgifter och planerat
sparande". Därefter "Jarvis säger" som en `.hero-text`-rad (oförändrad text, `dayBrief(facts, { hideMoney: true })`).
Grupp *Idag*: vanor ("2 av 5 klart"), att göra, hälsa. Grupp *Sparande*: sparmål ("24 %") och billån ("95 927 kr
kvar"). Gruppen döljs helt när den saknar rader. Snabbvalen och `JarvisButton` tas bort.

- [ ] **Steg 2: Laddning och fel**

Laddning: en `.hero` med skelett och två `.group` med tre `.skeleton-row` var. Fel: oförändrad text och "Försök igen".

- [ ] **Steg 3: Kontrollera stora tal**

Lägg lokal testdata där det som blir över är −123 456 kr. Skärmbild 375 ljust och mörkt. Väntat: beloppet på en
rad, inom marginalen, i lingon. Ta bort testdatan.

- [ ] **Steg 4: Tester, bygge, skärmbilder och commit**

Kör: `npm test && npm run build`. Skärmbilder: Idag med tom databas (tomläget i gruppen Idag syns, Sparande döljs) och
med testdata.

```bash
git add -A && git commit -m "Två rum 3/7: Idag med en huvudsiffra och två grupper"
```

---

### Task 4 (uppgift 4): Ekonomi

**Filer:**
- Ändra: `src/nav.ts`, `src/nav.test.ts`, `src/App.tsx` (rad 211–340), `src/Categories.tsx` (rad 160–260),
  `src/Forecast.tsx` eller `styles.css` (`.forecast-chart`), `src/styles.css`
- Skapa (utanför repot, i sessionens scratchpad): `compare-economy.mjs`

**Gränssnitt:**
- Konsumerar: `.hero`, `.group`, `.group-row` från uppgift 3.
- Ger `src/nav.ts`: `ECONOMY_TABS: { id: 'overview' | 'budget' | 'goal'; label: string }[]` och
  `tabOf(view: EconomyView): 'overview' | 'budget' | 'goal'`.

- [ ] **Steg 1: Spara beloppen före ändringen**

Skriv `compare-economy.mjs`: bygger och startar `npm run preview` på den commit som anges, lägger samma lokala
testdata i IndexedDB, öppnar varje ekonomivy (`overview`, `budget`, `goal`, `assets`, `wishlist`), plockar ut alla
belopp med `/−?\d[\d  ]*\skr/g` och sparar dem sorterade per vy i en JSON-fil. Kör mot uppgift 3:s commit.

- [ ] **Steg 2: Skriv det fallerande testet i `src/nav.test.ts`**

```ts
it('tre underflikar', () => expect(ECONOMY_TABS.map((t) => t.label)).toEqual(['Översikt', 'Budget', 'Prognos']));
it('Konton och Önskelista hör till Översikt', () => {
  expect(tabOf('assets')).toBe('overview');
  expect(tabOf('wishlist')).toBe('overview');
  expect(tabOf('budget')).toBe('budget');
});
```

- [ ] **Steg 3: Kör och se det falla, implementera, kör och se det gå igenom**

Kör: `npx vitest run src/nav.test.ts` före och efter.

- [ ] **Steg 4: Underflikarna som segmentväljare**

`.sub-nav` ersätts av `.segmented-row` med `ECONOMY_TABS`. Vald flik är `tabOf(view)`. Toningen från PR #104 tas
bort eftersom raden inte längre rullar.

- [ ] **Steg 5: Översikt**

`.hero` med samma text och belopp som i dag (hero-split för extra på lånet behålls under beloppet). Grupperna
Månadens budget, Nettovärde och Sparmål. Två `button.group-row`: "Konton" med nettovärdet och "Önskelista" med
`formatKr(wishTotal)`, som öppnar `assets` och `wishlist`. De vyerna får en textknapp "Översikt" överst som leder
tillbaka.

- [ ] **Steg 6: Budget med redigeringsläge**

I `Categories`: `const [arranging, setArranging] = useState(false)`. Knappen "Redigera"/"Klar" står till höger om
varje grupps rubrik. Plus (`item-add`) och handtagen (`categoryHandle`, radernas `handle`) renderas bara när
`arranging` är sant. I vanligt läge är raden bock, namn, belopp och pil.

- [ ] **Steg 7: Prognos**

Diagrammet: `--fc-save: var(--pine)`, `--fc-loan: var(--muted)`. Nyckeltalen överst blir en `.group` med rader.

- [ ] **Steg 8: Jämför beloppen**

Kör `compare-economy.mjs` mot den nya koden. Väntat: samma sorterade belopp i varje vy som i steg 1. Avvikelse
stoppar uppgiften.

- [ ] **Steg 9: Tester, bygge, skärmbilder och commit**

Kör: `npm test && npm run build`. Skärmbilder av alla fem ekonomivyer i 375 ljust och mörkt, och Budget i
redigeringsläge.

```bash
git add -A && git commit -m "Två rum 4/7: Ekonomi med tre underflikar och redigeringsläge i budgeten"
```

PR-texten ska säga att beloppen i alla ekonomivyer är identiska med main.

---

### Task 5 (uppgift 5): Vanor

**Filer:**
- Ändra: `src/vanor/vanor.css` (rad 1–45, 1641–1690 och färgvariabler i hela filen), `src/vanor/Vanor.tsx` vid behov,
  `src/vanor/CosmosView.tsx` (stängknappen), `src/room.css` (`.gv-close`)

**Gränssnitt:**
- Konsumerar: tokens från uppgift 1, `.group` och `.empty` från uppgift 3.

- [ ] **Steg 1: Byt Vanors färgvariabler**

`--done` och `--fill` blir `var(--pine)`, `--done-ink` och `--fill-ink` blir `var(--surface)`, `--done-soft` och
`--fill-soft` blir `color-mix(in srgb, var(--pine) 14%, var(--surface))`. `--sunk` blir `var(--bg)`. `--display`
och `--mono` blir `var(--font-text)` respektive `var(--font-amount)`. Ta bort `--hud-display`-arvet.

- [ ] **Steg 2: Solen i vardagsrummets färger**

Himlen: `--sky-top` blir `var(--surface)` och `--sky-bottom` blir `var(--bg)`. Solens egen gula ton behålls, den är
en bild och inte en status.

- [ ] **Steg 3: Listan som grupp**

Vanelistan och Att göra använder `.group`-ytan. Rubrikerna i vanlig skrift, inga versaler.

- [ ] **Steg 4: Galaxen**

Galaxens stängknapp (`.gv-close` i `CosmosView.tsx`) får texten "Tillbaka" och flyttas till övre vänstra
hörnet, som i Jarvis-rummet. Cockpit-hörnet uppe till vänster flyttas ner under knappen. Öppna Månad → galaxen.
Väntat: den ligger i rummet (mörk, HUD) även i ljust läge, Tillbaka och Escape stänger som förut.

- [ ] **Steg 5: Tester, bygge, skärmbilder och commit**

Kör: `npm test && npm run build`. Skärmbilder: tom Vanor och Vanor med två lokala testvanor, 375 ljust och mörkt.

```bash
git add -A && git commit -m "Två rum 5/7: Vanor i vardagsrummets färger"
```

---

### Task 6 (uppgift 6): Nyheter

**Filer:**
- Ändra: `src/news.ts`, `src/Nyheter.tsx` (rad 50–140), `src/styles.css` (Nyheter-blocket)
- Skapa: `src/news.test.ts`

**Gränssnitt:**
- Ger `src/news.ts`: `newsMeta(item: Pick<NewsItem, 'source' | 'published' | 'topic'>, options: { now?: number; withTopic?: boolean }): string`

- [ ] **Steg 1: Skriv det fallerande testet `src/news.test.ts`**

```ts
const now = Date.parse('2026-11-07T12:00:00Z');
const item = { source: 'SVT Sport', published: now - 16 * 60000, topic: 'fotboll' as const };
it('källa och tid', () => expect(newsMeta(item, { now })).toBe('SVT Sport, för 16 min sedan'));
it('med ämne', () => expect(newsMeta(item, { now, withTopic: true })).toBe('Fotboll, SVT Sport, för 16 min sedan'));
it('utan tid inget komma på slutet', () => expect(newsMeta({ ...item, published: 0 }, { now })).toBe('SVT Sport'));
```

- [ ] **Steg 2: Kör och se det falla, implementera, kör och se det gå igenom**

Kör: `npx vitest run src/news.test.ts`. Ämnets namn hämtas ur `TOPICS`, tiden med `ago`.

- [ ] **Steg 3: Använd `newsMeta` i listan**

`withTopic` är sant bara när ämnesfiltret är "Alla". Mittpunkterna försvinner.

- [ ] **Steg 4: Ytor**

Ämnena som chips (radie 999 px), vald chip i `--cobalt`. Nyheterna som rader i en `.group` med rubrik, ingress och
tonmärke. Tonlinjerna från PR #104 får `--pine` och `--lingon`.

- [ ] **Steg 5: Tester, bygge, skärmbilder och commit**

Kör: `npm test && npm run build`. Skärmbilder 375 ljust och mörkt, även felvyn när nyheterna inte går att hämta.

```bash
git add -A && git commit -m "Två rum 6/7: Nyheter som lista, metaraden utan mittpunkter"
```

---

### Task 7 (uppgift 7): Skrivbord, tillstånd och dokumentation

**Filer:**
- Ändra: `src/styles.css` (blocket `@media (min-width: 900px)`, rad ~3199), `src/App.tsx` (orbens plats)
- Ändra: `CLAUDE.md`, `STATUS.md`, `src/vanor/CLAUDE.md`

- [ ] **Steg 1: Sidomenyn**

Fyra flikar med ikoner, orben och kontoknappen längst ner, orben ovanför kontot. Idag i två kolumner: huvudsiffran
till vänster, grupperna till höger.

- [ ] **Steg 2: Genomgång av tillstånd**

För varje flik: tom databas, laddning (Playwright med fördröjd IndexedDB eller långsam nätverksprofil) och fel
(`supabase.co` blockerat, Nyheter offline). Väntat: tomläge med en mening och en knapp, skelett i rätt form,
felmening med "Försök igen". Rätta det som saknas.

- [ ] **Steg 3: Uppdatera reglerna**

I `CLAUDE.md` och `src/vanor/CLAUDE.md`: stilens lager är `styles.css`, `vanor/vanor.css` och `room.css` (bara
Jarvis och galaxen). Typsnitt: systemets i vardagsrummet, `ui-rounded` för belopp, Space Grotesk och JetBrains Mono
bara i rummet. I `STATUS.md`: navigeringen har fyra flikar och Jarvis nås via orben. Ta bort den kända buggen om
Abonnemang.

- [ ] **Steg 4: Tester, bygge, skärmbilder, commit och PR**

Kör: `npm test && npm run build`. Skärmbilder av alla flikar i 1200 och 375 ljust och mörkt.

```bash
git add -A && git commit -m "Två rum 7/7: skrivbord, tillstånd och uppdaterade regler"
git push -u origin claude/tva-rum
```

PR mot `main` med kort svensk beskrivning, "Så testar du", skärmbilder och raden om att ekonomins belopp är
identiska med main. Erik mergar själv.
