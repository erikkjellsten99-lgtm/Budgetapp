// Kurs 1, lektion 1. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const ABL: Source = {
  title: 'Aktiebolagslagen (2005:551), Sveriges riksdag',
  url: 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/aktiebolagslag-2005551_sfs-2005-551/',
  checked: CHECKED,
};
const KBF_VALJA: Source = {
  title: 'Välja typ av investering, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/sa-fungerar-vardepapper/valja-typ-av-investering',
  checked: CHECKED,
};
const VOLVO_SHARE: Source = {
  title: 'The Volvo Share, AB Volvo',
  url: 'https://www.volvogroup.com/en/investors/the-volvo-share.html',
  checked: CHECKED,
};
const VOLVO_VOTES: Source = {
  title: 'New number of votes in AB Volvo, 30 oktober 2026, AB Volvo',
  url: 'https://www.volvogroup.com/en/news-and-media/news/2026/oct/new-number-of-votes-in-ab-volvo.html',
  checked: CHECKED,
};
const VOLVO_Q4: Source = {
  title: 'Volvo Group, fjärde kvartalet och helåret 2025, AB Volvo',
  url: 'https://www.volvogroup.com/en/news-and-media/news/2026/jan/volvo-group--the-fourth-quarter-and-full-year-2025.html',
  checked: CHECKED,
};

export const K1_01: Lesson = {
  id: 'k1-01',
  course: 1,
  number: 1,
  title: 'Vad en aktie är',
  body: [
    {
      kind: 'p',
      text:
        'Ett aktiebolag är ett företag som ägs av sina aktieägare. Ägandet är uppdelat i lika stora delar som kallas aktier. ' +
        'När du köper en aktie köper du alltså en liten bit av hela bolaget, inte en bit av en viss fabrik eller produkt.',
    },
    {
      kind: 'p',
      text:
        'Det här är grunden för allt annat i kursen. Kursen på börsen, utdelningen och rapporterna handlar alla om samma sak: ' +
        'vad din lilla bit av bolaget är värd och vad den ger dig.',
    },
    { kind: 'h', text: 'Varje aktie är en lika stor bit' },
    {
      kind: 'p',
      text:
        'Enligt aktiebolagslagen ska varje aktiebolag ha ett aktiekapital. Det är ett belopp som står registrerat som bolagets ' +
        'grundkapital. När aktiekapitalet är fördelat på flera aktier står varje aktie för en lika stor andel av det. ' +
        'Lagen kallar den andelen för aktiens kvotvärde.',
    },
    {
      kind: 'p',
      text:
        'För dig som ägare är det enklare att räkna så här: din ägarandel är antalet aktier du äger delat med det totala antalet ' +
        'aktier i bolaget. Äger du 100 av 10 000 aktier äger du en procent av bolaget.',
    },
    { kind: 'h', text: 'Vad en aktie ger dig' },
    {
      kind: 'list',
      items: [
        'Rätt att vara med och besluta. Aktieägarna fattar sina beslut om bolaget på bolagsstämman, ägarnas möte.',
        'Rätt till en del av vinsten när bolaget delar ut pengar. Det kallas utdelning och betalas lika per aktie inom samma aktieslag.',
        'En del av bolagets värde. Om andra vill betala mer för bolaget än du gjorde stiger värdet på din bit, och om de vill betala mindre sjunker det.',
      ],
    },
    {
      kind: 'p',
      text:
        'Utdelning är inget bolaget måste ge. Lagen säger att bolagsstämman beslutar om vinstutdelning, och att stämman som ' +
        'huvudregel inte får dela ut mer än styrelsen har föreslagit. Ett bolag som behöver pengarna till att växa kan låta bli ' +
        'att dela ut något alls.',
    },
    { kind: 'h', text: 'A-aktier och B-aktier' },
    {
      kind: 'p',
      text:
        'Huvudregeln i lagen är att alla aktier har lika rätt i bolaget. Bolagsordningen, bolagets egna grundregler, får ändå ' +
        'bestämma att det ska finnas olika aktieslag. Då kan aktierna till exempel ha olika många röster på stämman.',
    },
    {
      kind: 'p',
      text:
        'Det finns en gräns: ingen aktie får ha mer än tio gånger så många röster som någon annan aktie i samma bolag. ' +
        'Vilket aktieslag som har flest röster, och om aktieslagen får lika utdelning, står i varje bolags bolagsordning. ' +
        'Kontrollera alltid det för de bolag du äger.',
    },
    {
      kind: 'p',
      text:
        'Besluten på stämman fattas genom omröstning, så det är rösterna som räknas. Den som äger aktier med många röster kan ' +
        'därför ha mer inflytande än andelen av aktierna visar, vilket du ser i exemplet längre ner.',
    },
    { kind: 'h', text: 'Du kan inte förlora mer än du satsat' },
    {
      kind: 'p',
      text:
        'Aktiebolagslagen säger att aktieägarna inte har något personligt betalningsansvar för bolagets skulder. ' +
        'Det kallas ofta begränsat ansvar. Går bolaget i konkurs kan din aktie bli värdelös, men långivarna kan inte kräva ' +
        'dig på resten av skulderna. Lagen har ett undantag för en ägare som medvetet röstar för att fortsätta driva ett bolag ' +
        'som enligt lagen ska gå i likvidation.',
    },
    {
      kind: 'p',
      text:
        'Begränsat ansvar betyder inte låg risk. Konsumenternas Bank- och finansbyrå påpekar att du i värsta fall kan förlora ' +
        'hela det belopp du har investerat. Risk och chans hör ihop, vilket lektion 6 handlar om.',
    },
    { kind: 'h', text: 'Privata och publika bolag' },
    {
      kind: 'p',
      text:
        'Aktier i ett privat aktiebolag får enligt lagen inte handlas på en reglerad marknad eller någon annan organiserad ' +
        'marknadsplats. De bolag du kan köpa aktier i via banken är därför publika aktiebolag. Har namnet inte ordet publikt ' +
        'ska bolagsordningen ange beteckningen (publ) efter namnet.',
    },
    { kind: 'h', text: 'Aktiekursen' },
    {
      kind: 'p',
      text:
        'Aktiekursen är det pris som en aktie senast handlades till. Den sätts inte av bolaget utan av köpare och säljare på ' +
        'börsen, och den kan ändras varje sekund under en handelsdag. Hur det går till är nästa lektion.',
    },
    {
      kind: 'p',
      text:
        'Kom ihåg skillnaden mellan bolaget och aktien. Bolaget kan tjäna mer pengar ett år samtidigt som aktiekursen faller, ' +
        'till exempel om köparna hade väntat sig ännu mer. Resten av kursen handlar om att förstå både bolaget och priset.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den säger ingenting om vilka aktier som är värda att äga.',
    },
  ],
  example: {
    title: 'Volvo: två aktieslag och samma utdelning',
    text:
      'Den 30 oktober 2026 fanns det 2 033 452 084 aktier i AB Volvo, varav 440 143 109 A-aktier och 1 593 308 975 B-aktier. ' +
      'Enligt Volvo ger en A-aktie en röst på stämman och en B-aktie en tiondels röst, medan utdelningen är densamma för båda. ' +
      'A-aktierna är alltså ungefär 22 procent av aktierna men står för ungefär 73 procent av de 599 474 006,5 rösterna. ' +
      'Enligt Volvos rapport för helåret 2025 föreslog styrelsen 8,50 kronor i ordinarie utdelning och 4,50 kronor i extra utdelning per aktie, ' +
      'alltså 13 kronor. Den som ägde 100 aktier ägde ungefär en tjugomiljondel av Volvo och skulle enligt förslaget få 1 300 kronor ' +
      'före skatt, oavsett aktieslag.',
    source: VOLVO_VOTES,
  },
  key: [
    'En aktie är en lika stor andel av hela bolaget, och din ägarandel är dina aktier delat med alla aktier.',
    'Aktien ger rätt att besluta på bolagsstämman och del i utdelningen, som stämman beslutar om och som bolaget inte måste ge.',
    'Du kan förlora det du satsat men inte mer, eftersom aktieägare inte svarar personligen för bolagets skulder.',
  ],
  terms: [
    { word: 'Aktiebolag', meaning: 'Ett företag som ägs av aktieägare, där ägandet är delat i aktier.' },
    { word: 'Aktie', meaning: 'En lika stor andel av ett aktiebolag.' },
    { word: 'Aktiekapital', meaning: 'Det belopp som står registrerat som aktiebolagets grundkapital.' },
    { word: 'Kvotvärde', meaning: 'Den andel av aktiekapitalet som en aktie står för.' },
    { word: 'Bolagsstämma', meaning: 'Aktieägarnas möte, där ägarna fattar beslut om bolaget, till exempel om utdelning.' },
    { word: 'Utdelning', meaning: 'Pengar som bolaget betalar ut till ägarna, lika per aktie inom samma aktieslag.' },
    { word: 'Bolagsordning', meaning: 'Bolagets egna grundregler, till exempel vilka aktieslag som finns.' },
    { word: 'Aktieslag', meaning: 'Olika sorters aktier i samma bolag, till exempel A och B, som kan ha olika många röster.' },
    { word: 'Begränsat ansvar', meaning: 'Aktieägarna betalar inte bolagets skulder. Det mesta du kan förlora är det du satsat.' },
    { word: 'Publikt aktiebolag', meaning: 'Ett aktiebolag vars aktier får säljas till allmänheten och handlas på en marknadsplats.' },
    { word: 'Aktiekurs', meaning: 'Det pris som aktien senast handlades till på börsen.' },
  ],
  sources: [ABL, KBF_VALJA, VOLVO_SHARE, VOLVO_VOTES, VOLVO_Q4],
  questions: [
    {
      id: 'k1-01-q1',
      text: 'Ett bolag med bara ett aktieslag har 1 000 000 aktier. Du äger 1 000 av dem. Vad stämmer?',
      options: [
        'Du äger en tusendel av bolagets fabriker och kan välja vilken del som är din.',
        'Du kan när som helst kräva att bolaget betalar tillbaka det du gav för aktierna.',
        'Du äger en tusendel av bolaget och får en tusendel av utdelningen och rösterna.',
        'Du ansvarar för en tusendel av bolagets skulder om det går i konkurs.',
      ],
      correct: 2,
      why:
        'Varje aktie är en lika stor andel av hela bolaget, så 1 000 av 1 000 000 aktier är en tusendel av ägandet, utdelningen och rösterna. ' +
        'Du äger ingen bestämd del av tillgångarna och svarar inte för bolagets skulder.',
    },
    {
      id: 'k1-01-q2',
      text: 'Styrelsen föreslår 5 kronor i utdelning per aktie. Vad kan bolagsstämman som huvudregel besluta?',
      options: [
        '5 kronor, en lägre utdelning eller ingen utdelning alls.',
        'Vilket belopp som helst, till exempel 8 kronor, om majoriteten vill.',
        'Ingenting, eftersom det är styrelsen som beslutar om utdelningen.',
        'Bara exakt 5 kronor, eftersom förslaget är bindande.',
      ],
      correct: 0,
      why:
        'Det är bolagsstämman som beslutar om utdelning, men enligt aktiebolagslagen får den som huvudregel inte dela ut mer än ' +
        'styrelsen har föreslagit. Mindre eller ingenting går bra.',
    },
    {
      id: 'k1-01-q3',
      text:
        'I Volvo får A-aktien och B-aktien samma utdelning, men A-aktien har en röst och B-aktien en tiondels röst. Varför kan bolaget ha det så?',
      options: [
        'A-aktierna kostar mer på börsen och får därför fler röster.',
        'Staten äger alla A-aktier och har rätt till fler röster.',
        'Lagen säger att A-aktier alltid har tio röster mer än B-aktier.',
        'Bolagsordningen får bestämma olika aktieslag, med högst tio gånger fler röster per aktie.',
      ],
      correct: 3,
      why:
        'Huvudregeln är att alla aktier har lika rätt, men bolagsordningen får bestämma olika aktieslag. Lagen sätter taket: ' +
        'ingen aktie får ha mer än tio gånger röstvärdet för någon annan. Rösterna hänger inte på kursen.',
    },
    {
      id: 'k1-01-q4',
      text: 'Ett bolag du äger aktier i går i konkurs med stora skulder. Vad är det värsta som normalt händer dig som aktieägare?',
      options: [
        'Du får betala din andel av skulderna till långivarna.',
        'Du förlorar det du har betalat för aktierna.',
        'Du får tillbaka pengarna från insättningsgarantin.',
        'Staten löser in aktierna till det pris du köpte för.',
      ],
      correct: 1,
      why:
        'Aktiebolagslagen säger att aktieägare inte har något personligt betalningsansvar för bolagets skulder. ' +
        'Aktien kan bli värdelös, men långivarna kan inte kräva dig på mer, och ingen garanti ersätter förlusten.',
    },
  ],
};
