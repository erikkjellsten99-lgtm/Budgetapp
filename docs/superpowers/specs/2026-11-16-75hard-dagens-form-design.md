# 75 Hard: Dagens form (kort design)

## Varför
Erik vill att 75 Hard ska känna av hälsodatan från Apple Hälsa och anpassa dagen, till exempel föreslå lugnare
pass en dag då kroppen är sliten. I dag är förslagen under passen samma text varje dag.

## Mål
- Överst i dagens vy i en utmaning med pass: **Dagens form** (Pigg, Okej eller Sliten) med siffrorna som avgjorde.
- Under "Lätt pass" och "Tufft pass": ett förslag som passar formen.

## Inte mål
- Reglerna ändras inte. Fortfarande två pass, och en miss startar om utmaningen. Formen är bara ett råd.
- Ingen notis, inget i Idag eller Jarvis, ingen ändring på servern.

## Får inte hända
- Att en sliten dag gör utmaningen lättare att klara, eller att något bockas automatiskt.
- Att formen visas som säker när datan saknas: utan nattens sömn visas ingen form, bara vad som saknas.

## Sätt att bygga
- **A. Råd i dagvyn** (valt av Erik): form och förslag räknas i appen ur hälsodatan som redan finns lokalt.
- B. A plus morgonnotis: kräver ändring i `reminders` och "Lägg ut". Kan läggas till senare.
- C. Formen ändrar kraven: gör utmaningen lättare, inte längre 75 Hard. Avfärdat.

## Hur formen räknas (Claudes val, ändras lätt)
Ren funktion i `src/challenges/readiness.ts`, med tester. Poäng för det som tyder på trötthet:

| Signal | Poäng |
|---|---|
| Nattens sömn under 6 h | 2 |
| Nattens sömn 6–7 h | 1 |
| Vilopuls minst 7 slag över ditt snitt | 2 |
| Vilopuls 4–6 slag över ditt snitt | 1 |
| Gårdagens träning minst 90 min | 1 |
| Sömnpoäng under 60 (om den finns) | 1 |

0 poäng = Pigg, 1–2 = Okej, 3 eller fler = Sliten.

- Nattens sömn = dagens post (natten hör till dagen du vaknar). Saknas den visas "Ingen sömn från i natt än"
  och ingen form.
- Vilopuls = dagens värde, annars gårdagens. Snittet = de upp till 14 senaste dagarna före det värdet, minst 5
  dagar med värde, annars räknas vilopulsen inte.

## Förslagen
Gäller uppgifter av typen pass vars namn börjar med "Lätt" respektive "Tufft" (mallen 75 Hard). Andra pass får
inget förslag.

| Form | Lätt pass | Tufft pass |
|---|---|---|
| Pigg | Lugn jogg eller promenad utomhus. | Kör hårt: intervaller, tempolöpning eller tungt gym. |
| Okej | Promenad eller lugn jogg. | Gym eller distans i jämnt tempo. Spara intervallerna. |
| Sliten | Promenad eller rörlighet, låg puls. | Lugn styrka eller zon 2 i 45 min. Inga intervaller. |

## Det Erik behöver göra
En automatisering till på telefonen som kör "Hälsa Groundwork daglig" strax efter uppvaknandet (t.ex. 05:10),
annars finns nattens sömn inte i Groundwork förrän 23:50.

## Kvar till den som bygger
Utseendet på kortet (följ `challenges.css` och designspecen "Två rum"), exakt ordalydelse i raden med siffror.
