# Lär – bibliotek med personer (design)

## Varför
Erik har blivit intresserad av meditation och andning, personlig utveckling och hur kroppen påverkas av kallbad
och bastu. Han vill lära sig mer av kända människor inom områdena, direkt i Groundwork.

## Mål
- En ny flik **Lär** i vardagsrummet med en sida per person: vem de är, deras metod eller huvudidéer, deras
  viktigaste påståenden och länkar till källan (bok, studie, poddavsnitt).
- Varje påstående är märkt: **Väl belagt**, **Svagt stöd** eller **Egen åsikt**. Fakta och åsikt blandas aldrig.
- Filter på område: Andning och kyla, Kallbad och bastu, Meditation, Personlig utveckling.
- Allt Erik behöver finns i appen: varje påstående har en sammanfattning på några stycken skriven från den öppnade
  källan, och varje Börja här har bokens, artikelns eller avsnittets huvudpunkter. Länken finns kvar som referens.
- Några citat per person (sektionen Citat): personens egna ord på originalspråket med svensk översättning och
  länk till sidan där de står, kontrollerade ordagrant mot sidan.

## Inte mål (första versionen)
- Ingen loggning av egna pass, inga vanor skapas automatiskt.
- Inget flöde med nya avsnitt (kan komma senare, kräver serverändring).
- Jarvis och Idag läser inte biblioteket.
- Inga egna anteckningar, ingen "läst"-markering.

## Får inte hända
- Påhittade eller okontrollerade citat. Sammanfattningar skrivs med egna ord. Sedan 2026-11-13 (Eriks beslut) är
  citat tillåtna om de står ordagrant på en öppnad sida och är personens egna ord.
- Påståenden utan källa. Det som inte går att belägga med en länk tas inte med.
- Medicinska råd. Kallbad, bastu och andhållning har risker; sidan för de personerna har en kort varningsrad.
- Ekonomidelen rörs inte.

## Vägar som övervägdes
1. **Bibliotek med fast innehåll (valt av Erik).** Innehållet skrivs in i koden. Ingen server, ingen AI, ingen
   kostnad, fungerar utan nät. Fylls inte på av sig självt.
2. Flöde från poddar och videor, som Nyheter. Levande, men bara rubriker och länkar, och servern måste ändras.
3. Egna anteckningar. Enklast, men appen lär inget nytt.

## Personer (första versionen)
| Person | Typ | Område |
|---|---|---|
| Wim Hof | Utövare | Andning och kyla |
| Susanna Søberg | Forskare | Kallbad och bastu |
| Jari Laukkanen | Forskare | Kallbad och bastu |
| Andrew Huberman | Forskare och poddare | Andning och kyla, Kallbad och bastu |
| Rhonda Patrick | Forskare och poddare | Kallbad och bastu |
| Jon Kabat-Zinn | Forskare | Meditation |
| Sam Harris | Författare och poddare | Meditation (tillagd 2026-11-13) |
| James Clear | Författare | Personlig utveckling |
| Chris Williamson | Poddare | Personlig utveckling |

Typen visas på sidan, så att det syns om någon forskar själv eller återberättar andras idéer.

## Så byggs det (Claudes val)
- Egen mapp `src/lar/` (Eriks krav): `people.ts` (innehållet, typat), `Lar.tsx` (lista och personsida),
  `lar.css`, tester och en egen `CLAUDE.md` med delens regler. Inget av delens kod ligger utanför mappen, utom
  fliken i `nav.ts` och inkopplingen i `App.tsx`.
- Ingen databas och ingen synk: innehållet är fast och följer med appen. Laddas lazy som Nyheter.
- Femte flik i `nav.ts` (`lar`), efter Nyheter. Vardagsrummets stil och tokens, 375 px, ljust och mörkt,
  sidomeny på skrivbord.
- Listan: kort per person med namn, typ och en rad om vad man lär sig. Tryck öppnar personsidan med Tillbaka.
- Test: varje påstående har märkning och minst en källa med https-länk, unika id:n, alla områden har minst en
  person, `restoreView` klarar `lar`.
- Innehållet kontrolleras mot källorna på nätet när det skrivs. Länkar som inte går att bekräfta tas bort.

## Kvar till den som bygger
Exakt layout på personsidan, ikon för fliken, ordning på personerna.
