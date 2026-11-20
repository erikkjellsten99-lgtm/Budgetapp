// Kurs 2, lektion 5. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Procenttalen som inte står i rapporterna är uträknade ur rapporternas egna belopp och avrundade till en decimal.
import type { Lesson } from '../../types';
import { ARL, ATLAS_DEF, ATLAS_Q3, HM_AR25, HM_FY25, VOLVO_Q4 } from './kallor';

export const K2_05: Lesson = {
  id: 'k2-05',
  course: 2,
  number: 5,
  title: 'Marginaler och lönsamhet',
  body: [
    {
      kind: 'p',
      text:
        'En marginal visar hur mycket av varje krona i försäljning som blir kvar på en viss rad i resultaträkningen. Ett ' +
        'avkastningsmått visar hur mycket resultat bolaget får ut av kapitalet det använder. Tillsammans säger de mycket om ' +
        'lönsamheten, men bara om du vet hur de är räknade.',
    },
    { kind: 'h', text: 'Marginalerna' },
    {
      kind: 'list',
      items: [
        'Bruttomarginal: bruttoresultatet i förhållande till nettoomsättningen. Så definierar H&M den.',
        'Rörelsemarginal: rörelseresultatet i procent av intäkterna. Så definierar Atlas Copco den.',
        'Marginal före skatt: resultatet före skatt i procent av intäkterna. Atlas Copco har också det måttet i sin lista över definitioner.',
        'Du kan också räkna periodens resultat efter skatt i procent av omsättningen. Det visar hur mycket som blir kvar när allt är betalt.',
      ],
    },
    {
      kind: 'p',
      text:
        'Atlas Copco har sina definitioner på sidan för investerare och H&M i årsredovisningen. Atlas Copco skriver att flera av ' +
        'måtten inte är definierade i IFRS, de internationella redovisningsreglerna, och att de inte räknas likadant i alla bolag.',
    },
    { kind: 'h', text: 'Tre bolag, tre mönster' },
    {
      kind: 'list',
      items: [
        'Atlas Copco, tredje kvartalet 2026: bruttomarginal 42,1 procent, rörelsemarginal 20,8, före skatt 20,4 och efter skatt 16,1 procent.',
        'H&M, räkenskapsåret 2025: bruttomarginal 53,4 procent, rörelsemarginal 8,1, före skatt 7,1 och efter skatt 5,3 procent.',
        'Volvokoncernen, helåret 2025: bruttomarginal 24,4 procent, rörelsemarginal 10,1, efter finansiella poster 9,9 och efter skatt 7,2 procent.',
      ],
    },
    {
      kind: 'p',
      text:
        'H&M har den högsta bruttomarginalen men den lägsta rörelsemarginalen. Förklaringen syns i resultaträkningen: ' +
        'försäljningskostnaderna var 93 023 miljoner kronor, ungefär 41 procent av nettoomsättningen. De ligger mellan ' +
        'bruttoresultatet och rörelseresultatet. Var en kostnad hamnar beror på verksamheten och på hur bolaget delar upp sina ' +
        'kostnader. Därför säger bruttomarginalen ensam lite när du jämför bolag i olika branscher.',
    },
    {
      kind: 'p',
      text:
        'Marginalerna skiljer sig också inom ett och samma bolag. Under tredje kvartalet 2026 var rörelsemarginalen 23,6 procent ' +
        'i Atlas Copcos affärsområde Kompressorteknik, 22,2 i Vakuumteknik, 18,7 i Industriteknik och 18,3 i Energiteknik. ' +
        'Koncernens siffra är ett genomsnitt av olika verksamheter.',
    },
    {
      kind: 'p',
      text:
        'Perioderna skiljer sig också. Atlas Copcos siffror gäller ett kvartal, H&M:s och Volvos ett helt år. Ingen av siffrorna ' +
        'säger att det ena bolaget är bättre än det andra. De visar att verksamheterna är olika.',
    },
    { kind: 'h', text: 'Avkastning på kapital' },
    {
      kind: 'p',
      text:
        'Marginalerna säger inget om hur mycket kapital som behövs för att tjäna pengarna. Avkastning på eget kapital visar ' +
        'resultatet i förhållande till ägarnas kapital. H&M definierar den som årets resultat i förhållande till genomsnittligt ' +
        'eget kapital: 12 085 delat med 44 579 är 27,1 procent för 2025. Atlas Copco räknar med resultatet som tillhör ' +
        'moderbolagets ägare och anger 25 procent för de tolv månaderna fram till och med tredje kvartalet 2026.',
    },
    {
      kind: 'p',
      text:
        'Avkastning på sysselsatt kapital tar med både ägarnas och långivarnas pengar. H&M räknar resultatet efter finansiella ' +
        'poster plus räntekostnader, delat med genomsnittligt eget kapital plus genomsnittliga räntebärande skulder. För 2025 blev ' +
        'det 18 855 delat med 122 259, alltså 15,4 procent. Atlas Copco räknar sysselsatt kapital som genomsnittliga totala ' +
        'tillgångar minus skulder och avsättningar som inte är räntebärande, och anger 24 procent för samma tolvmånadersperiod som ovan.',
    },
    {
      kind: 'p',
      text:
        'Inom Atlas Copco skiljer sig också avkastningen på sysselsatt kapital mellan affärsområdena. För de tolv månaderna fram ' +
        'till och med tredje kvartalet 2026 var den 72 procent i Kompressorteknik men 13 procent i Energiteknik. Atlas Copco ' +
        'jämför själv sin avkastning med en sammanvägd genomsnittlig kapitalkostnad på 8,0 procent.',
    },
    {
      kind: 'p',
      text:
        'Hos H&M är avkastningen på eget kapital mycket högre än avkastningen på sysselsatt kapital, medan de är nästan lika hos ' +
        'Atlas Copco. Skillnaden hänger ihop med hur stor del av kapitalet som är lånat. Det är ämnet i nästa lektion.',
    },
    { kind: 'h', text: 'Jämför rätt' },
    {
      kind: 'list',
      items: [
        'Jämför ett bolag med sig självt över tid. Lagen kräver att årsredovisningen visar föregående års belopp bredvid årets.',
        'Jämför med bolag som gör liknande saker, och med samma längd på perioden.',
        'Kontrollera att måtten är räknade på samma sätt. Läs bolagets definition.',
        'Fråga varför en marginal ändras: pris, kostnader, försäljningens sammansättning eller valutor.',
      ],
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig räkna och jämföra lönsamhet, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'H&M, marginalerna för räkenskapsåret 2025',
    text:
      'Under räkenskapsåret 1 december 2024 till 30 november 2025 var H&M:s nettoomsättning 228 285 miljoner kronor. ' +
      'Bruttoresultatet var 121 821 miljoner, vilket ger en bruttomarginal på 121 821 delat med 228 285, alltså 53,4 procent. ' +
      'Rörelseresultatet var 18 395 miljoner och rörelsemarginalen 8,1 procent. Resultatet efter finansiella poster var ' +
      '16 202 miljoner, 7,1 procent av nettoomsättningen, och periodens resultat 12 085 miljoner, 5,3 procent. Året före var ' +
      'bruttomarginalen också 53,4 procent och rörelsemarginalen 7,4 procent.',
    source: HM_FY25,
  },
  key: [
    'Bruttomarginal, rörelsemarginal och marginalen före skatt visar hur mycket av försäljningen som blir kvar på olika rader.',
    'Avkastning på eget kapital och på sysselsatt kapital visar hur mycket resultat kapitalet ger, och bolagen räknar dem olika.',
    'Jämför ett bolag med sig självt över tid och med liknande bolag, och läs alltid bolagets definition.',
  ],
  terms: [
    { word: 'Marginal', meaning: 'En resultatrad i procent av omsättningen.' },
    { word: 'Bruttomarginal', meaning: 'Bruttoresultatet i procent av nettoomsättningen.' },
    { word: 'Marginal före skatt', meaning: 'Resultatet före skatt i procent av intäkterna.' },
    { word: 'Nyckeltal', meaning: 'Ett tal som räknas fram ur rapportens siffror för att beskriva till exempel lönsamhet eller skulder.' },
    { word: 'Avkastning på eget kapital', meaning: 'Resultatet i procent av det genomsnittliga egna kapitalet.' },
    { word: 'Sysselsatt kapital', meaning: 'Det kapital som ägare och långivare har satt in. Bolagen räknar det på olika sätt.' },
    { word: 'Avkastning på sysselsatt kapital', meaning: 'Resultatet med räntekostnaderna tillagda, i procent av det sysselsatta kapitalet. Bolagen räknar det olika.' },
    { word: 'Sammanvägd genomsnittlig kapitalkostnad', meaning: 'Ett sammanvägt genomsnitt av vad lån och eget kapital antas kosta. Atlas Copco använder den som jämförelse för avkastningen.' },
    { word: 'Räntebärande skuld', meaning: 'En skuld som bolaget betalar ränta på, till exempel banklån och obligationslån.' },
    { word: 'Lönsamhet', meaning: 'Hur mycket resultat verksamheten ger i förhållande till försäljningen eller till kapitalet.' },
  ],
  sources: [HM_FY25, HM_AR25, ATLAS_Q3, ATLAS_DEF, VOLVO_Q4, ARL],
  questions: [
    {
      id: 'k2-05-q1',
      text:
        'Ett bolag har en nettoomsättning på 400 miljoner kronor och en kostnad för sålda varor på 260 miljoner. Vad är bruttomarginalen?',
      options: ['65 procent', '35 procent', '140 procent', '54 procent'],
      correct: 1,
      why:
        'Bruttoresultatet är 400 minus 260, alltså 140 miljoner. Bruttomarginalen är 140 delat med 400, vilket är 0,35 eller ' +
        '35 procent. 65 procent är kostnadens andel av försäljningen.',
    },
    {
      id: 'k2-05-q2',
      text:
        'H&M hade en bruttomarginal på 53,4 procent för 2025 men en rörelsemarginal på bara 8,1 procent. Vad förklarar skillnaden enligt resultaträkningen?',
      options: [
        'H&M betalade mycket ränta, och räntan dras före rörelseresultatet.',
        'Skatten dras mellan bruttoresultatet och rörelseresultatet.',
        'Rapporten räknar bruttomarginalen på ett annat år än rörelsemarginalen.',
        'Försäljningskostnaderna var stora och ligger mellan bruttoresultatet och rörelseresultatet.',
      ],
      correct: 3,
      why:
        'Försäljningskostnaderna var 93 023 miljoner kronor, ungefär 41 procent av nettoomsättningen. Räntor och skatt kommer ' +
        'först efter rörelseresultatet och påverkar inte rörelsemarginalen.',
    },
    {
      id: 'k2-05-q3',
      text:
        'Ett bolag har ett resultat på 60 miljoner kronor och ett genomsnittligt eget kapital på 400 miljoner. Vad är avkastningen på eget kapital?',
      options: ['15 procent', '6,7 procent', '40 procent', '24 procent'],
      correct: 0,
      why:
        'Avkastning på eget kapital är resultatet i procent av det genomsnittliga egna kapitalet: 60 delat med 400 är 0,15, ' +
        'alltså 15 procent. Det är samma sätt som H&M räknar sin avkastning på eget kapital.',
    },
    {
      id: 'k2-05-q4',
      text: 'Vilken jämförelse säger mest om hur ett bolags lönsamhet har utvecklats?',
      options: [
        'Bolagets bruttomarginal jämförd med ett bolag i en helt annan bransch.',
        'Ett kvartals rörelsemarginal jämförd med ett annat bolags helårsmarginal.',
        'Samma bolags rörelsemarginal, räknad på samma sätt, flera år i rad.',
        'Bolagets marginal jämförd med hur mycket aktiekursen har stigit.',
      ],
      correct: 2,
      why:
        'När bolaget, definitionen och periodens längd är desamma är det verksamheten som har ändrats. Andra branscher har ' +
        'andra kostnader, och olika perioder går inte att jämföra rakt av.',
    },
  ],
};
