// Kurs 2, lektion 2. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson } from '../../types';
import { ABL, ARL, ATLAS_Q3, HM_FY25, VOLVO_Q4 } from './kallor';

export const K2_02: Lesson = {
  id: 'k2-02',
  course: 2,
  number: 2,
  title: 'Balansräkningen: vad bolaget äger och är skyldigt',
  body: [
    {
      kind: 'p',
      text:
        'Resultaträkningen beskriver en period. Balansräkningen beskriver ett ögonblick: vad bolaget äger och vad det är skyldigt ' +
        'en viss dag, balansdagen. Enligt årsredovisningslagen ska den i sammandrag visa alla tillgångar, avsättningar, skulder och ' +
        'eget kapital på balansdagen. Det är alltså en ögonblicksbild, inte en film.',
    },
    { kind: 'h', text: 'Två sidor som alltid är lika stora' },
    {
      kind: 'p',
      text:
        'Ena sidan visar tillgångarna. Andra sidan visar hur de är finansierade: med ägarnas pengar, som kallas eget kapital, eller ' +
        'med andras pengar, alltså skulder och avsättningar. Därför är summorna alltid lika stora. Tillgångarna är lika med eget ' +
        'kapital plus skulder, om avsättningarna räknas till skulderna. Vänder du på det får du eget kapital: tillgångarna minus ' +
        'skulderna.',
    },
    { kind: 'h', text: 'Tillgångar' },
    {
      kind: 'p',
      text:
        'Lagen delar tillgångarna i anläggningstillgångar och omsättningstillgångar. En anläggningstillgång är avsedd att ' +
        'stadigvarande användas eller ägas i verksamheten. Allt annat är omsättningstillgångar, till exempel varulager, ' +
        'kundfordringar och kassa och bank. Kundfordringar är pengar som kunderna ännu inte har betalat för det de har köpt.',
    },
    {
      kind: 'list',
      items: [
        'Immateriella anläggningstillgångar går inte att ta på, till exempel patent, varumärken och goodwill.',
        'Materiella anläggningstillgångar är till exempel byggnader, mark, maskiner och inventarier.',
        'Finansiella anläggningstillgångar är till exempel andelar i andra företag och långfristiga fordringar.',
      ],
    },
    {
      kind: 'p',
      text:
        'Goodwill uppstår när ett bolag köper en verksamhet och betalar mer än värdet av de tillgångar det får minus de skulder det ' +
        'tar över. Skillnaden tas upp som en tillgång. Volvokoncernen hade goodwill på 23 659 miljoner kronor den 31 december 2025. ' +
        'Ett bolag som har köpt många andra bolag kan alltså ha stora tillgångar som inte går att ta på.',
    },
    { kind: 'h', text: 'Eget kapital, avsättningar och skulder' },
    {
      kind: 'p',
      text:
        'Eget kapital är ägarnas del. I lagens uppställning för aktiebolag ingår bland annat aktiekapital, balanserad vinst eller ' +
        'förlust och årets resultat. Vinst som inte delas ut stannar alltså i bolaget och ökar det egna kapitalet.',
    },
    {
      kind: 'p',
      text:
        'Lagen kräver också att ett aktiebolag delar upp det egna kapitalet i bundet och fritt eget kapital. Uppdelningen spelar ' +
        'roll för utdelningar. Enligt aktiebolagslagen får bolaget inte föra över värde till ägarna, till exempel som utdelning, ' +
        'om det bundna egna kapitalet inte längre är fullt täckt efteråt.',
    },
    {
      kind: 'p',
      text:
        'Avsättningar är förpliktelser som är säkra eller sannolika men där beloppet eller tidpunkten är oviss. Ett exempel i ' +
        'lagens uppställning är avsättningar för pensioner. Skulder är till exempel obligationslån, skulder till banker och ' +
        'leverantörsskulder, alltså obetalda fakturor från leverantörer.',
    },
    {
      kind: 'p',
      text:
        'I rapporterna delas skulderna i kortfristiga och långfristiga. Lagen kräver att bolaget för varje skuldpost anger den del ' +
        'som ska betalas inom ett år från balansdagen och den del som ska betalas senare. Det hjälper dig att se hur mycket som ' +
        'snart ska betalas.',
    },
    { kind: 'h', text: 'Atlas Copco den 30 september 2026' },
    {
      kind: 'p',
      text:
        'Atlas Copcos anläggningstillgångar var 124 678 miljoner kronor och omsättningstillgångarna 110 326 miljoner, sammanlagt ' +
        '235 004 miljoner. På andra sidan stod eget kapital på 118 930 miljoner, långfristiga skulder på 39 429 miljoner och ' +
        'kortfristiga skulder på 76 645 miljoner, också sammanlagt 235 004 miljoner. Av tillgångarna var 82 080 miljoner ' +
        'immateriella, ungefär 35 procent.',
    },
    {
      kind: 'p',
      text:
        'Hos H&M var de immateriella tillgångarna 7 747 miljoner kronor den 30 november 2025, under 5 procent av tillgångarna. ' +
        'Atlas Copcos rapport för tredje kvartalet 2026 räknar upp flera bolag som köptes under kvartalet, och ett köpt bolag kan ge ' +
        'goodwill och andra immateriella tillgångar. Olika verksamheter ger alltså olika balansräkningar.',
    },
    {
      kind: 'p',
      text:
        'Siffrorna gäller bara balansdagen. Atlas Copcos likvida medel var 24 278 miljoner kronor den 30 september 2026 men 15 523 ' +
        'miljoner den 31 december 2025. Jämför därför helst med samma dag året före, som rapporten också visar.',
    },
    { kind: 'h', text: 'Frågor att ställa till en balansräkning' },
    {
      kind: 'list',
      items: [
        'Hur stor del av tillgångarna är immateriella, och hur mycket av det är goodwill?',
        'Hur stora är varulagret och kundfordringarna, och hur har de ändrats sedan året före?',
        'Hur mycket av skulderna ska betalas inom ett år, och hur mycket likvida medel finns?',
        'Hur stort är det egna kapitalet jämfört med de totala tillgångarna? Det kommer tillbaka i lektion 6.',
      ],
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig läsa en balansräkning, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'H&M den 30 november 2025',
    text:
      'H&M:s räkenskapsår slutar den 30 november. Den dagen 2025 hade koncernen tillgångar på 170 273 miljoner kronor: ' +
      'anläggningstillgångar på 97 778 miljoner och omsättningstillgångar på 72 495 miljoner. Varulagret var 35 427 miljoner, ' +
      'ungefär 21 procent av alla tillgångar, och nyttjanderättstillgångarna, alltså rätten att använda sådant bolaget hyr, ' +
      'var 52 094 miljoner. Goodwill var 1 013 miljoner. På andra sidan stod eget kapital på 42 947 miljoner, långfristiga ' +
      'skulder på 65 723 miljoner och kortfristiga skulder på 61 603 miljoner, sammanlagt 170 273 miljoner. Ett handelsbolag ' +
      'har alltså andra stora poster än ett industribolag som Atlas Copco.',
    source: HM_FY25,
  },
  key: [
    'Balansräkningen är en ögonblicksbild av tillgångar, eget kapital och skulder en viss dag, balansdagen.',
    'Tillgångarna är lika med eget kapital plus skulder, och eget kapital är tillgångarna minus skulderna.',
    'Anläggningstillgångar används stadigvarande, och skulderna delas efter om de ska betalas inom ett år eller senare.',
  ],
  terms: [
    { word: 'Balansräkning', meaning: 'Uppställningen av bolagets tillgångar, eget kapital, avsättningar och skulder på balansdagen.' },
    { word: 'Balansdag', meaning: 'Den dag som balansräkningen gäller, till exempel räkenskapsårets sista dag.' },
    { word: 'Tillgång', meaning: 'Något bolaget äger eller har rätt till, till exempel maskiner, varor eller pengar.' },
    { word: 'Eget kapital', meaning: 'Ägarnas del av bolaget: tillgångarna minus skulderna och avsättningarna.' },
    { word: 'Skuld', meaning: 'Det bolaget är skyldigt andra, till exempel lån och obetalda fakturor.' },
    { word: 'Avsättning', meaning: 'En säker eller sannolik förpliktelse där beloppet eller tidpunkten är oviss, till exempel framtida pensioner.' },
    { word: 'Anläggningstillgång', meaning: 'En tillgång som är avsedd att stadigvarande användas eller ägas i verksamheten.' },
    { word: 'Omsättningstillgång', meaning: 'En tillgång som inte är en anläggningstillgång, till exempel varulager, kundfordringar och kassa.' },
    { word: 'Immateriell tillgång', meaning: 'En tillgång som inte går att ta på, till exempel patent, varumärken och goodwill.' },
    { word: 'Goodwill', meaning: 'Det belopp som ett köpt företag kostade utöver värdet av dess tillgångar minus skulder.' },
    { word: 'Varulager', meaning: 'Varor som bolaget har på lager för att sälja eller använda i tillverkningen.' },
    { word: 'Kundfordran', meaning: 'Pengar som en kund ännu inte har betalat för något bolaget har sålt.' },
    { word: 'Leverantörsskuld', meaning: 'En obetald faktura från en leverantör.' },
    { word: 'Kortfristig och långfristig skuld', meaning: 'Skuld som ska betalas inom ett år från balansdagen respektive senare.' },
    { word: 'Bundet och fritt eget kapital', meaning: 'Lagens uppdelning av ett aktiebolags egna kapital. Det bundna ska vara fullt täckt efter en utdelning.' },
    { word: 'Likvida medel', meaning: 'Bolagets pengar i kassa och på bank och liknande. Lagens uppställning kallar posten kassa och bank.' },
    { word: 'Nyttjanderättstillgång', meaning: 'Rätten att använda något som bolaget hyr eller leasar, redovisad som en tillgång.' },
  ],
  sources: [ARL, ABL, ATLAS_Q3, VOLVO_Q4, HM_FY25],
  questions: [
    {
      id: 'k2-02-q1',
      text: 'Ett bolag har tillgångar på 800 miljoner kronor och skulder och avsättningar på 500 miljoner. Hur stort är det egna kapitalet?',
      options: ['1 300 miljoner kronor', '500 miljoner kronor', '300 miljoner kronor', '62,5 procent'],
      correct: 2,
      why:
        'Eget kapital är tillgångarna minus skulderna och avsättningarna: 800 minus 500 är 300 miljoner kronor. Balansräkningens ' +
        'två sidor blir då lika stora, 800 mot 300 plus 500.',
    },
    {
      id: 'k2-02-q2',
      text: 'Varför säger man att balansräkningen är en ögonblicksbild?',
      options: [
        'Den visar ställningen en viss dag, balansdagen, och kan se annorlunda ut en annan dag.',
        'Den visar bara de affärer som gjordes på årets sista dag.',
        'Den görs om varje dag och publiceras dagligen av bolaget.',
        'Den visar intäkter och kostnader under hela året.',
      ],
      correct: 0,
      why:
        'Lagen säger att balansräkningen ska visa tillgångar, skulder och eget kapital på balansdagen. Atlas Copcos likvida medel ' +
        'var till exempel 24 278 miljoner den 30 september 2026 men 15 523 miljoner den 31 december 2025.',
    },
    {
      id: 'k2-02-q3',
      text: 'Ett bolag köper ett annat bolag för 1 000 miljoner kronor. Det köpta bolagets tillgångar minus skulder är värda 700 miljoner. Hur stor goodwill uppstår?',
      options: ['1 000 miljoner kronor', '300 miljoner kronor', '700 miljoner kronor', '1 700 miljoner kronor'],
      correct: 1,
      why:
        'Goodwill är det som betalades utöver värdet av tillgångarna minus skulderna: 1 000 minus 700 är 300 miljoner kronor. ' +
        'Den tas upp som en immateriell tillgång i köparens balansräkning.',
    },
    {
      id: 'k2-02-q4',
      text: 'Vilken av de här är en omsättningstillgång?',
      options: [
        'En fabriksbyggnad som bolaget använder i tillverkningen.',
        'Ett patent som bolaget räknar med att använda i många år.',
        'Ett obligationslån som ska betalas tillbaka om fem år.',
        'Varor på lager som bolaget räknar med att sälja.',
      ],
      correct: 3,
      why:
        'Byggnaden och patentet ska användas stadigvarande och är anläggningstillgångar. Obligationslånet är en skuld, inte en ' +
        'tillgång. Varor som ska säljas är en omsättningstillgång.',
    },
  ],
};
