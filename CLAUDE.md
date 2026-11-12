# Groundwork – regler för Claude

Groundwork är en app för budget, sparande, vanor och hälsa, på svenska. Idag används den av två personer i ett
hushåll (Erik och Cassandra), men den är byggd för att kunna bli en app för fler hushåll. Svara på svenska, kort.

## Vad appen är
- **Ekonomi:** budget per månad, inkomster, prognos, sparmål, billån, konton och önskelista. Hushållets data.
- **Vanor:** vanor, bockningar, Att göra och hälsa från Apple Hälsa. Varje person har sina egna.
- **Jarvis:** frågor om ekonomin och dagen, med röst eller text. Läser bara, ingen AI, inget som kostar.
- **Galax:** en 3D-vy över vanorna och ekonomin, öppnas från Vanor → Månad.
- **Nyheter:** rubriker från SVT med ton. Läser bara.

Mer om varje del: `STATUS.md` (vad som funkar och är trasigt) och `src/vanor/CLAUDE.md`,
`supabase/functions/inbox/CLAUDE.md`.

## Hur det hänger ihop
- **Lokalt först:** all data sparas i webbläsarens IndexedDB. Appen fungerar utan uppkoppling.
- **Synk:** Supabase. Konto, hushåll och inloggning finns (`src/sync.ts`, `src/Account.tsx`). Bara inloggade medlemmar
  i ett hushåll kan läsa dess data (RLS i Supabase).
- **Server:** edge function `inbox` (`supabase/functions/inbox/`) tar emot från iPhone-genvägar, läser sammanfattningen
  för Siri och Jarvis, och hämtar nyheter. Delad kod som appen och servern båda använder ligger där.
- **Ett ställe för siffror:** uträkningar (blir över, sparmål, prognos, vad som ska göras idag) ligger i delad kod.
  Appen, Siri och Jarvis får därför alltid samma siffror. Ändra aldrig en siffra på bara ett ställe.
- **Publicering:** GitHub Pages från `main` (`.github/workflows/deploy.yml`). Installeras som app på telefonen (PWA).
- **Stil:** tre CSS-lager i ordning: `styles.css`, `vanor/vanor.css`, `hud.css`. Färger via variabler, ljust och mörkt läge.

## Starta, testa, bygga
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest, alla gröna
npm run build      # måste gå igenom före push
```
Skärmbilder: Playwright, 375 px, ljust och mörkt läge. Blockera `supabase.co` i testerna och använd tom lokal databas.

## Regler som gäller för alla
- **Ekonomidatan är verklig.** Ändra, avrunda, flytta, ta bort eller hitta aldrig på något, varken data eller
  uträkningar. Verkar en uträkning fel: beskriv och fråga.
- **Testdata** bara i tom lokal databas. Aldrig till Supabase, aldrig i Eriks riktiga data.
- **Integritet:** en användares personliga data (vanor, hälsa, Att göra) visas aldrig för andra i hushållet utan att
  det är en medveten funktion. Hälsodata lämnar aldrig appen eller servern.
- **Pusha aldrig till `main`.** Egen gren, PR med kort svensk beskrivning och "Så testar du". Erik mergar själv.
- **Testerna och bygget gröna** före varje push.
- **IndexedDB:** höj aldrig en befintlig version. Lägg till en ny med uppgraderingssteg.
- **Supabase** (databas, edge function) ändras bara efter att Erik skrivit "Lägg ut".
- **Kostnader:** inga nya tjänster eller tekniker som kostar pengar utan att fråga. Erik vill inte betala något.
- **Ett förslag per leverans** på förbättring. Bygg det inte utan att fråga.
- **Svenska** datum (2026-10-20) och belopp (1 234 kr), å/ä/ö i all text och testdata.

## Om det ska bli en app för fler
Det här finns inte än, och ska inte byggas utan att Erik beslutar det:
- Flera hushåll per användare och inbjudningar. Idag finns ett hushåll per konto.
- Betalning och abonnemang. Kräver att Erik godkänner en tjänst som kostar.
- Egen domän och App Store/Play. Idag GitHub Pages och PWA.
- Juridik: personuppgifter, hälsodata (känsliga) och integritetspolicy måste vara klara före publik lansering.
Föreslå alltid ett steg i taget och säg vad det kostar, tar tid och vad det kräver av Erik.
