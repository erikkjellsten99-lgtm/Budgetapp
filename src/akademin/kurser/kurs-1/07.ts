// Kurs 1, lektion 7. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const FI_EMITTENTER: Source = {
  title: 'Emittenter, Finansinspektionen',
  url: 'https://fi.se/sv/marknad/emittenter',
  checked: CHECKED,
};
const VOLVO_Q4: Source = {
  title: 'Volvo Group, fjärde kvartalet och helåret 2025, AB Volvo',
  url: 'https://www.volvogroup.com/en/news-and-media/news/2026/jan/volvo-group--the-fourth-quarter-and-full-year-2025.html',
  checked: CHECKED,
};
const ATLAS_Q3: Source = {
  title: 'Atlas Copco, rapport för tredje kvartalet 2026 (22 oktober 2026)',
  url: 'https://www.atlascopcogroup.com/en/media/press-releases/2026/2026-q3',
  checked: CHECKED,
};

export const K1_07: Lesson = {
  id: 'k1-07',
  course: 1,
  number: 7,
  title: 'Så tittar du på ett bolag första gången',
  body: [
    {
      kind: 'p',
      text:
        'Innan du har en åsikt om en aktie behöver du förstå bolaget bakom den. Det här är den första genomgången, den du gör ' +
        'innan du läser en enda analys eller tittar på kursgrafen. Den tar ungefär en kvart, och resten av utbildningen ' +
        'bygger vidare på den.',
    },
    { kind: 'h', text: 'Var du hittar fakta' },
    {
      kind: 'p',
      text:
        'Bolag vars aktier handlas på en marknadsplats har krav på sig att informera allmänheten. Finansinspektionen nämner ' +
        'bland annat finansiell rapportering enligt IFRS, ett internationellt regelverk för redovisning. ' +
        'Kraven skiljer sig mellan en reglerad marknad som Nasdaq Stockholm och en handelsplattform som Nasdaq First North.',
    },
    {
      kind: 'p',
      text:
        'Gå direkt till bolagets egen sida för investerare. Där finns årsredovisningen, kvartalsrapporterna och ' +
        'pressmeddelandena. Börja där i stället för med vad andra skriver om bolaget, så vet du vad som är bolagets egna ' +
        'siffror och vad som är någons tolkning.',
    },
    { kind: 'h', text: 'Fem frågor' },
    {
      kind: 'list',
      items: [
        'Vad säljer bolaget, och till vem? Titta på affärsområdena, alltså de delar som verksamheten är uppdelad i.',
        'Hur stor är försäljningen, och växer den? Jämför med samma period året före.',
        'Blir det vinst? Titta på rörelseresultatet och räkna ut rörelsemarginalen.',
        'Kommer pengarna in? Titta på kassaflödet från den löpande verksamheten.',
        'Vad kan gå fel? Läs vad ledningen själv skriver om risker och om läget framåt.',
      ],
    },
    { kind: 'h', text: 'Orden i rapporten' },
    {
      kind: 'p',
      text:
        'Omsättning, eller intäkter, är allt bolaget har sålt för under perioden. Rörelseresultatet är det som blir kvar när ' +
        'kostnaderna för själva verksamheten är dragna, men före räntor och skatt. Rörelsemarginalen är rörelseresultatet ' +
        'delat med omsättningen, i procent. Den visar hur många kronor av varje hundralapp i försäljning som blir ' +
        'rörelseresultat.',
    },
    {
      kind: 'p',
      text:
        'Resultat per aktie är bolagets vinst efter skatt delad med antalet aktier. Kassaflöde från den löpande verksamheten ' +
        'visar hur mycket pengar som faktiskt kom in från verksamheten. Vinst och kassaflöde kan skilja sig mycket ett ' +
        'enskilt kvartal, till exempel om kunderna inte har betalat än.',
    },
    {
      kind: 'p',
      text:
        'Industribolag redovisar ofta också orderingång, alltså hur mycket kunderna har beställt under perioden. Den ger en ' +
        'fingervisning om vad som kan bli försäljning längre fram.',
    },
    {
      kind: 'p',
      text:
        'Tillväxten kan du räkna själv: årets siffra minus fjolårets, delat med fjolårets. Atlas Copcos intäkter gick från ' +
        '41 621 till 47 920 miljoner kronor, en ökning med ungefär 15 procent. Rapporten anger också en organisk ökning på 11 ' +
        'procent. Det är ett mått som du lär dig mer om i kursen om kvartalsrapporten. Skriv upp ord du inte känner igen.',
    },
    { kind: 'h', text: 'Jämför med rätt sak' },
    {
      kind: 'p',
      text:
        'Marginaler skiljer sig mycket mellan bolag och branscher. Volvo redovisade för helåret 2025 en rörelsemarginal på ' +
        '10,1 procent, medan Atlas Copcos var 20,8 procent under tredje kvartalet 2026. Det betyder inte att det ena bolaget ' +
        'är bättre än det andra: perioderna är olika och verksamheterna fungerar olika. Jämför därför främst ett bolag med sig ' +
        'självt över tid, och med bolag som gör liknande saker.',
    },
    { kind: 'h', text: 'Läs rapporten i rätt ordning' },
    {
      kind: 'list',
      items: [
        'Börja med sammanfattningen på första sidan. De viktigaste siffrorna står nästan alltid där.',
        'Siffran inom parentes är oftast samma period året före. Jämför med den, inte med förra kvartalet, eftersom många verksamheter varierar med säsongen.',
        'Läs vd:ns kommentar och avsnittet om utsikter. Där säger ledningen vad den själv tycker har hänt.',
        'Notera vad du inte förstår. Det är ofta där nästa lektion finns.',
      ],
    },
    { kind: 'h', text: 'Skriv ner det' },
    {
      kind: 'p',
      text:
        'Det du skriver själv minns du. Skriv med egna ord hur bolaget tjänar pengar, i högst tre meningar. Klarar du inte ' +
        'det är det ett tecken på att du inte förstår bolaget ännu, och det är bra att veta. Labbet efter lektionen är ' +
        'precis den övningen.',
    },
    {
      kind: 'p',
      text:
        'Skriv också vad som skulle få dig att ändra uppfattning. Det gör det lättare att följa upp senare utan att ' +
        'lura dig själv. Beslutsdagboken i Akademin är till för det. Spara också länken till rapporten på bolagets kort i ' +
        'Mina bolag, så hittar du den när nästa rapport kommer.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig att titta på ett bolag, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'Atlas Copco, tredje kvartalet 2026',
    text:
      'Atlas Copco har fyra affärsområden (kompressorteknik, vakuumteknik, industriteknik och kraftteknik), som enligt ' +
      'rapporten erbjuder lösningar för tryckluft och vakuum, energi, länspumpar och industripumpar, samt industriverktyg, ' +
      'montering och maskinseende. Helåret 2025 omsatte koncernen 168 miljarder kronor ' +
      'och hade ungefär 56 000 anställda vid årets slut. Under tredje kvartalet 2026 var intäkterna 47 920 miljoner kronor ' +
      '(41 621 samma kvartal 2025) och rörelseresultatet 9 950 miljoner kronor (8 546). Rörelsemarginalen blev 20,8 procent ' +
      '(20,5), alltså 9 950 delat med 47 920. Orderingången ökade med 29 procent till 52 338 miljoner kronor (40 517), och ' +
      'det som bolaget kallar operativt kassaflöde var 8 728 miljoner kronor (7 330). Resultatet per aktie var 1,58 kronor (1,37). ' +
      'Om framtiden skrev bolaget att kundernas aktivitet väntas ligga kvar på samma nivå.',
    source: ATLAS_Q3,
  },
  key: [
    'Börja med bolagets egna rapporter och svara på fem frågor: vad, hur mycket, vinst, kassaflöde och risker.',
    'Rörelsemarginalen är rörelseresultatet delat med omsättningen, och den visar hur mycket av försäljningen som blir kvar.',
    'Jämför med samma period året före och skriv med egna ord hur bolaget tjänar pengar.',
  ],
  terms: [
    { word: 'Sida för investerare', meaning: 'Bolagets egen webbsida med rapporter, pressmeddelanden och information om aktien.' },
    { word: 'IFRS', meaning: 'Internationella redovisningsregler som Finansinspektionen nämner bland kraven på noterade bolag. Vilka bolag som måste följa dem beror på var aktien handlas.' },
    { word: 'Årsredovisning', meaning: 'Bolagets rapport om hela räkenskapsåret.' },
    { word: 'Kvartalsrapport', meaning: 'Bolagets rapport om ett kvartal, tre månader.' },
    { word: 'Affärsområde', meaning: 'En del av verksamheten som redovisas för sig.' },
    { word: 'Omsättning', meaning: 'Allt bolaget har sålt för under perioden, även kallat intäkter.' },
    { word: 'Rörelseresultat', meaning: 'Det som blir kvar av omsättningen efter verksamhetens kostnader, före räntor och skatt.' },
    { word: 'Rörelsemarginal', meaning: 'Rörelseresultatet delat med omsättningen, i procent.' },
    { word: 'Resultat per aktie', meaning: 'Vinsten efter skatt delad med antalet aktier.' },
    { word: 'Kassaflöde från den löpande verksamheten', meaning: 'De pengar som faktiskt kom in från verksamheten under perioden.' },
    { word: 'Orderingång', meaning: 'Hur mycket kunderna beställde under perioden.' },
    { word: 'Tillväxt', meaning: 'Hur mycket en siffra har ökat mot samma period året före, i procent.' },
  ],
  sources: [FI_EMITTENTER, ATLAS_Q3, VOLVO_Q4],
  questions: [
    {
      id: 'k1-07-q1',
      text: 'Ett bolag har en omsättning på 1 000 miljoner kronor och ett rörelseresultat på 150 miljoner kronor. Vad är rörelsemarginalen?',
      options: ['6,7 procent', '15 procent', '85 procent', '150 procent'],
      correct: 1,
      why:
        'Rörelsemarginalen är rörelseresultatet delat med omsättningen: 150 delat med 1 000 är 0,15, alltså 15 procent. ' +
        'Av varje hundralapp i försäljning blev 15 kronor rörelseresultat.',
    },
    {
      id: 'k1-07-q2',
      text: 'Varför jämför rapporterna oftast tredje kvartalet i år med tredje kvartalet i fjol, och inte med andra kvartalet i år?',
      options: [
        'Lagen förbjuder jämförelser mellan olika kvartal samma år.',
        'Andra kvartalet är alltid det sämsta, så jämförelsen blir missvisande.',
        'Många verksamheter varierar med säsongen, så samma kvartal ger en rättvisare jämförelse.',
        'Siffrorna för förra kvartalet är inte färdigräknade förrän året är slut.',
      ],
      correct: 2,
      why:
        'Försäljningen kan skifta med årstiden, semestrar och helger. Genom att jämföra med samma kvartal året före tar ' +
        'man bort det mesta av säsongens påverkan och ser den verkliga förändringen.',
    },
    {
      id: 'k1-07-q3',
      text:
        'Under tredje kvartalet 2026 hade Atlas Copco en orderingång på 52 338 miljoner kronor och intäkter på 47 920 miljoner kronor. Vad betyder det?',
      options: [
        'Kunderna beställde för mer än bolaget levererade och redovisade som intäkter under kvartalet.',
        'Bolaget gick med förlust under kvartalet.',
        'Bolaget tjänade 4 418 miljoner kronor extra på beställningarna.',
        'Rapporten måste innehålla ett räknefel.',
      ],
      correct: 0,
      why:
        'Orderingång är vad kunderna beställt, intäkter är det som levererats och redovisats som försäljning. Fler beställningar ' +
        'än leveranser betyder normalt att mer ligger beställt men inte levererat. Det säger inget om vinsten.',
    },
    {
      id: 'k1-07-q4',
      text:
        'Ett bolag redovisar vinst för kvartalet, men kassaflödet från den löpande verksamheten är negativt. Vad är rimligast att göra?',
      options: [
        'Bortse från kassaflödet, eftersom vinsten är det enda som räknas.',
        'Anta att rapporten är fel och vänta på en rättelse.',
        'Räkna kassaflödet som vinst, eftersom de två alltid blir lika till slut.',
        'Ta reda på varför pengarna inte kommit in, till exempel i rapportens kommentarer.',
      ],
      correct: 3,
      why:
        'Vinst och kassaflöde kan skilja sig ett kvartal, till exempel om kunderna inte har betalat än eller om bolaget byggt ' +
        'upp lager. Det är en fråga att undersöka, inte något att strunta i eller dra förhastade slutsatser av.',
    },
  ],
  lab: 'Lägg in ditt första bolag i Mina bolag och skriv tre meningar om hur det tjänar pengar.',
};
