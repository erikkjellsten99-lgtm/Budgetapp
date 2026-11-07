# Designspec: Två rum

2026-11-07. Vald riktning för hela Groundwork. Underlag för bygget, del för del på en ny gren.

## Idén

Appen får två rum.

- **Vardagsrummet** är Idag, Ekonomi, Vanor och Nyheter. Ljust eller mörkt efter telefonen, lugnt, nordiskt. Här är
  siffrorna huvudsaken och inget tema står i vägen.
- **Specialrummet** är Jarvis och galaxen. Alltid mörkt, i dagens HUD-stil. Man går in dit och kommer ut igen.

Jarvis-orben är dörren mellan rummen. Den är det enda i vardagsrummet som lyser.

## Vem och vad

- Erik och Cassandra, mest på mobilen. Cassandra använder främst ekonomin.
- Vardagen: kolla pengarna, bocka vanor, läsa nyheter. Jarvis och galaxen är inte vardag.
- Lyckat är när Cassandra hittar det hon behöver i ekonomin utan att möta ett rymdtema, när en vana bockas på några
  sekunder och när varje vy har en sak som syns först.

## Principer

1. **En sak syns först i varje vy.** Allt annat är lugnare.
2. **Färg betyder något.** Tallgrön är klart, över och plus. Kobolt är det man kan trycka på eller har valt. Lingon är
   minus och fel. Inget annat färgas.
3. **Listor i stället för kort i kort.** Innehåll grupperas i ytor med tunna linjer mellan raderna.
4. **Vanlig skrift för etiketter.** Inga versaler och ingen mono i vardagsrummet.
5. **Rörelse bara som svar på tryck.** Enda undantaget är att orben andas långsamt.
6. **Ekonomins siffror och uträkningar ändras aldrig.** Bara hur de visas.

## Färger i vardagsrummet

| Token | Ljust | Mörkt | Används till |
|---|---|---|---|
| `--bg` | #F2F4F5 | #111518 | Bakgrund |
| `--surface` | #FFFFFF | #1A2025 | Grupper, ark, menyer |
| `--line` | #DCE2E6 | #2A333A | Linjer mellan rader |
| `--ink` | #1A1F24 | #E8ECEF | Text och belopp |
| `--muted` | #56616B | #9BA7B1 | Förklaringar, datum, sekundärt |
| `--pine` | #23614F | #6FC4A2 | Klart, blir över, plus, framsteg |
| `--cobalt` | #2E4FD8 | #9AAEFF | Knappar, länkar, vald flik |
| `--lingon` | #C2362F | #FF8F86 | Minus, fel, ta bort |

All text klarar minst 4,5:1 mot både `--bg` och `--surface` i båda lägena. Vit text på kobolt klarar 6,5:1, och i
mörkt läge får knappen text i `--bg`-färgen.

Inga skuggor. Ytor skiljs åt med färg. Ingen rutnätsbakgrund.

Hörn: grupper 14 px, knappar och fält 10 px, chips helt runda. Avstånd i steg om 4, 8, 12, 16, 24 och 32 px.
Sidmarginal 16 px på mobil.

## Typografi

- **Text:** systemets typsnitt (San Francisco på iPhone).
- **Belopp:** systemets rundade typsnitt (`ui-rounded`, med `system-ui` som reserv), halvfet, jämnbreda siffror.
  Det ger siffrorna en egen karaktär utan att ladda något.
- **Skala:** 13, 15, 17 (bas), 20, 28 och 44 px. 44 är bara för vyns huvudsiffra. Rubriker 28 px halvfet.
- **Specialrummet** behåller Space Grotesk och JetBrains Mono. De laddas bara när rummet öppnas, inte vid start.
- Inga nya typsnitt och inga nya beroenden.

## Komponenter

- **Huvudsiffra:** ett belopp i 44 px och en mening under som säger vad det betyder. En per vy.
- **Grupp:** rubrik i vanlig skrift ovanför ytan, rader inuti. Rad minst 52 px hög, namn till vänster, värde till
  höger. Långa namn klipps med tre punkter, beloppet bryts aldrig.
- **Rad med bock:** rund bock till vänster, pil till höger om raden går att öppna.
- **Knappar:** primär fylld kobolt, sekundär med kontur, textknapp för det minst viktiga. Minst 44 px tryckyta.
- **Segmentväljare:** för två till tre val, till exempel underflikar och ton i Nyheter.
- **Tomläge:** Vanors mönster överallt. Streckad ram, en mening om vad som saknas, en knapp som löser det.
- **Laddning:** skelett i samma form som innehållet som kommer.
- **Fel:** en mening om vad som hände och en knapp "Försök igen".
- **Ångra:** dagens ångra-ruta i de nya färgerna.
- **Jarvis-orben:** 40 px. På mobil uppe till höger i sidhuvudet, på skrivbord längst ner i sidomenyn. Andas
  långsamt. Ett tryck öppnar specialrummet i helskärm.

## Navigering

- Fyra flikar i bottenmenyn: Idag, Ekonomi, Vanor och Nyheter. Jarvis lämnar menyn och nås via orben.
- Ekonomi får tre underflikar som segmentväljare: Översikt, Budget och Prognos. Konton och Önskelista blir rader i
  Översikt som öppnar sin vy.
- Skrivbord från 900 px: sidomeny med de fyra flikarna och orben längst ner.

## Del för del

**Idag.** Hälsning och datum överst. Huvudsiffran är "Blir över i november" med en mening under. "Jarvis säger" blir
en lugn rad under siffran, utan egen ruta. Därefter två grupper: *Idag* med vanor, att göra och hälsa, och *Sparande*
med sparmål och billån. Snabbvalen tas bort eftersom bottenmenyn gör samma sak.

**Ekonomi.** Översikt leder med "Kvar att sätta in på sparande". Under den grupperna Månadens budget, Nettovärde och
Sparmål, och raderna Konton och Önskelista. Budget har månadsväljaren överst och kategorierna som grupper. Plus och
handtaget för att flytta syns bara i redigeringsläge, så att varje rad i vanligt läge är bock, namn och belopp.
Prognosens diagram visar sparat i tallgrönt och lånet i dämpad grå.

**Vanor.** Solen och himlen blir kvar som Vanors egen bild, i vardagsrummets färger. Vanelistan blir en grupp med
bockrader. Citatet i systemets typsnitt. Månad leder vidare till galaxen, som öppnas i specialrummet.

**Nyheter.** Ämnena som chips, tonen som segmentväljare med en linje för andelen. Metaraden skrivs som "SVT Sport,
för 16 min sedan" utan mittpunkter.

**Specialrummet.** Jarvis-skärmen och galaxen behåller dagens HUD-stil och är alltid mörka, oavsett telefonens läge.
En "Tillbaka"-knapp uppe till vänster leder ut. 3D-scenen ändras inte.

## Stilfilerna

- `styles.css`: nya tokens för vardagsrummet i ljust och mörkt, ny bas.
- `hud.css` blir `room.css` och gäller bara inuti specialrummet (`.room`, som sätts på Jarvis-skärmen och galaxen).
  Rutnätsbakgrunden och de globala HUD-reglerna tas bort.
- `vanor/vanor.css`: egna färgvariabler byts mot de gemensamma.
- Typsnittsimporterna flyttas från `main.tsx` till Jarvis och galaxen.

## Byggordning

En ny gren från `main`, en commit per steg. Varje steg ska gå att visa på egen hand.

1. Tokens, typografi och rummet avgränsat. Appen får nya färger överallt, inget flyttas.
2. Navigeringen: fyra flikar, orben och Jarvis som rum.
3. Idag.
4. Ekonomi.
5. Vanor.
6. Nyheter.
7. Skrivbord, och en genomgång av tomlägen, laddning och fel i alla delar.

Varje steg kontrolleras med `npm test`, `npm run build` och skärmbilder i 375 px ljust och mörkt samt 1200 px. Steg
som rör ekonomin jämför varje fliks text mot `main` före och efter, och PR:en säger att beloppen är identiska.

## Utanför

- Galaxens 3D-scen. Den är ett eget projekt.
- Ny funktionalitet.
- Ekonomins data och uträkningar, `ask.ts` och Siri-svaren.

## Beslut att bekräfta

1. Konton och Önskelista flyttas från underflikar till rader i Översikt.
2. Plus och handtag i budgetlistan visas bara i redigeringsläge.
3. Snabbvalen på Idag tas bort.

## Efter bygget

Reglerna om typsnitt i Design/CLAUDE.md och src/vanor/CLAUDE.md ("rubriker ärver Space Grotesk") uppdateras till det
som står här.
