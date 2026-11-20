// Kurs 2, lektion 3. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson } from '../../types';
import { ARL, ATLAS_DEF, ATLAS_Q3, HM_AR25, HM_FY25 } from './kallor';

export const K2_03: Lesson = {
  id: 'k2-03',
  course: 2,
  number: 3,
  title: 'Kassaflödesanalysen: vart pengarna tog vägen',
  body: [
    {
      kind: 'p',
      text:
        'Resultaträkningen visar vinsten. Kassaflödesanalysen visar pengarna: vad som faktiskt kom in och gick ut under perioden. ' +
        'Enligt årsredovisningslagen (kontrollerad 2026-11-20) ska kassaflödesanalysen redovisa företagets in- och utbetalningar under räkenskapsåret, och ' +
        'den ska finnas i årsredovisningen för större företag. Atlas Copco och H&M visar den också i sina rapporter under året.',
    },
    { kind: 'h', text: 'Tre delar' },
    {
      kind: 'list',
      items: [
        'Den löpande verksamheten: pengar från det bolaget gör till vardags, att sälja och leverera. Hit hör också betald skatt och förändringar i lager, kundfordringar och leverantörsskulder.',
        'Investeringsverksamheten: pengar till och från köp och försäljning av anläggningstillgångar, till exempel maskiner, och köp av andra bolag.',
        'Finansieringsverksamheten: pengar till och från ägare och långivare, till exempel nya lån, amorteringar, utdelningar och återköp av aktier.',
      ],
    },
    {
      kind: 'p',
      text:
        'De tre delarna läggs ihop till periodens kassaflöde. Lägg till de likvida medlen vid periodens början och ' +
        'valutakursdifferenserna, alltså att pengar i utländsk valuta blir värda mer eller mindre i kronor, så får du de likvida ' +
        'medlen vid periodens slut. Den siffran ska vara densamma som i balansräkningen.',
    },
    { kind: 'h', text: 'Varför vinst inte är pengar' },
    {
      kind: 'p',
      text:
        'Vinsten och kassaflödet skiljer sig av flera skäl. Avskrivningar är en kostnad i resultaträkningen men ingen utbetalning ' +
        'den perioden, eftersom maskinen betalades när den köptes. Därför läggs avskrivningarna tillbaka i kassaflödesanalysen. ' +
        'En försäljning på faktura ger intäkt direkt men pengar först när kunden betalar. Varor som köps till lagret kostar pengar ' +
        'innan de syns som kostnad. Och skatten betalas inte alltid samma period som den kostnadsförs. H&M:s skattekostnad i ' +
        'resultaträkningen för 2025 var 4 117 miljoner kronor, men den betalda skatten i kassaflödesanalysen 3 890 miljoner.',
    },
    {
      kind: 'p',
      text:
        'Därför börjar den löpande verksamheten med ett resultat och justerar sedan för sådant som inte är pengar. Atlas ' +
        'Copco börjar med rörelseresultatet, H&M med resultatet efter finansiella poster.',
    },
    { kind: 'h', text: 'Ett exempel från H&M' },
    {
      kind: 'p',
      text:
        'Under räkenskapsåret 2025 var H&M:s resultat efter finansiella poster 16 202 miljoner kronor och periodens resultat ' +
        '12 085 miljoner. Kassaflödet från den löpande verksamheten var 31 120 miljoner, mer än dubbelt så mycket som periodens ' +
        'resultat. Den största förklaringen är att av- och nedskrivningar på 21 140 miljoner lades tillbaka. Betald skatt drog ' +
        '3 890 miljoner, och mindre lager gav 3 785 miljoner, medan rörelsefordringar och rörelseskulder tillsammans drog ' +
        '6 416 miljoner.',
    },
    {
      kind: 'p',
      text:
        'Mer än hälften av av- och nedskrivningarna gällde hyrda butiker, lager och kontor. Enligt not 17 i årsredovisningen var ' +
        '12 488 miljoner avskrivningar och 202 miljoner nedskrivningar av nyttjanderättstillgångar. Hyran för lokalerna betalas ' +
        'samma år, men den syns inte i den löpande verksamheten. Den står i finansieringen som amortering av leasingskulder.',
    },
    {
      kind: 'p',
      text:
        'Investeringarna drog 10 615 miljoner, mest i inventarier och utrustning. Finansieringen drog 16 308 miljoner. Där ingick ' +
        'utdelning på 10 906 miljoner och amortering av leasingskulder på 12 328 miljoner, medan nya lån tillförde pengar. ' +
        'Periodens kassaflöde blev 4 197 miljoner kronor.',
    },
    {
      kind: 'p',
      text:
        'Lägg märke till var hyrorna hamnar. H&M redovisar amorteringen på leasingskulderna, 12 328 miljoner, under finansieringen, inte under den ' +
        'löpande verksamheten. Hur ett bolag delar upp posterna påverkar alltså hur stort kassaflödet från den löpande ' +
        'verksamheten ser ut. Läs vilka rader som ingår innan du jämför två bolag.',
    },
    {
      kind: 'p',
      text:
        'Ett enskilt kvartal kan se mycket olika ut från helåret. Atlas Copcos finansieringsverksamhet gav plus 348 miljoner ' +
        'kronor under tredje kvartalet 2026, men minus 11 391 miljoner för januari till september. Skillnaden är främst ' +
        'utdelningen på 12 196 miljoner, som betalades ut tidigare under året. Jämför därför gärna både kvartalet och de nio ' +
        'eller tolv månaderna.',
    },
    { kind: 'h', text: 'Bolagens egna kassaflödesmått' },
    {
      kind: 'p',
      text:
        'Bolag kan ha egna mått för hur mycket pengar som blir kvar när verksamheten har betalat sina investeringar. Atlas ' +
        'Copco kallar sitt mått operativt kassaflöde och definierar det som kassaflödet från rörelsen och investeringarna, utan ' +
        'köp och försäljningar av bolag. Under tredje kvartalet 2026 var det 8 728 miljoner kronor. Atlas Copco skriver själv att ' +
        'sådana mått inte räknas likadant i alla bolag. Läs därför alltid bolagets egen definition innan du jämför.',
    },
    { kind: 'h', text: 'Så läser du den' },
    {
      kind: 'list',
      items: [
        'Jämför kassaflödet från den löpande verksamheten med periodens resultat. Är skillnaden stor, leta efter förklaringen.',
        'Titta på förändringen i rörelsekapitalet: lager, kundfordringar och leverantörsskulder. Den kan svänga mycket mellan kvartal.',
        'Jämför investeringarna med avskrivningarna över flera år.',
        'Se vart pengarna gick i finansieringen: till utdelningar, återköp, amorteringar eller in från nya lån.',
        'Kontrollera att de likvida medlen vid periodens slut är samma belopp som i balansräkningen.',
      ],
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig läsa en kassaflödesanalys, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'Atlas Copco, tredje kvartalet 2026',
    text:
      'Alla belopp i miljoner kronor, för juli till september 2026. Den löpande verksamheten började med rörelseresultatet på ' +
      '9 950. Av- och nedskrivningar på 2 634 och andra poster som inte är pengar på 1 205 lades tillbaka, vilket gav ett ' +
      'kassamässigt rörelseöverskott på 13 789. Efter bland annat betald skatt och förändringen i rörelsekapitalet blev ' +
      'kassaflödet från den löpande verksamheten 10 240. Investeringsverksamheten gav minus 1 796 och finansieringsverksamheten ' +
      'plus 348. Periodens kassaflöde blev 8 792. De likvida medlen var 14 709 vid kvartalets början, och med ' +
      'valutakursdifferenser på 777 blev de 24 278 vid kvartalets slut, samma belopp som i balansräkningen den 30 september 2026.',
    source: ATLAS_Q3,
  },
  key: [
    'Kassaflödesanalysen delar pengarnas rörelser i löpande verksamhet, investeringar och finansiering.',
    'Vinst och kassaflöde skiljer sig bland annat på grund av avskrivningar, rörelsekapital och när skatten betalas.',
    'Bolagens egna kassaflödesmått räknas olika, så läs definitionen innan du jämför.',
  ],
  terms: [
    { word: 'Kassaflödesanalys', meaning: 'Uppställningen av bolagets in- och utbetalningar under en period.' },
    { word: 'Löpande verksamhet', meaning: 'Den del av kassaflödet som kommer från bolagets vardagliga affärer.' },
    { word: 'Investeringsverksamhet', meaning: 'Den del av kassaflödet som gäller köp och försäljning av anläggningstillgångar och bolag.' },
    { word: 'Finansieringsverksamhet', meaning: 'Den del av kassaflödet som gäller lån, amorteringar, utdelningar och återköp av aktier.' },
    { word: 'Periodens kassaflöde', meaning: 'Summan av de tre delarna, alltså hur mycket pengarna ökade eller minskade under perioden.' },
    { word: 'Amortering', meaning: 'Återbetalning av en del av ett lån eller en leasingskuld.' },
    { word: 'Återköp av aktier', meaning: 'När bolaget köper tillbaka sina egna aktier från marknaden.' },
    { word: 'Leasingskuld', meaning: 'Skulden för framtida betalningar på det bolaget hyr eller leasar, till exempel lokaler.' },
    { word: 'Valutakursdifferens', meaning: 'Att pengar eller andra poster i utländsk valuta blir värda mer eller mindre i kronor när kursen ändras.' },
    { word: 'Kassamässigt rörelseöverskott', meaning: 'Atlas Copcos rad för rörelseresultatet plus poster som inte är pengar, till exempel avskrivningar.' },
    { word: 'Operativt kassaflöde', meaning: 'Atlas Copcos eget mått: kassaflödet från rörelsen och investeringarna, utan köp och försäljningar av bolag.' },
  ],
  sources: [ARL, ATLAS_Q3, ATLAS_DEF, HM_FY25, HM_AR25],
  questions: [
    {
      id: 'k2-03-q1',
      text:
        'Ett bolag har ett kassaflöde från den löpande verksamheten på 500 miljoner kronor, från investeringsverksamheten på minus 300 miljoner och från finansieringsverksamheten på minus 150 miljoner. Vad blev periodens kassaflöde?',
      options: ['950 miljoner kronor', '50 miljoner kronor', '350 miljoner kronor', 'Minus 50 miljoner kronor'],
      correct: 1,
      why:
        'De tre delarna läggs ihop: 500 minus 300 minus 150 är 50 miljoner kronor. Pengarna ökade alltså med 50 miljoner under ' +
        'perioden, före eventuella valutakursdifferenser.',
    },
    {
      id: 'k2-03-q2',
      text: 'Bolaget betalar ut utdelning till aktieägarna. Var syns det i kassaflödesanalysen?',
      options: [
        'I den löpande verksamheten, eftersom utdelning betalas varje år.',
        'I investeringsverksamheten, eftersom ägarna har investerat i bolaget.',
        'I finansieringsverksamheten, tillsammans med lån och återköp.',
        'Ingenstans, eftersom utdelningen bara syns i resultaträkningen.',
      ],
      correct: 2,
      why:
        'Utdelning är pengar till ägarna och hör till finansieringen. I H&M:s kassaflödesanalys för 2025 står utdelningen på ' +
        '10 906 miljoner kronor under finansieringsverksamheten.',
    },
    {
      id: 'k2-03-q3',
      text:
        'H&M:s periodens resultat för räkenskapsåret 2025 var 12 085 miljoner kronor, men kassaflödet från den löpande verksamheten var 31 120 miljoner. Vad förklarar mest av skillnaden?',
      options: [
        'H&M tog nya lån som räknas in i den löpande verksamheten.',
        'Kunderna betalade i förskott för nästa års varor.',
        'Rapporten räknar kassaflödet före all skatt och alla kostnader.',
        'Av- och nedskrivningar på 21 140 miljoner läggs tillbaka, och hyran för lokalerna står under finansieringen.',
      ],
      correct: 3,
      why:
        'Av- och nedskrivningarna läggs tillbaka i den löpande verksamheten. Över hälften av dem gäller hyrda lokaler, och hyran ' +
        'för dem syns i stället i finansieringen som amortering av leasingskulder, 12 328 miljoner. Nya lån hör till ' +
        'finansieringen, och betald skatt är redan dragen i den löpande verksamheten.',
    },
    {
      id: 'k2-03-q4',
      text:
        'Atlas Copcos likvida medel var 14 709 miljoner kronor vid början av tredje kvartalet 2026. Periodens kassaflöde var 8 792 miljoner och valutakursdifferenserna 777 miljoner. Hur stora var de likvida medlen vid kvartalets slut?',
      options: ['24 278 miljoner kronor', '23 501 miljoner kronor', '8 792 miljoner kronor', '15 486 miljoner kronor'],
      correct: 0,
      why:
        '14 709 plus 8 792 plus 777 är 24 278 miljoner kronor. Det är samma belopp som de likvida medlen i balansräkningen den ' +
        '30 september 2026, och så ska det vara.',
    },
  ],
};
