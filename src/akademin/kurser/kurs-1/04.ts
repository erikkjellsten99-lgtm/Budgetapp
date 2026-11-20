// Kurs 1, lektion 4. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const KBF_FONDER: Source = {
  title: 'Fonder, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder',
  checked: CHECKED,
};
const KBF_FONDTYPER: Source = {
  title: 'Olika fonder, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder/olika-fondtyper',
  checked: CHECKED,
};
const KBF_FONDAVGIFTER: Source = {
  title: 'Avgifter i fondsparande, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder/fondavgifter',
  checked: CHECKED,
};
const SKV_ETF: Source = {
  title: 'Börshandlade fonder (ETF), Skatteverket',
  url: 'https://www.skatteverket.se/privat/skatter/vardepapper/omovrigavardepapper/fonder/borshandladefonderetf',
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

export const K1_04: Lesson = {
  id: 'k1-04',
  course: 1,
  number: 4,
  title: 'Aktie, fond eller ETF',
  body: [
    {
      kind: 'p',
      text:
        'Det finns tre vanliga sätt att äga en bit av börsen. Du kan köpa aktier i enskilda bolag, köpa andelar i en fond, ' +
        'eller köpa en börshandlad fond, som brukar kallas ETF. Alla tre kan innehålla samma bolag. Skillnaden ligger i hur ' +
        'mycket du sprider pengarna, vad det kostar och hur du handlar.',
    },
    { kind: 'h', text: 'Enskilda aktier' },
    {
      kind: 'p',
      text:
        'När du äger aktier direkt äger du bolagen själv. Du väljer vilka, och du betalar courtage när du köper och säljer. ' +
        'Ingen förvaltare tar en avgift för att välja åt dig.',
    },
    {
      kind: 'p',
      text:
        'Baksidan är att avkastningen helt hänger på de bolag du valt. Konsumenternas Bank- och finansbyrå påpekar att den som ' +
        'har allt sparande i ett enda bolag är helt beroende av hur just den aktien går. Att äga flera bolag, eller en ' +
        'aktiefond, minskar den risken.',
    },
    { kind: 'h', text: 'Fonder' },
    {
      kind: 'p',
      text:
        'En fond är en samling värdepapper, till exempel aktier eller obligationer. När du köper andelar i fonden blir du ' +
        'delägare tillsammans med alla andra som sparar i den. Ett fondbolag sköter fonden, och fondens tillgångar förvaras ' +
        'hos ett förvaringsinstitut, oftast en bank.',
    },
    {
      kind: 'list',
      items: [
        'Aktiefond: placerar minst 75 procent av pengarna i aktier eller aktierelaterade instrument.',
        'Räntefond: placerar bara i räntebärande värdepapper, som obligationer.',
        'Blandfond: placerar i både aktier och räntebärande värdepapper.',
        'Indexfond: följer ett index, till exempel OMXS30, genom att äga samma aktier som indexet.',
      ],
    },
    {
      kind: 'p',
      text:
        'En fond kan förvaltas aktivt, där förvaltaren analyserar och väljer vad fonden köper och säljer, eller passivt, där ' +
        'fonden bara följer ett index.',
    },
    {
      kind: 'p',
      text:
        'Fondbolaget tar ut en förvaltningsavgift, en årlig procentsats av det du har i fonden. Den dras från fondens värde, ' +
        'en del varje dag, så du ser den aldrig som en räkning. Lagen sätter ingen övre gräns. Aktivt förvaltade fonder är ' +
        'enligt Konsumenternas Bank- och finansbyrå i regel dyrare än indexfonder, och fonder med samma inriktning kan ha ' +
        'mycket olika avgifter.',
    },
    {
      kind: 'p',
      text:
        'Ibland tillkommer en avgift när du köper eller säljer andelar. Se också upp med fond i fond, alltså en fond som ' +
        'placerar i andra fonder: där kan avgifterna bli höga och svåra att överblicka. Fondbolaget ska varje år tala om för dig ' +
        'hur stor del av fondens kostnader som gäller just ditt innehav.',
    },
    {
      kind: 'p',
      text:
        'En vanlig fond prissätts en gång om dagen. Enligt Skatteverket får alla som köper eller säljer samma dag samma pris, ' +
        'oavsett när på dagen ordern lades.',
    },
    { kind: 'h', text: 'Börshandlade fonder, ETF' },
    {
      kind: 'p',
      text:
        'En ETF är en fond som handlas på börsen precis som en aktie. Priset ändras hela dagen, och du får det pris som gäller ' +
        'när din order går igenom. Den följer något underliggande, till exempel ett index, en råvara eller en valuta. Precis ' +
        'som för aktier betalar du courtage när du handlar.',
    },
    {
      kind: 'p',
      text:
        'Skatteverket nämner också ETF:er med hävstång, som rör sig flera gånger så mycket som det de följer, och omvända ' +
        'ETF:er, som går upp när det underliggande går ner. Två ETF:er kan alltså bete sig helt olika fast de följer samma ' +
        'sak, beroende på hur de är byggda.',
    },
    { kind: 'h', text: 'Skatt på fonder utanför ISK' },
    {
      kind: 'p',
      text:
        'Äger du fonder, även ETF:er, på ett vanligt konto finns en särskild skatt. Regeln gäller sedan inkomståret 2012 och ' +
        'gäller även 2026 (kontrollerat 2026-11-20). Varje år tas ' +
        '0,4 procent av fondandelarnas värde vid årets början upp som inkomst och beskattas med 30 procent. Konsumenternas ' +
        'exempel: andelar värda 10 000 kronor ger 40 kronor i inkomst och 12 kronor i skatt. Den skatten gäller inte på ett ' +
        'investeringssparkonto, som är nästa lektion.',
    },
    { kind: 'h', text: 'Så jämför du' },
    {
      kind: 'list',
      items: [
        'Spridning: hur många bolag och branscher pengarna hamnar i.',
        'Kostnad: courtage när du handlar och avgift varje år du äger.',
        'Handel: en gång per dag till samma pris, eller under dagen till aktuellt pris.',
        'Vad du äger: bolagen direkt, eller en andel i något som äger dem.',
      ],
    },
    {
      kind: 'p',
      text:
        'Konsumenternas Bank- och finansbyrå påminner om att en fonds tidigare resultat inte är någon garanti för framtiden, ' +
        'och att spridning jämnar ut risken men inte skyddar mot förluster.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Vilket sätt som passar beror på dig, och lektionen tar inte ställning.',
    },
  ],
  example: {
    title: 'Investor: en aktie som äger många bolag',
    text:
      'Investor är ett investmentbolag, alltså ett bolag vars verksamhet är att äga andra bolag, bland annat ABB, SEB, Ericsson ' +
      'och Saab. Det är ingen fond utan en aktie på börsen. Enligt delårsredogörelsen för januari till september 2026 var ' +
      'det justerade substansvärdet, Investors beräknade värde på allt bolaget äger minus skulderna, 411 kronor per aktie den ' +
      '30 september 2026. Samma dag var B-aktiens kurs 405,80 kronor. Kursen sätts av köpare och säljare och kan därför skilja ' +
      'sig från substansvärdet. Investors egna förvaltningskostnader var 802 miljoner kronor under de senaste tolv månaderna, ' +
      'vilket bolaget anger motsvarar 0,06 procent av det justerade substansvärdet.',
    source: INVESTOR_Q3,
  },
  key: [
    'En aktie är en del av ett bolag, en fond är en andel i många värdepapper, och en ETF är en fond som handlas på börsen som en aktie.',
    'Fondens förvaltningsavgift dras från värdet varje dag, och indexfonder är i regel billigare än aktivt förvaltade.',
    'Ju fler bolag pengarna sprids på, desto mindre hänger allt på ett enda bolag, men spridning skyddar inte mot förluster.',
  ],
  terms: [
    { word: 'Fond', meaning: 'En samling värdepapper som många sparare äger tillsammans genom andelar.' },
    { word: 'Fondandel', meaning: 'Din del av en fond.' },
    { word: 'Fondbolag', meaning: 'Företaget som sköter en fond.' },
    { word: 'Förvaringsinstitut', meaning: 'Den bank som förvarar fondens tillgångar, skilt från fondbolaget.' },
    { word: 'Aktiefond', meaning: 'En fond som har minst 75 procent i aktier eller aktierelaterade instrument.' },
    { word: 'Räntefond', meaning: 'En fond som bara placerar i räntebärande värdepapper.' },
    { word: 'Blandfond', meaning: 'En fond med både aktier och räntebärande värdepapper.' },
    { word: 'Aktiv förvaltning', meaning: 'Förvaltaren väljer själv vad fonden köper och säljer.' },
    { word: 'Passiv förvaltning', meaning: 'Fonden följer bara ett index.' },
    { word: 'Förvaltningsavgift', meaning: 'Fondens årliga avgift i procent, som dras från fondens värde.' },
    { word: 'Fond i fond', meaning: 'En fond som placerar i andra fonder, med avgifter i flera led.' },
    { word: 'ETF', meaning: 'Börshandlad fond, en fond som köps och säljs på börsen som en aktie.' },
    { word: 'Investmentbolag', meaning: 'Ett bolag vars verksamhet är att äga andra bolag.' },
    { word: 'Substansvärde', meaning: 'Värdet på allt ett investmentbolag äger minus skulderna.' },
  ],
  sources: [KBF_FONDER, KBF_FONDTYPER, KBF_FONDAVGIFTER, SKV_ETF, KBF_VALJA, KBF_AVGIFTER, INVESTOR_Q3],
  questions: [
    {
      id: 'k1-04-q1',
      text:
        'Du lägger en köporder i en vanlig fond klockan 09. En vän köper samma fond klockan 11 samma dag. Vilket pris får ni?',
      options: [
        'Du får ett lägre pris, eftersom du var först.',
        'Vännen får dagens högsta pris.',
        'Samma pris, eftersom en vanlig fond prissätts en gång om dagen.',
        'Det beror på hur stort courtage var och en betalar.',
      ],
      correct: 2,
      why:
        'En vanlig fond får ett nytt pris en gång per dag, och alla order den dagen görs till det priset oavsett klockslag. ' +
        'Det är en av skillnaderna mot en ETF, som handlas till aktuellt pris under dagen.',
    },
    {
      id: 'k1-04-q2',
      text:
        'Två indexfonder följer samma index. Fond A har 0,2 procent i årlig avgift och fond B 1,0 procent. Vad kan du vänta dig?',
      options: [
        'Fond A ger dig mer, eftersom en mindre avgift dras från fondens värde.',
        'Fond B ger dig mer, eftersom en dyrare förvaltare gör ett bättre jobb.',
        'Samma, eftersom avgiften betalas separat och inte påverkar värdet.',
        'Avgiften spelar bara roll de år fonden går ner.',
      ],
      correct: 0,
      why:
        'Båda äger samma aktier och får ungefär samma utveckling före avgift. Avgiften dras från fondens värde varje dag, så den ' +
        'billigare fonden lämnar mer kvar åt dig varje år, både uppåt och nedåt.',
    },
    {
      id: 'k1-04-q3',
      text: 'Vad skiljer en ETF från en vanlig fond?',
      options: [
        'En ETF beskattas aldrig.',
        'En ETF kan inte sjunka i värde.',
        'En ETF äger alltid bara en enda aktie.',
        'En ETF handlas på börsen under dagen till aktuellt pris, och du betalar courtage.',
      ],
      correct: 3,
      why:
        'En ETF köps och säljs på börsen precis som en aktie, med pris i realtid och courtage. Skatteverket beskattar den som ' +
        'andra fonder, och den kan sjunka som allt annat som följer marknaden.',
    },
    {
      id: 'k1-04-q4',
      text:
        'Den 30 september 2026 var Investors justerade substansvärde 411 kronor per aktie och B-aktien kostade 405,80 kronor. Vad visar det?',
      options: [
        'Investor är en fond som räknat fel på sitt värde.',
        'Kursen sätts av köpare och säljare och kan skilja sig från värdet på innehaven.',
        'Investor tar ut en avgift på drygt 5 kronor per aktie.',
        'Substansvärdet är det pris du får om du säljer aktien.',
      ],
      correct: 1,
      why:
        'Ett investmentbolag är en aktie, inte en fond. Priset bestäms på börsen av vad köpare och säljare kommer överens om, ' +
        'och det kan ligga över eller under bolagets beräknade värde på det som ägs.',
    },
  ],
};
