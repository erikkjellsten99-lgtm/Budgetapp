// Kurs 1, lektion 6. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Procentsatserna i räkneexemplen är antaganden för att visa hur räkningen går, inte prognoser.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const KBF_VALJA: Source = {
  title: 'Välja typ av investering, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/sa-fungerar-vardepapper/valja-typ-av-investering',
  checked: CHECKED,
};
const KBF_FONDER: Source = {
  title: 'Fonder, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder',
  checked: CHECKED,
};
const KBF_FONDAVGIFTER: Source = {
  title: 'Avgifter i fondsparande, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder/fondavgifter',
  checked: CHECKED,
};
const RB_MATS: Source = {
  title: 'Hur mäts inflation?, Sveriges riksbank',
  url: 'https://www.riksbank.se/sv/penningpolitik/inflationsmalet/hur-mats-inflation/',
  checked: CHECKED,
};
const RB_VAD: Source = {
  title: 'Vad är inflation?, Sveriges riksbank',
  url: 'https://www.riksbank.se/sv/penningpolitik/inflationsmalet/vad-ar-inflation/',
  checked: CHECKED,
};

export const K1_06: Lesson = {
  id: 'k1-06',
  course: 1,
  number: 6,
  title: 'Avkastning, risk och ränta på ränta',
  body: [
    {
      kind: 'p',
      text:
        'Avkastning är det ditt sparande ger. För en aktie är det kursens förändring plus utdelningarna, alltså totalavkastningen ' +
        'från lektion 3. Den brukar anges i procent per år, så att olika sparanden går att jämföra.',
    },
    { kind: 'h', text: 'Ränta på ränta' },
    {
      kind: 'p',
      text:
        'Om du låter avkastningen ligga kvar räknas nästa års avkastning på ett större belopp. Det kallas ränta på ränta, ' +
        'även när det gäller aktier och inte en bankränta. Effekten är liten de första åren och stor efter lång tid.',
    },
    {
      kind: 'p',
      text:
        'Ett räkneexempel, där 6 procent per år bara är ett antagande och inget löfte. Du sätter in 10 000 kronor och låter allt ligga:',
    },
    {
      kind: 'list',
      items: [
        'Efter ett år: 10 600 kronor.',
        'Efter två år: 11 236 kronor, eftersom andra årets 6 procent räknas på 10 600.',
        'Efter tio år: ungefär 17 908 kronor.',
        'Efter tjugo år: ungefär 32 071 kronor.',
      ],
    },
    {
      kind: 'p',
      text:
        'Tar du i stället ut 600 kronor varje år har du efter tio år bara fått 6 000 kronor, totalt 16 000. Skillnaden mot ' +
        '17 908 är avkastning på avkastning. Efter tjugo år har skillnaden vuxit till mer än 10 000 kronor. Tiden är den ' +
        'viktigaste delen av motorn.',
    },
    {
      kind: 'p',
      text:
        'En tumregel för huvudräkning: dela 72 med den årliga avkastningen i procent, så får du ungefär hur många år det tar ' +
        'för pengarna att fördubblas. Med 6 procent blir det 12 år, och 1,06 upphöjt till 12 är mycket riktigt drygt 2.',
    },
    { kind: 'h', text: 'Avgifter går genom samma motor' },
    {
      kind: 'p',
      text:
        'En fondavgift dras från fondens värde, en liten del varje dag, och den avkastning fonden visar är redan efter avgift. ' +
        'Avgiften minskar alltså varje års tillväxt, och det som inte växer ett år kan inte växa nästa år heller.',
    },
    {
      kind: 'p',
      text:
        'Räkna med 5 procent i stället för 6, ungefär som om en procentenhet gick till avgifter. Efter tio år blir 10 000 kronor ' +
        'då ungefär 16 289 kronor i stället för 17 908. Efter tjugo år är det ungefär 26 533 mot 32 071 kronor.',
    },
    { kind: 'h', text: 'Inflationen äter köpkraft' },
    {
      kind: 'p',
      text:
        'Inflation betyder att den allmänna prisnivån stiger, så att samma pengar räcker till färre varor. Riksbankens mål är ' +
        'att inflationen ska vara 2 procent per år, mätt med KPIF, ett konsumentprisindex som SCB räknar fram varje månad. ' +
        'Riksbankens främsta verktyg för att hålla inflationen nära målet är styrräntan.',
    },
    {
      kind: 'p',
      text:
        'Därför är det inte hela avkastningen som gör dig rikare. Den del som är större än inflationen kallas real avkastning. ' +
        'Ger sparandet 3 procent ett år när priserna stiger 2 procent har köpkraften bara ökat ungefär 1 procent.',
    },
    { kind: 'h', text: 'Risk' },
    {
      kind: 'p',
      text:
        'Risk är chansen att det går sämre än du hoppats, i värsta fall att pengarna försvinner. Konsumenternas Bank- och ' +
        'finansbyrå beskriver sambandet så här: högre risk ger större chans att förlora men också chans till högre ' +
        'avkastning, och aktier har normalt högre risk än räntebärande placeringar som obligationer.',
    },
    {
      kind: 'p',
      text:
        'Risk är också hur mycket värdet svänger på vägen. Nedgångar och uppgångar är inte symmetriska. Faller något med ' +
        '30 procent måste det stiga med ungefär 43 procent för att komma tillbaka. Faller det med 50 procent krävs 100 procent.',
    },
    {
      kind: 'p',
      text:
        'Ingen vet vad som händer härnäst. Konjunktur, krig, politiska kriser och valutor gör framtida avkastning osäker, och ' +
        'en fonds tidigare resultat är ingen garanti för framtida.',
    },
    { kind: 'h', text: 'Sprid riskerna' },
    {
      kind: 'p',
      text:
        'Lägg inte alla ägg i samma korg. Har du allt i ett bolag hänger hela sparandet på det. Flera bolag, eller en ' +
        'aktiefond, minskar risken. Räntebärande placeringar vid sidan av aktier minskar den ytterligare, men också chansen ' +
        'till mycket hög avkastning. Spridning jämnar ut risker men skyddar inte mot förluster.',
    },
    {
      kind: 'p',
      text:
        'Fråga dig också hur snabbt något kan bli pengar igen, det som kallas likviditet. Ett hus tar lång tid att sälja, ' +
        'medan mycket handlade aktier på Stockholmsbörsen ofta kan säljas på några minuter. Fråga dig sedan hur länge du ' +
        'klarar dig utan pengarna. Det du kan behöva snart är mer utsatt för en nedgång vid fel ' +
        'tillfälle, eftersom du kanske måste sälja just då.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Siffrorna är räkneexempel och lovar ingen avkastning.',
    },
  ],
  example: {
    title: 'Räkneexempel: tio år med 6 procent och 2 procents inflation',
    text:
      'Antag att 10 000 kronor växer med 6 procent per år i tio år och att inflationen hela tiden ligger på Riksbankens mål, ' +
      '2 procent per år. Beloppet blir ungefär 17 908 kronor. Men priserna har då stigit med ungefär 22 procent, eftersom ' +
      '1,02 upphöjt till 10 är ungefär 1,219. Delar du 17 908 med 1,219 får du ungefär 14 691 kronor i dagens pengar. ' +
      'Av ökningen på 7 908 kronor är alltså bara cirka 4 691 kronor ny köpkraft. Utan någon avkastning alls hade de 10 000 ' +
      'kronorna efter tio år räckt till ungefär lika mycket som 8 203 kronor i dag. Målet på 2 procent är ett mål, ingen prognos.',
    source: RB_MATS,
  },
  key: [
    'Ränta på ränta betyder att avkastningen också ger avkastning, och effekten växer mest med tiden.',
    'Avgifter och inflation drar från tillväxten varje år, så det är avkastningen efter båda som räknas.',
    'Högre möjlig avkastning kommer med högre risk, och spridning minskar risken men skyddar inte mot förluster.',
  ],
  terms: [
    { word: 'Avkastning', meaning: 'Det ett sparande ger, oftast i procent per år.' },
    { word: 'Ränta på ränta', meaning: 'Att avkastningen läggs till sparandet och själv börjar ge avkastning.' },
    { word: 'Inflation', meaning: 'Att den allmänna prisnivån stiger, så att pengar räcker till mindre.' },
    { word: 'KPIF', meaning: 'Konsumentprisindex med fast ränta, måttet Riksbankens inflationsmål gäller.' },
    { word: 'Styrränta', meaning: 'Riksbankens ränta, dess främsta verktyg för att påverka inflationen.' },
    { word: 'Köpkraft', meaning: 'Hur mycket du kan köpa för dina pengar.' },
    { word: 'Real avkastning', meaning: 'Avkastningen efter att inflationen räknats bort.' },
    { word: 'Risk', meaning: 'Chansen att det går sämre än du hoppats, och hur mycket värdet svänger.' },
    { word: 'Räntebärande placering', meaning: 'Sparande som ger ränta, till exempel obligationer.' },
    { word: 'Obligation', meaning: 'Ett lån till en stat eller ett företag som ger ränta.' },
    { word: 'Riskspridning', meaning: 'Att dela upp sparandet så att inte allt beror på samma sak.' },
    { word: 'Likviditet', meaning: 'Hur snabbt något kan säljas och bli pengar.' },
  ],
  sources: [KBF_VALJA, KBF_FONDER, KBF_FONDAVGIFTER, RB_MATS, RB_VAD],
  questions: [
    {
      id: 'k1-06-q1',
      text:
        'Anna och Bo får båda 6 procent per år på 10 000 kronor. Anna låter avkastningen ligga kvar, Bo tar ut den varje år. Vem har mest efter tio år, allt inräknat?',
      options: [
        'Bo, eftersom han har fått pengarna tidigare.',
        'Anna, eftersom hennes avkastning också ger avkastning.',
        'Lika mycket, eftersom procenten är densamma.',
        'Det går inte att säga utan att veta skattesatsen.',
      ],
      correct: 1,
      why:
        'Annas belopp växer till ungefär 17 908 kronor eftersom varje års avkastning räknas på ett större belopp. Bo får ' +
        '600 kronor om året, totalt 16 000 kronor med insatsen. Skillnaden är ränta på ränta.',
    },
    {
      id: 'k1-06-q2',
      text: 'Ett sparande faller med 50 procent ett år. Hur mycket måste det sedan stiga för att vara tillbaka där det började?',
      options: ['50 procent', '25 procent', '75 procent', '100 procent'],
      correct: 3,
      why:
        'Efter fallet är 10 000 kronor bara 5 000. För att komma tillbaka till 10 000 måste 5 000 fördubblas, vilket är en ' +
        'uppgång på 100 procent. Uppgången räknas på det mindre beloppet.',
    },
    {
      id: 'k1-06-q3',
      text: 'Ditt sparande ger 3 procent ett år när inflationen är 2 procent. Vad hände ungefär med din köpkraft?',
      options: [
        'Den ökade med ungefär 1 procent.',
        'Den ökade med 3 procent.',
        'Den minskade med 2 procent.',
        'Den ökade med 5 procent.',
      ],
      correct: 0,
      why:
        'Pengarna blev 3 procent fler men varorna 2 procent dyrare. Det du kan köpa för pengarna ökade därför bara med ungefär ' +
        'skillnaden, 1 procent. Det kallas real avkastning.',
    },
    {
      id: 'k1-06-q4',
      text: 'Varför minskar risken när du äger aktier i flera olika bolag i stället för i ett?',
      options: [
        'Alla bolag kan aldrig falla samtidigt.',
        'Avkastningen blir garanterad över tio år.',
        'Om ett bolag går dåligt påverkar det bara en del av sparandet.',
        'Courtaget blir lägre när du köper fler bolag.',
      ],
      correct: 2,
      why:
        'Med många bolag hänger inte hela sparandet på hur ett enda går. Spridningen jämnar ut risken, men flera bolag kan ' +
        'falla samtidigt, så den skyddar inte mot förluster och garanterar ingenting.',
    },
  ],
};
