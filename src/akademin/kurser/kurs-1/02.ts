// Kurs 1, lektion 2. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const FI_EMITTENTER: Source = {
  title: 'Emittenter, Finansinspektionen',
  url: 'https://fi.se/sv/marknad/emittenter',
  checked: CHECKED,
};
const NASDAQ_AUCTIONS: Source = {
  title: 'INET Nordic Auctions, faktablad om auktionerna på Nasdaq Nordic (2026), Nasdaq',
  url: 'https://www.nasdaq.com/INETNordicAuctionsFactsheet',
  checked: CHECKED,
};
const KBF_VALJA: Source = {
  title: 'Välja typ av investering, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/sa-fungerar-vardepapper/valja-typ-av-investering',
  checked: CHECKED,
};
const KBF_AVGIFTER: Source = {
  title: 'Olika avgifter inom ISK, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/investeringssparkonton--isk/olika-avgifter-inom-isk',
  checked: CHECKED,
};
const INVESTOR_Q3: Source = {
  title: 'Investor AB, delårsredogörelse januari till september 2026',
  url: 'https://mb.cision.com/Main/1084/4409693/4321381.pdf',
  checked: CHECKED,
};

export const K1_02: Lesson = {
  id: 'k1-02',
  course: 1,
  number: 2,
  title: 'Hur börsen fungerar och hur kursen sätts',
  body: [
    {
      kind: 'p',
      text:
        'En börs är en marknadsplats där de som vill köpa aktier möter de som vill sälja. Börsen äger inga aktier själv och ' +
        'bestämmer inga priser. Den ordnar mötet och följer regler för hur affärerna går till.',
    },
    { kind: 'h', text: 'Olika sorters marknadsplatser' },
    {
      kind: 'p',
      text:
        'Finansinspektionen, som har tillsyn över finansmarknaden, skiljer på två slags handelsplatser. Nasdaq Stockholm är en ' +
        'reglerad marknad. Nasdaq First North, Spotlight Stock Market och NGM Nordic MTF är handelsplattformar, som också ' +
        'kallas MTF. Kraven på bolagen skiljer sig mellan dem.',
    },
    {
      kind: 'p',
      text:
        'Gemensamt är att många av kraven handlar om att bolagen ska informera allmänheten. Enligt Finansinspektionen är syftet ' +
        'en marknad där mycket är öppet och synligt, vilket ger investerare ett starkt skydd. Det är därför börsbolag ' +
        'publicerar rapporter och pressmeddelanden.',
    },
    {
      kind: 'p',
      text:
        'Du skickar inte själv order till börsen. Det gör börsens medlemmar, till exempel din bank eller nätmäklare, åt dig.',
    },
    { kind: 'h', text: 'Ordern och orderboken' },
    {
      kind: 'p',
      text:
        'En order är ett besked om att köpa eller sälja ett visst antal aktier. Oftast anger du ett pris: högst så här mycket ' +
        'när du köper, lägst så här mycket när du säljer. Det kallas en limitorder.',
    },
    {
      kind: 'p',
      text:
        'Det finns också marknadsorder, som köper eller säljer till det bästa pris som finns i orderboken just då. Den går ' +
        'igenom snabbt, men du vet inte exakt vilket pris du får. I en aktie där det handlas lite kan priset bli ett annat ' +
        'än du räknat med.',
    },
    {
      kind: 'p',
      text:
        'Alla order i en aktie samlas i aktiens orderbok, sorterade efter pris. Det högsta pris som någon köpare just nu bjuder ' +
        'kallas köpkurs. Det lägsta pris som någon säljare just nu begär kallas säljkurs. Skillnaden mellan dem kallas spread.',
    },
    {
      kind: 'p',
      text:
        'Under den löpande handeln blir det en affär så fort en köpare och en säljare möts i pris. Priset i den senaste ' +
        'affären kallas senast betalt, och det är den siffran du ser som aktiens kurs i appen.',
    },
    { kind: 'h', text: 'Dagen börjar och slutar med en auktion' },
    {
      kind: 'p',
      text:
        'Enligt Nasdaqs faktablad om auktioner (utgåva från 2026, kontrollerat 2026-11-20) samlas order på Nasdaq Stockholm i en öppningsauktion mellan 08:45 och ' +
        '09:00 och i en stängningsauktion mellan 17:25 och 17:30. Under auktionen visas inte enskilda order, bara ett ' +
        'preliminärt pris och hur mycket som kan handlas till det.',
    },
    {
      kind: 'p',
      text:
        'När auktionen tar slut räknar börsens system ut, utifrån ordrarna, det pris där flest aktier kan bytas. Alla affärer i auktionen görs till samma ' +
        'pris. Sluttiden slumpas inom en kort stund, några sekunder vid öppningen och upp till en halv minut vid stängningen, ' +
        'så att ingen kan vänta till sista stund och flytta priset.',
    },
    {
      kind: 'p',
      text:
        'Ett påhittat exempel visar principen. Köparna vill tillsammans ha 500 aktier om priset är 100 kronor, 400 vid 101 och ' +
        '250 vid 102. Säljarna erbjuder 200 aktier vid 100 kronor, 350 vid 101 och 450 vid 102.',
    },
    {
      kind: 'list',
      items: [
        'Vid 100 kronor kan 200 aktier bytas, för fler säljare finns inte.',
        'Vid 101 kronor kan 350 aktier bytas.',
        'Vid 102 kronor kan 250 aktier bytas, för fler köpare finns inte.',
        'Auktionen blir därför 101 kronor, priset där flest aktier byter ägare.',
      ],
    },
    { kind: 'h', text: 'Varför kursen rör sig' },
    {
      kind: 'p',
      text:
        'Kursen är bara priset i den senaste affären. Vill fler köpa än sälja vid dagens pris måste köparna bjuda mer för att ' +
        'få aktier, och kursen stiger. Vill fler sälja än köpa går det åt andra hållet. Nyheter om bolaget, räntor och ' +
        'stämningen på marknaden ändrar vad folk är villiga att betala.',
    },
    {
      kind: 'p',
      text:
        'Om du multiplicerar kursen med antalet aktier får du bolagets börsvärde, alltså vad hela bolaget kostar till dagens pris. ' +
        'Har bolaget flera aktieslag räknar man med varje aktieslags kurs.',
    },
    { kind: 'h', text: 'Kostnader och tid' },
    {
      kind: 'p',
      text:
        'När du köper och säljer aktier betalar du courtage, en avgift till banken eller mäklaren för affären. Avgifterna ' +
        'skiljer sig mellan företag.',
    },
    {
      kind: 'p',
      text:
        'Konsumenternas Bank- och finansbyrå skriver att mycket handlade aktier på Stockholmsbörsen ofta går att sälja inom ' +
        'några minuter, men att pengarna kan ta några dagar att komma in på kontot. Det finns heller ingen garanti för att ' +
        'det finns en köpare just när du behöver sälja.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den säger ingenting om när det är klokt att köpa eller sälja.',
    },
  ],
  example: {
    title: 'Investor: två aktieslag, två kurser',
    text:
      'I Investors delårsredogörelse för januari till september 2026 stod A-aktien i 398,40 kronor och B-aktien i 405,80 kronor ' +
      'den 30 september 2026. Samma bolag, men två aktieslag med var sin orderbok och därför var sitt pris. Den 31 december ' +
      '2025 var B-aktien 330,40 kronor, så kursen steg ungefär 23 procent under de nio månaderna. Börsvärdet för båda ' +
      'aktieslagen, utan de aktier bolaget själv köpt tillbaka, var 1 234 030 miljoner kronor den 30 september 2026.',
    source: INVESTOR_Q3,
  },
  key: [
    'Börsen bestämmer inga priser, den låter köpare och säljare mötas i en orderbok för varje aktie.',
    'Kursen är priset i senaste affären, och i öppnings och stängningsauktionen väljs priset där flest aktier kan bytas.',
    'Börsvärdet är kursen gånger antalet aktier, och varje köp och sälj kostar courtage.',
  ],
  terms: [
    { word: 'Börs', meaning: 'En marknadsplats där köpare och säljare av aktier möts enligt fasta regler.' },
    { word: 'Reglerad marknad', meaning: 'Den sortens marknadsplats som Nasdaq Stockholm är, med andra krav på bolagen än en MTF.' },
    { word: 'Handelsplattform (MTF)', meaning: 'En marknadsplats med andra krav än en reglerad marknad, till exempel Nasdaq First North.' },
    { word: 'Order', meaning: 'Ett besked om att köpa eller sälja ett visst antal aktier.' },
    { word: 'Limitorder', meaning: 'En order med ett högsta pris för köp eller ett lägsta pris för sälj.' },
    { word: 'Marknadsorder', meaning: 'En order som köper eller säljer till bästa pris som finns just då.' },
    { word: 'Orderbok', meaning: 'Listan med alla köp och säljorder i en aktie, sorterad efter pris.' },
    { word: 'Köpkurs', meaning: 'Det högsta pris som någon köpare bjuder just nu.' },
    { word: 'Säljkurs', meaning: 'Det lägsta pris som någon säljare begär just nu.' },
    { word: 'Spread', meaning: 'Skillnaden mellan säljkurs och köpkurs.' },
    { word: 'Senast betalt', meaning: 'Priset i den senaste affären, det som visas som aktiens kurs.' },
    { word: 'Auktion', meaning: 'En period då order samlas och alla affärer görs till ett gemensamt pris, på morgonen och kvällen.' },
    { word: 'Börsvärde', meaning: 'Kursen gånger antalet aktier, alltså vad hela bolaget kostar till dagens pris.' },
    { word: 'Courtage', meaning: 'Avgiften till banken eller mäklaren när du köper eller säljer.' },
  ],
  sources: [FI_EMITTENTER, NASDAQ_AUCTIONS, KBF_VALJA, KBF_AVGIFTER, INVESTOR_Q3],
  questions: [
    {
      id: 'k1-02-q1',
      text:
        'Mitt på dagen är köpkursen 100 kronor och säljkursen 101 kronor. Du lägger en köporder på några få aktier med högsta pris 101 kronor. Vad händer troligast?',
      options: [
        'Du får köpa för 100 kronor, eftersom det är köpkursen.',
        'Ordern väntar till stängningsauktionen.',
        'Det blir en affär direkt för 101 kronor mot den som säljer där.',
        'Ordern avvisas, eftersom du bjuder mer än köpkursen.',
      ],
      correct: 2,
      why:
        'Säljkursen är det lägsta pris någon säljare begär. När du är beredd att betala just det priset möts ni, och under ' +
        'den löpande handeln blir det en affär direkt till 101 kronor.',
    },
    {
      id: 'k1-02-q2',
      text: 'Varför slutar auktionerna på Nasdaq Stockholm vid en slumpad tidpunkt i stället för på exakt utsatt sekund?',
      options: [
        'För att mäklarna ska hinna räkna ut courtaget.',
        'För att börsens datorer ska hinna starta om.',
        'För att småsparare ska få sina order utförda först.',
        'För att ingen ska kunna flytta priset med en order i sista stund.',
      ],
      correct: 3,
      why:
        'Om alla visste exakt när auktionen slutar kunde någon vänta till sista ögonblicket och lägga en order som flyttar ' +
        'priset. En slumpad sluttid gör det svårare och priset mer pålitligt.',
    },
    {
      id: 'k1-02-q3',
      text: 'Hur väljs priset i öppnings och stängningsauktionen?',
      options: [
        'Det blir priset där flest aktier kan byta ägare.',
        'Det blir medelvärdet av det högsta köp och det lägsta säljpriset.',
        'Det blir gårdagens stängningskurs.',
        'Det blir priset som den största köparen bjuder.',
      ],
      correct: 0,
      why:
        'Nasdaq väljer det pris som ger störst handlad volym. Vid ett högre pris finns färre köpare och vid ett lägre färre ' +
        'säljare, så det pris där utbud och efterfrågan möts bäst vinner.',
    },
    {
      id: 'k1-02-q4',
      text:
        'Den 30 september 2026 kostade Investors A-aktie 398,40 kronor och B-aktien 405,80 kronor. Hur kan två aktier i samma bolag ha olika kurs?',
      options: [
        'Börsen räknar fram B-aktiens kurs utifrån hur många röster den har.',
        'Varje aktieslag har egen orderbok, och kursen sätts av köpare och säljare i just den.',
        'A-aktien har ingen rätt till utdelning och är därför billigare.',
        'Skillnaden är courtaget, som läggs på B-aktiens kurs.',
      ],
      correct: 1,
      why:
        'Aktieslagen handlas var för sig. Kursen är priset i den senaste affären i varje orderbok, så köpare och säljare kan ' +
        'värdera A och B olika, till exempel efter röster eller hur mycket varje aktieslag handlas.',
    },
  ],
};
