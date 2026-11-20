// Kurs 2, lektion 1. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson } from '../../types';
import { ARL, ATLAS_DEF, ATLAS_Q3, HM_FY25 } from './kallor';

export const K2_01: Lesson = {
  id: 'k2-01',
  course: 2,
  number: 1,
  title: 'Resultaträkningen: från omsättning till vinst',
  body: [
    {
      kind: 'p',
      text:
        'I förra kursen såg du omsättning och rörelseresultat i en rapport. Nu går vi igenom hela resultaträkningen, rad för ' +
        'rad. Den visar bolagets intäkter och kostnader under en period, till exempel ett kvartal eller ett år, och vad som ' +
        'blev kvar när alla kostnader var dragna.',
    },
    { kind: 'h', text: 'Vad lagen säger' },
    {
      kind: 'p',
      text:
        'Årsredovisningslagen säger att resultaträkningen i sammandrag ska visa företagets alla intäkter och kostnader under ' +
        'räkenskapsåret. Lagen har två uppställningsformer. I den ena delas kostnaderna upp efter slag, till exempel ' +
        'personalkostnader, råvaror och avskrivningar. I den andra delas de upp efter funktion, alltså efter vad pengarna ' +
        'användes till: att tillverka det som såldes, att sälja och att administrera. Både Atlas Copco och H&M ställer upp sina ' +
        'resultaträkningar efter funktion.',
    },
    { kind: 'h', text: 'Raderna uppifrån och ned' },
    {
      kind: 'list',
      items: [
        'Nettoomsättning, i Atlas Copcos rapport kallad intäkter: det bolaget har sålt för under perioden.',
        'Kostnad för sålda varor: vad det kostade att ta fram det som såldes.',
        'Bruttoresultat: nettoomsättningen minus kostnaden för sålda varor.',
        'Rörelsekostnader: kostnader för försäljning och administration, och i vissa bolag för forskning och utveckling.',
        'Rörelseresultat: bruttoresultatet minus rörelsekostnaderna, med övriga rörelseintäkter och rörelsekostnader inräknade.',
        'Finansnetto: ränteintäkter minus räntekostnader och andra finansiella poster.',
        'Resultat före skatt: rörelseresultatet plus finansnettot.',
        'Skatt: periodens inkomstskatt.',
        'Periodens resultat: det som blir kvar efter skatt.',
      ],
    },
    {
      kind: 'p',
      text:
        'I rapporterna står kostnaderna ofta med minustecken. Du räknar uppifrån och ned, och varje summa bygger på raderna ' +
        'ovanför. Ett bra sätt att lära sig raderna är att själv kontrollera att summorna går ihop.',
    },
    {
      kind: 'p',
      text:
        'H&M:s resultaträkning för räkenskapsåret 2025 har nästan samma rader. Nettoomsättningen var 228 285 miljoner kronor och ' +
        'kostnaden för sålda varor 106 464 miljoner. Försäljningskostnaderna var 93 023 miljoner och administrationskostnaderna ' +
        '10 269 miljoner. Någon egen rad för forskning och utveckling finns inte. I stället för ett finansnetto visar H&M ' +
        'ränteintäkter på 460 miljoner och räntekostnader på 2 653 miljoner var för sig. Resultatet efter finansiella poster blev ' +
        '16 202 miljoner och periodens resultat 12 085 miljoner.',
    },
    {
      kind: 'p',
      text:
        'Längst ned står resultat per aktie, som du mötte i förra kursen. Atlas Copco delar den del av resultatet som tillhör ' +
        'moderbolagets ägare med det genomsnittliga antalet aktier. Under tredje kvartalet 2026 var det 7 717 miljoner kronor ' +
        'delat med 4 879,9 miljoner aktier, alltså 1,58 kronor per aktie.',
    },
    { kind: 'h', text: 'Avskrivningar' },
    {
      kind: 'p',
      text:
        'En maskin eller en byggnad används i många år. Därför tas inte hela utgiften som kostnad det år den köps. Enligt ' +
        'årsredovisningslagen ska en anläggningstillgång med begränsad nyttjandeperiod skrivas av systematiskt över den ' +
        'perioden. Avskrivningen är den del av utgiften som räknas som kostnad varje år. Köper ett bolag en maskin för ' +
        '1 000 000 kronor som ska användas i fem år, och skriver av lika mycket varje år, blir avskrivningen 200 000 kronor per år.',
    },
    {
      kind: 'p',
      text:
        'I en resultaträkning efter funktion ligger avskrivningarna inne i de andra raderna. Atlas Copco visar dem i en egen ' +
        'tabell vid kassaflödesanalysen, och H&M hänvisar till en not. Under tredje kvartalet 2026 var Atlas Copcos av- och ' +
        'nedskrivningar 2 634 miljoner kronor.',
    },
    { kind: 'h', text: 'Intäkten räknas när den är intjänad' },
    {
      kind: 'p',
      text:
        'En intäkt räknas när den är intjänad, inte när pengarna kommer. Lagen säger att intäkter och kostnader som hör till ' +
        'räkenskapsåret ska tas med oavsett när de betalas. Säljer ett bolag en vara i december 2025 och får betalt i februari ' +
        '2026, så hör intäkten till 2025 om räkenskapsåret är ett kalenderår. Att fördela intäkter och kostnader på rätt period ' +
        'kallas periodisering.',
    },
    {
      kind: 'p',
      text:
        'Därför kan resultaträkningen visa vinst samtidigt som pengarna på banken minskar. Hur pengarna faktiskt rörde sig visar ' +
        'kassaflödesanalysen, som är ämnet för lektion 3.',
    },
    { kind: 'h', text: 'Så läser du den själv' },
    {
      kind: 'list',
      items: [
        'Börja med nettoomsättningen och jämför med samma period året före.',
        'Räkna bruttoresultatet i procent av nettoomsättningen. Hur mycket blir kvar när kostnaden för de sålda varorna är dragen?',
        'Se vilka rörelsekostnader som växer snabbast, och jämför med hur försäljningen växer.',
        'Jämför finansnettot med rörelseresultatet. Ett stort negativt finansnetto betyder att räntor och andra finansiella poster tar en stor del av rörelseresultatet.',
        'Titta på skatten och periodens resultat sist, när du vet varifrån resultatet kommer.',
      ],
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig läsa en resultaträkning, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'Atlas Copco, tredje kvartalet 2026',
    text:
      'Alla belopp i miljoner kronor, för juli till september 2026. Intäkterna var 47 920 och kostnad för sålda varor 27 749, så ' +
      'bruttoresultatet blev 20 171. Sedan drogs marknadsföringskostnader på 5 428, administrationskostnader på 2 891 och ' +
      'forsknings- och utvecklingskostnader på 1 872 av, och övriga rörelseintäkter och rörelsekostnader var netto minus 30. ' +
      'Rörelseresultatet blev 9 950. Finansnettot var minus 161, så resultatet före skatt blev 9 789. Inkomstskatten var 2 053, ' +
      'och periodens resultat blev 7 736. Rapporten anger den effektiva skattesatsen till 21,0 procent.',
    source: ATLAS_Q3,
  },
  key: [
    'Resultaträkningen går från nettoomsättning via bruttoresultat, rörelseresultat och finansnetto till periodens resultat.',
    'Avskrivningar fördelar utgiften för en maskin eller byggnad över de år den används.',
    'En intäkt räknas när den är intjänad, inte när pengarna kommer, och därför är vinst inte samma sak som pengar.',
  ],
  terms: [
    { word: 'Resultaträkning', meaning: 'Uppställningen av bolagets intäkter och kostnader under en period och vad som blev kvar.' },
    { word: 'Nettoomsättning', meaning: 'Det bolaget har sålt för under perioden. Atlas Copco kallar raden intäkter.' },
    { word: 'Kostnad för sålda varor', meaning: 'Vad det kostade att ta fram det som såldes under perioden.' },
    { word: 'Bruttoresultat', meaning: 'Nettoomsättningen minus kostnaden för sålda varor.' },
    { word: 'Rörelsekostnader', meaning: 'Kostnader för till exempel försäljning, administration och forskning och utveckling.' },
    { word: 'Finansnetto', meaning: 'Ränteintäkter minus räntekostnader och andra finansiella poster.' },
    { word: 'Resultat före skatt', meaning: 'Rörelseresultatet plus finansnettot.' },
    { word: 'Periodens resultat', meaning: 'Det som blir kvar efter skatt, bolagets vinst eller förlust för perioden.' },
    { word: 'Uppställningsform', meaning: 'Den ordning och de rader som lagen anger för resultaträkningen och balansräkningen.' },
    { word: 'Avskrivning', meaning: 'Den del av utgiften för en tillgång som räknas som kostnad varje år under nyttjandeperioden.' },
    { word: 'Nyttjandeperiod', meaning: 'Den tid som en tillgång väntas användas i verksamheten.' },
    { word: 'Periodisering', meaning: 'Att intäkter och kostnader förs till den period de hör till, oavsett när de betalas.' },
  ],
  sources: [ARL, ATLAS_Q3, ATLAS_DEF, HM_FY25],
  questions: [
    {
      id: 'k2-01-q1',
      text:
        'Ett bolag har en nettoomsättning på 500 miljoner kronor, kostnad för sålda varor på 300 miljoner och rörelsekostnader på 120 miljoner. Vad blir rörelseresultatet?',
      options: ['200 miljoner kronor', '80 miljoner kronor', '380 miljoner kronor', '180 miljoner kronor'],
      correct: 1,
      why:
        'Först bruttoresultatet: 500 minus 300 är 200. Sedan dras rörelsekostnaderna av: 200 minus 120 är 80 miljoner kronor. ' +
        'Svaret 200 är bruttoresultatet, inte rörelseresultatet.',
    },
    {
      id: 'k2-01-q2',
      text:
        'Ett bolag med kalenderår som räkenskapsår säljer och levererar en vara i december 2025. Kunden betalar i februari 2026. Vilket år räknas intäkten?',
      options: [
        '2026, eftersom det är då pengarna kommer.',
        'Hälften 2025 och hälften 2026.',
        'Inget år förrän hela beloppet är betalt och kontrollerat.',
        '2025, eftersom det är då försäljningen gjordes.',
      ],
      correct: 3,
      why:
        'Enligt årsredovisningslagen tas intäkter och kostnader som hör till räkenskapsåret med oavsett när de betalas. ' +
        'Försäljningen gjordes 2025, så intäkten hör dit, och fordran på kunden ligger kvar tills den betalas.',
    },
    {
      id: 'k2-01-q3',
      text: 'Ett bolag köper en maskin som ska användas i tio år. Varför tas inte hela utgiften som kostnad samma år?',
      options: [
        'Utgiften fördelas som avskrivningar över de år maskinen används.',
        'Maskiner räknas aldrig som en kostnad i resultaträkningen.',
        'Bolaget får fritt välja vilket år hela kostnaden ska tas.',
        'Kostnaden tas först när maskinen är utsliten och skrotas.',
      ],
      correct: 0,
      why:
        'En anläggningstillgång med begränsad nyttjandeperiod ska enligt lagen skrivas av systematiskt över den perioden. ' +
        'Kostnaden hamnar alltså i resultaträkningen lite i taget, år för år.',
    },
    {
      id: 'k2-01-q4',
      text:
        'Atlas Copcos rörelseresultat under tredje kvartalet 2026 var 9 950 miljoner kronor, finansnettot minus 161 miljoner och skatten 2 053 miljoner. Vad blev periodens resultat?',
      options: ['9 789 miljoner kronor', '7 897 miljoner kronor', '7 736 miljoner kronor', '8 058 miljoner kronor'],
      correct: 2,
      why:
        'Resultat före skatt är 9 950 minus 161, alltså 9 789. Efter skatten på 2 053 blir det 7 736 miljoner kronor, ' +
        'samma siffra som rapporten anger som periodens resultat.',
    },
  ],
};
