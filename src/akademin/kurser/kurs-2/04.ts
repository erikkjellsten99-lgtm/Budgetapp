// Kurs 2, lektion 4. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Bolaget i genomgången är påhittat och beloppen är valda för att visa hur räkningen går.
import type { Lesson } from '../../types';
import { ABL, ARL, ATLAS_Q3, HM_AR25 } from './kallor';

export const K2_04: Lesson = {
  id: 'k2-04',
  course: 2,
  number: 4,
  title: 'Så hänger de tre räkningarna ihop',
  body: [
    {
      kind: 'p',
      text:
        'Resultaträkningen, balansräkningen och kassaflödesanalysen beskriver samma bolag från tre håll. Varje affär syns i minst ' +
        'en av dem, ofta i alla tre. Det lättaste sättet att förstå sambanden är att följa några kronor genom räkningarna. Bolaget ' +
        'nedan är påhittat, och beloppen är valda för att räkningen ska bli enkel.',
    },
    { kind: 'h', text: 'En försäljning på faktura' },
    {
      kind: 'p',
      text:
        'Bolaget säljer varor för 1 000 kronor på faktura. Varorna kostade 600 kronor och låg i lagret. I resultaträkningen syns ' +
        'en nettoomsättning på 1 000 och en kostnad för sålda varor på 600, alltså ett bruttoresultat på 400. I balansräkningen ' +
        'minskar varulagret med 600 och kundfordringarna ökar med 1 000. I kassaflödesanalysen händer ingenting ännu, eftersom ' +
        'inga pengar har kommit in.',
    },
    {
      kind: 'p',
      text:
        'När kunden betalar minskar kundfordringarna med 1 000 och pengarna på banken ökar med 1 000. Nu syns pengarna i den ' +
        'löpande verksamheten i kassaflödesanalysen. Resultaträkningen påverkas inte en gång till, eftersom intäkten redan är ' +
        'räknad.',
    },
    { kind: 'h', text: 'Ett maskinköp' },
    {
      kind: 'p',
      text:
        'Bolaget köper en maskin för 5 000 kronor och betalar direkt. Maskinen ska användas i fem år. I kassaflödesanalysen syns ' +
        'minus 5 000 i investeringsverksamheten. I balansräkningen ökar maskinerna med 5 000 och pengarna minskar med lika mycket. ' +
        'I resultaträkningen syns bara avskrivningen, och skrivs maskinen av med lika mycket varje år blir det 1 000 kronor per år. ' +
        'Samtidigt minskar maskinens värde i balansräkningen med 1 000 varje år.',
    },
    { kind: 'h', text: 'Ett lån' },
    {
      kind: 'p',
      text:
        'Bolaget lånar 2 000 kronor av banken. I kassaflödesanalysen syns plus 2 000 i finansieringsverksamheten. I ' +
        'balansräkningen ökar både pengarna och skulderna med 2 000. Själva lånet syns inte i resultaträkningen. Det gör däremot ' +
        'räntan, som en kostnad i finansnettot. När bolaget amorterar minskar skulden och pengarna, och amorteringen syns i ' +
        'finansieringsverksamheten.',
    },
    { kind: 'h', text: 'En utdelning' },
    {
      kind: 'p',
      text:
        'Bolaget delar ut 300 kronor till ägarna. I kassaflödesanalysen syns minus 300 i finansieringsverksamheten. I ' +
        'balansräkningen minskar pengarna och det egna kapitalet med 300 vardera. I resultaträkningen syns ingenting. Utdelningen ' +
        'är ingen kostnad för att driva verksamheten. Aktiebolagslagen räknar vinstutdelning som en värdeöverföring från bolaget ' +
        'till ägarna.',
    },
    { kind: 'h', text: 'Länkarna mellan räkningarna' },
    {
      kind: 'list',
      items: [
        'Periodens resultat från resultaträkningen hamnar i det egna kapitalet. Årets resultat är en egen post där i lagens uppställning.',
        'De likvida medlen vid periodens slut i kassaflödesanalysen är samma belopp som i balansräkningen.',
        'Förändringarna i lager, kundfordringar och leverantörsskulder i balansräkningen förklarar en stor del av skillnaden mellan resultat och kassaflöde.',
        'Avskrivningarna minskar både resultatet och tillgångarnas värde, men inte pengarna.',
        'Nya lån och amorteringar i finansieringsverksamheten ökar eller minskar skulderna i balansräkningen.',
      ],
    },
    {
      kind: 'p',
      text:
        'Du kan pröva länken själv. Atlas Copcos likvida medel på 24 278 miljoner kronor står både sist i kassaflödesanalysen för ' +
        'tredje kvartalet 2026 och i balansräkningen den 30 september 2026.',
    },
    { kind: 'h', text: 'Rörelsekapital' },
    {
      kind: 'p',
      text:
        'Pengar som ligger i lager och kundfordringar är bundna i verksamheten. Pengar som bolaget ännu inte har betalat till sina ' +
        'leverantörer är en sorts lån från dem. H&M definierar ett mått på det som kundfordringar plus varulager minus ' +
        'leverantörsskulder. Den 30 november 2025 var det 6 411 plus 35 427 minus 20 826, alltså 21 012 miljoner kronor.',
    },
    {
      kind: 'p',
      text:
        'När rörelsekapitalet ökar binds mer pengar, och kassaflödet blir lägre än resultatet. När det minskar frigörs pengar. ' +
        'Atlas Copco skriver att rörelsekapitalet ökade med 87 miljoner kronor under tredje kvartalet 2026, på grund av större ' +
        'lager och kundfordringar, delvis motverkat av högre skulder. I kassaflödesanalysen syns det som minus 87.',
    },
    {
      kind: 'p',
      text:
        'Över årets första nio månader band Atlas Copco 2 984 miljoner kronor i rörelsekapital, medan samma period 2025 frigjorde ' +
        '969 miljoner. Kassaflödet från den löpande verksamheten blev därför 23 754 miljoner, något lägre än året före då det var ' +
        '24 173 miljoner, trots att rörelseresultatet ökade från 25 644 till 27 460 miljoner.',
    },
    {
      kind: 'p',
      text:
        'Om ett bolag växer och därför bygger upp mer lager och får fler obetalda fakturor, kan kassaflödet bli svagt trots god ' +
        'vinst. Det behöver inte vara fel, men det är värt att förstå varför.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig hur räkningarna hänger ihop, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'H&M:s rörelsekapital, räkenskapsåren 2024 och 2025',
    text:
      'H&M räknar kundfordringar plus varulager minus leverantörsskulder. Den 30 november 2024 var det 5 631 plus 40 348 minus ' +
      '24 417, alltså 21 562 miljoner kronor. Ett år senare var det 21 012 miljoner. Bolaget skriver att minskningen främst beror ' +
      'på att lagret användes effektivare: varulagret minskade från 40 348 till 35 427 miljoner. I kassaflödesanalysen för 2025 ' +
      'gav det mindre lagret 3 785 miljoner kronor i den löpande verksamheten.',
    source: HM_AR25,
  },
  key: [
    'Varje affär syns i en eller flera av räkningarna, och följer du en krona ser du hur de hänger ihop.',
    'Periodens resultat hamnar i det egna kapitalet, och de likvida medlen i kassaflödesanalysen är desamma som i balansräkningen.',
    'Rörelsekapital är pengar bundna i lager och kundfordringar minus leverantörsskulder, och ökar det minskar kassaflödet.',
  ],
  terms: [
    { word: 'Rörelsekapital', meaning: 'Pengar som är bundna i den dagliga verksamheten. H&M räknar kundfordringar plus varulager minus leverantörsskulder.' },
    { word: 'Faktura', meaning: 'En räkning till kunden, som betalas senare. Tills dess är beloppet en kundfordran.' },
    { word: 'Värdeöverföring', meaning: 'Aktiebolagslagens ord för när värde förs från bolaget till ägarna, till exempel genom vinstutdelning.' },
  ],
  sources: [ARL, ABL, ATLAS_Q3, HM_AR25],
  questions: [
    {
      id: 'k2-04-q1',
      text:
        'Ett bolag säljer varor för 1 000 kronor på faktura. Varorna kostade 600 kronor och låg i lagret. Vad syns i kassaflödesanalysen innan kunden har betalat?',
      options: [
        'Plus 1 000 kronor i den löpande verksamheten.',
        'Plus 400 kronor i den löpande verksamheten.',
        'Ingenting från själva försäljningen, eftersom inga pengar har kommit in.',
        'Minus 600 kronor i investeringsverksamheten.',
      ],
      correct: 2,
      why:
        'Försäljningen syns direkt i resultaträkningen och som en kundfordran i balansräkningen. Pengarna, och därmed ' +
        'kassaflödet, kommer först när kunden betalar.',
    },
    {
      id: 'k2-04-q2',
      text:
        'Ett bolag köper en maskin för 5 000 kronor kontant. Den ska användas i fem år och skrivs av med lika mycket varje år. Hur påverkas resultaträkningen det första året?',
      options: [
        'En avskrivning på 1 000 kronor.',
        'En kostnad på 5 000 kronor.',
        'Ingenting, eftersom maskinen är en tillgång.',
        'En intäkt på 5 000 kronor.',
      ],
      correct: 0,
      why:
        'Utgiften fördelas över fem år: 5 000 delat med 5 är 1 000 kronor per år. Hela betalningen på 5 000 syns i stället i ' +
        'investeringsverksamheten i kassaflödesanalysen.',
    },
    {
      id: 'k2-04-q3',
      text: 'Ett bolag betalar ut 300 kronor i utdelning. Vad händer i räkningarna?',
      options: [
        'Resultaträkningen får en kostnad på 300 kronor.',
        'Pengarna och det egna kapitalet minskar med 300 kronor vardera, och kassaflödet från finansieringen blir minus 300.',
        'Skulderna ökar med 300 kronor, och pengarna är oförändrade.',
        'Den löpande verksamheten i kassaflödesanalysen minskar med 300 kronor.',
      ],
      correct: 1,
      why:
        'Utdelning är ingen rörelsekostnad utan pengar till ägarna. Den minskar pengarna och det egna kapitalet i ' +
        'balansräkningen och syns i finansieringsverksamheten.',
    },
    {
      id: 'k2-04-q4',
      text:
        'Ett bolag har kundfordringar på 200 miljoner kronor, varulager på 500 miljoner och leverantörsskulder på 300 miljoner. Hur stort är rörelsekapitalet med H&M:s definition?',
      options: ['1 000 miljoner kronor', '700 miljoner kronor', 'Minus 600 miljoner kronor', '400 miljoner kronor'],
      correct: 3,
      why:
        'Kundfordringar plus varulager minus leverantörsskulder: 200 plus 500 minus 300 är 400 miljoner kronor. ' +
        'Leverantörsskulderna dras av, eftersom de är pengar bolaget ännu inte har betalat.',
    },
  ],
};
