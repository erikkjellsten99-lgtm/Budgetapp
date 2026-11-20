// Kurs 1, lektion 5. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Alla skatteuppgifter gäller inkomståret 2026 (deklarationen 2027) om inget annat år nämns.
// Kontrollera Skatteverkets sida och uppdatera siffrorna och datumet när ett nytt inkomstår börjar.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const SKV_ISK: Source = {
  title: 'Investeringssparkonto (ISK), Skatteverket',
  url: 'https://www.skatteverket.se/privat/skatter/vardepapper/investeringssparkontoisk.4.5fc8c94513259a4ba1d800037851.html',
  checked: CHECKED,
};
const SKV_KF: Source = {
  title: 'Svenska kapitalförsäkringar och pensionssparanden, Skatteverket',
  url: 'https://www.skatteverket.se/privat/skatter/forsakringar/svenskakapitalforsakringarochpensionssparanden.4.71004e4c133e23bf6db800024545.html',
  checked: CHECKED,
};
const SKV_ISK_KF: Source = {
  title: 'Vilka är skillnaderna mellan investeringssparkonto och kapitalförsäkring, Skatteverket',
  url: 'https://www.skatteverket.se/privat/etjansterochblanketter/svarpavanligafragor/kapitalforsakringar/kapitalforsakringar/vilkaarskillnadernamellandetvasparformernainvesteringssparkontoochkapitalforsakring.5.71004e4c133e23bf6db80001225.html',
  checked: CHECKED,
};
const SKV_DEKLARERA: Source = {
  title: 'Deklarera aktier och övriga värdepapper, Skatteverket',
  url: 'https://www.skatteverket.se/privat/skatter/vardepapper/deklareraaktierochovrigavardepapper.4.5c281c7015abecc2e201bbd1.html',
  checked: CHECKED,
};
const SKV_EXEMPEL: Source = {
  title: 'Exempel för dig som ska deklarera aktier och övriga värdepapper, Skatteverket',
  url: 'https://www.skatteverket.se/privat/skatter/vardepapper/deklareraaktierochovrigavardepapper/deklareravardepapperexempel.4.7afdf8a313d3421e9a9519.html',
  checked: CHECKED,
};
const KBF_FONDAVGIFTER: Source = {
  title: 'Avgifter i fondsparande, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder/fondavgifter',
  checked: CHECKED,
};
const RG_INVESTERARSKYDD: Source = {
  title: 'Så fungerar investerarskyddet, Riksgälden',
  url: 'https://www.riksgalden.se/var-verksamhet/insattningsgarantin-och-investerarskyddet/sa-fungerar-investerarskyddet/',
  checked: CHECKED,
};
const KBF_JAMFOR: Source = {
  title: 'Jämför ISK och kapitalförsäkringar, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/konsumentstod/jamforelser/sparande--pension/eget-sparande/jamfor-isk-och-kapitalforsakringar',
  checked: CHECKED,
};

export const K1_05: Lesson = {
  id: 'k1-05',
  course: 1,
  number: 5,
  title: 'ISK, kapitalförsäkring och aktie- och fondkonto',
  body: [
    {
      kind: 'p',
      text:
        'Samma aktie kan ligga på tre olika sorters konton: ett vanligt aktie- och fondkonto, ett investeringssparkonto (ISK) ' +
        'eller en kapitalförsäkring. Aktien är densamma. Det som skiljer är hur skatten tas ut, vem som formellt äger ' +
        'värdepapperen och vad du behöver deklarera.',
    },
    {
      kind: 'p',
      text:
        'Skattereglerna ändras. Alla siffror nedan kommer från Skatteverket, kontrollerades 2026-11-20 och gäller inkomståret ' +
        '2026, alltså det du deklarerar våren 2027, om inget annat år står.',
    },
    { kind: 'h', text: 'Aktie- och fondkonto' },
    {
      kind: 'p',
      text:
        'Här beskattas det som faktiskt händer. När du säljer räknar du ut vinsten eller förlusten: vad du fick efter courtage ' +
        'minus omkostnadsbeloppet, alltså vad aktierna kostade inklusive courtage. Har du köpt samma aktie flera gånger används ' +
        'ett genomsnitt av inköpspriserna, det som Skatteverket kallar genomsnittsmetoden.',
    },
    {
      kind: 'p',
      text:
        'Försäljningen redovisas i deklarationen året efter, oftast på blanketten K4. Skatten på överskott av kapital är 30 ' +
        'procent. Förluster kan minska skatten enligt särskilda regler som Skatteverket beskriver. Har du fonder på kontot ' +
        'tillkommer fondskatten från lektion 4: 0,4 procent av värdet vid årets början tas upp som inkomst och beskattas ' +
        'med 30 procent.',
    },
    { kind: 'h', text: 'Investeringssparkonto, ISK' },
    {
      kind: 'p',
      text:
        'På ett ISK deklarerar du inga vinster eller förluster. I stället betalar du en schablonskatt varje år, beräknad på ' +
        'kontots värde, oavsett om det gått upp eller ner. Förluster och avgifter kan inte dras av.',
    },
    {
      kind: 'list',
      items: [
        'Kapitalunderlaget är kontots värde vid början av varje kvartal plus alla insättningar under året, delat med fyra.',
        'Schablonintäkten för 2026 är statslåneräntan den 30 november 2025, som var 2,55 procent, plus en procentenhet: 3,55 procent. Den blir aldrig lägre än 1,25 procent.',
        'Skatten är 30 procent av schablonintäkten. För 2026 blir det 1,065 procent av det kapitalunderlag som ligger över den skattefria grundnivån.',
        'Den skattefria grundnivån är 300 000 kronor från och med 2026, för ISK, kapitalförsäkring och PEPP tillsammans. För 2025 var den 150 000 kronor.',
      ],
    },
    {
      kind: 'p',
      text:
        'På ett ISK får du ha kontanter, fondandelar och värdepapper som handlas på en reglerad marknad någonstans i världen ' +
        'eller på en handelsplattform inom EES, till exempel aktier på Nasdaq Stockholm. Flyttar du aktier från ett vanligt konto till ett ISK räknas det ' +
        'som en försäljning, och vinsten eller förlusten ska deklareras.',
    },
    {
      kind: 'list',
      items: [
        'Ett ISK har bara en ägare, en person eller ett dödsbo. Ett företag kan inte ha ett ISK.',
        'Du får inte ha aktier i ett bolag där du och dina närstående har 10 procent eller mer av rösterna eller kapitalet.',
        'Uttag från kontot beskattas inte.',
        'En flytt mellan två egna ISK ger ingen skatt och räknas inte som en insättning i kapitalunderlaget.',
        'Värdepapperen omfattas av investerarskyddet, högst 250 000 kronor enligt Riksgälden (kontrollerat 2026-11-20), och kontanter på ett ISK i en bank av insättningsgarantin.',
      ],
    },
    { kind: 'h', text: 'Kapitalförsäkring' },
    {
      kind: 'p',
      text:
        'En kapitalförsäkring är ett sparande som alltid har en försäkringsdel. Skatteverket påpekar att det är ' +
        'försäkringsbolaget som äger tillgångarna, medan du själv äger värdepapperen på ett ISK.',
    },
    {
      kind: 'p',
      text:
        'Skatten kallas avkastningsskatt och räknas också på en schablon. Försäkringsbolaget betalar den och drar beloppet från ' +
        'ditt sparande, 1 till 12 gånger om året beroende på bolag, och du behöver inte redovisa underlaget i deklarationen. Den skattefria grundnivån på 300 000 kronor ' +
        'delas med ISK, och sparandet på ISK räknas av först.',
    },
    {
      kind: 'p',
      text:
        'Enligt Konsumenternas jämförelse (kontrollerad 2026-11-20) kan du ange en förmånstagare i en kapitalförsäkring, alltså ' +
        'vem som får pengarna om du dör, men inte i ett ISK. Kapitalförsäkringen omfattas inte av investerarskyddet, men det ' +
        'finns regler om försäkringsbolagens ekonomi. Du kan bara flytta pengar in och ut, inte värdepapper, och ofta finns ' +
        'en bindningstid på 1 till 10 år.',
    },
    { kind: 'h', text: 'Vad avgör skillnaden' },
    {
      kind: 'p',
      text:
        'På ett vanligt konto betalar du skatt på verklig vinst och kan få avdrag för förlust. På ISK och kapitalförsäkring ' +
        'betalar du en schablonskatt på värdet över grundnivån, vare sig du vunnit eller förlorat. Ett bra år blir skatten ' +
        'därför liten i förhållande till vinsten. Ett dåligt år betalar du ändå.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Vilket konto som passar beror på din situation, och lektionen tar inte ' +
        'ställning. Kontrollera alltid de aktuella reglerna hos Skatteverket.',
    },
  ],
  example: {
    title: 'Räkneexempel: schablonskatt på ISK för 2026',
    text:
      'Med Skatteverkets regler för inkomståret 2026, kontrollerade 2026-11-20. Sara har ett ISK och inget annat sådant sparande. ' +
      'Kontot var värt 380 000, 390 000, 400 000 och 410 000 kronor vid början av de fyra kvartalen, och hon satte in 20 000 ' +
      'kronor under året. Summan blir 1 600 000 kronor, och delat med fyra är kapitalunderlaget 400 000 kronor. Schablonintäkten ' +
      'är 3,55 procent, alltså 14 200 kronor. Avdraget för grundnivån är högst 300 000 gånger 3,55 procent, alltså 10 650 kronor. ' +
      'Kvar blir 3 550 kronor, och 30 procent skatt på det är 1 065 kronor. Samma svar får du genom 1,065 procent av de 100 000 ' +
      'kronor som ligger över grundnivån. Hade kapitalunderlaget varit under 300 000 kronor hade skatten blivit noll.',
    source: SKV_ISK,
  },
  key: [
    'På ett aktie- och fondkonto beskattas verklig vinst med 30 procent och du deklarerar varje försäljning.',
    'På ISK är skatten en schablon på värdet, för 2026 1,065 procent av det som ligger över 300 000 kronor, och även kapitalförsäkringen beskattas med en schablon.',
    'På ISK äger du värdepapperen själv, i en kapitalförsäkring äger försäkringsbolaget dem.',
  ],
  terms: [
    { word: 'Aktie- och fondkonto', meaning: 'Ett vanligt konto för värdepapper, där vinster beskattas och varje försäljning deklareras.' },
    { word: 'Omkostnadsbelopp', meaning: 'Vad dina aktier kostade, inklusive courtage, när vinsten räknas ut.' },
    { word: 'Genomsnittsmetoden', meaning: 'Att använda genomsnittligt inköpspris när samma aktie köpts flera gånger.' },
    { word: 'Investeringssparkonto (ISK)', meaning: 'Ett konto där du betalar schablonskatt på värdet i stället för skatt på vinst.' },
    { word: 'Schablonskatt', meaning: 'Skatt som räknas på ett bestämt antagande om avkastning, inte på den verkliga.' },
    { word: 'Kapitalunderlag', meaning: 'Värdet vid varje kvartals början plus årets insättningar, delat med fyra.' },
    { word: 'Statslåneränta', meaning: 'Den ränta Skatteverket utgår från när schablonintäkten räknas ut. För 2026 gäller räntan den 30 november 2025.' },
    { word: 'Schablonintäkt', meaning: 'Den påhittade inkomsten på ISK som skatten tas ut på, för 2026 3,55 procent av kapitalunderlaget.' },
    { word: 'Skattefri grundnivå', meaning: 'Den del av sparandet på ISK och kapitalförsäkring som inte beskattas, 300 000 kronor från 2026.' },
    { word: 'Kapitalförsäkring', meaning: 'En försäkring med sparande i värdepapper, som försäkringsbolaget formellt äger.' },
    { word: 'Avkastningsskatt', meaning: 'Skatten på kapitalförsäkringar, som försäkringsbolaget betalar och drar från sparandet.' },
    { word: 'Förmånstagare', meaning: 'Den som får pengarna i en försäkring om du dör.' },
    { word: 'Investerarskydd', meaning: 'Ersättning från Riksgälden om institutet som förvarar dina värdepapper går i konkurs och du inte får tillbaka dem. Det ersätter inte att värdet sjunker.' },
  ],
  sources: [SKV_ISK, SKV_KF, SKV_ISK_KF, SKV_DEKLARERA, SKV_EXEMPEL, KBF_JAMFOR, KBF_FONDAVGIFTER, RG_INVESTERARSKYDD],
  questions: [
    {
      id: 'k1-05-q1',
      text: 'Ditt ISK sjunker med 15 procent under 2026. Kapitalunderlaget ligger ändå över grundnivån. Hur blir skatten?',
      options: [
        'Ingen skatt, eftersom kontot gick med förlust.',
        'Du får dra av förlusten mot andra vinster.',
        'Skatten blir 30 procent av förlusten, men som avdrag.',
        'Schablonskatt tas ut på kapitalunderlaget över grundnivån, och förlusten kan inte dras av.',
      ],
      correct: 3,
      why:
        'Skatten på ISK räknas på kontots värde, inte på vinsten. Skatteverket skriver att du betalar den oavsett om kontot gått ' +
        'med vinst eller förlust, och förluster får inte dras av.',
    },
    {
      id: 'k1-05-q2',
      text:
        'Ditt kapitalunderlag på ISK för 2026 är 350 000 kronor och du har inget annat sparande på ISK eller i kapitalförsäkring. Vad blir skatten?',
      options: [
        '532,50 kronor, alltså 1,065 procent av de 50 000 kronor som är över grundnivån.',
        '3 727,50 kronor, alltså 1,065 procent av hela beloppet.',
        'Ingenting, eftersom gränsen är 400 000 kronor.',
        '15 000 kronor, alltså 30 procent av 50 000 kronor.',
      ],
      correct: 0,
      why:
        'För 2026 är grundnivån 300 000 kronor. Bara 50 000 kronor ligger över den, och skatten är 1,065 procent av den delen: ' +
        '50 000 gånger 0,01065 är 532,50 kronor.',
    },
    {
      id: 'k1-05-q3',
      text: 'Du flyttar aktier från ditt vanliga aktie- och fondkonto till ett ISK. Vad gäller?',
      options: [
        'Flytten är skattefri, eftersom du äger aktierna hela tiden.',
        'Du betalar courtage men ingen skatt.',
        'Det räknas som en försäljning, och vinsten eller förlusten ska deklareras.',
        'Grundnivån höjs med aktiernas värde.',
      ],
      correct: 2,
      why:
        'Skatteverket räknar en flytt från ett vanligt konto till ett ISK som en försäljning. Vinst eller förlust redovisas ' +
        'i deklarationen året efter, som om du sålt aktierna.',
    },
    {
      id: 'k1-05-q4',
      text: 'Vem äger värdepapperen i en kapitalförsäkring respektive på ett ISK?',
      options: [
        'Du själv i båda fallen.',
        'Försäkringsbolaget i kapitalförsäkringen, du själv på ISK.',
        'Banken i båda fallen.',
        'Du själv i kapitalförsäkringen, banken på ISK.',
      ],
      correct: 1,
      why:
        'Enligt Skatteverket är tillgångarna i en kapitalförsäkring försäkringsbolagets, medan den som har ett ISK äger ' +
        'värdepapperen direkt. Det är en av de viktigaste skillnaderna mellan sparformerna.',
    },
  ],
};
