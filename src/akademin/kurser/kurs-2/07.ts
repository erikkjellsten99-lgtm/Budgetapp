// Kurs 2, lektion 7. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
import type { Lesson } from '../../types';
import { ABL, ARL, HM_AR25, HM_FY25, RI_REVISOR, RI_TILLSYN, VOLVO_Q4 } from './kallor';

export const K2_07: Lesson = {
  id: 'k2-07',
  course: 2,
  number: 7,
  title: 'Årsredovisningen: var allt står',
  body: [
    {
      kind: 'p',
      text:
        'Kvartalsrapporten är kort och kommer snabbt. Årsredovisningen är bolagets fullständiga redovisning för hela ' +
        'räkenskapsåret. Den är tjock, men du behöver inte läsa allt. Det räcker att veta vilka delar som finns och var du hittar ' +
        'det du letar efter.',
    },
    { kind: 'h', text: 'Delarna enligt lagen' },
    {
      kind: 'p',
      text:
        'Enligt årsredovisningslagen (kontrollerad 2026-11-20) ska en årsredovisning bestå av en balansräkning, en resultaträkning, noter och en ' +
        'förvaltningsberättelse. För större företag ska den också innehålla en kassaflödesanalys. Ett moderföretag ska dessutom ' +
        'som huvudregel göra en koncernredovisning, som visar hela koncernen med dotterbolagen. Årsredovisningen ska skrivas under ' +
        'av alla styrelseledamöter och av den verkställande direktören.',
    },
    {
      kind: 'p',
      text:
        'Lagen säger också att årsredovisningen ska vara överskådlig, och att varje post i ' +
        'räkningarna ska visas med föregående års belopp bredvid. Därför kan du jämföra två år direkt i samma dokument.',
    },
    { kind: 'h', text: 'Förvaltningsberättelsen' },
    {
      kind: 'p',
      text:
        'Förvaltningsberättelsen ska ge en rättvisande översikt över hur verksamheten, ställningen och resultatet har utvecklats. ' +
        'Lagen kräver bland annat upplysningar om viktiga händelser under året, den väntade utvecklingen med väsentliga risker och ' +
        'osäkerheter, forskning och utveckling och bolagets egna aktier. Här står också styrelsens förslag om vad som ska hända ' +
        'med vinsten, till exempel hur stor utdelningen blir.',
    },
    { kind: 'h', text: 'Räkningarna och noterna' },
    {
      kind: 'p',
      text:
        'Räkningarna är de tre du har lärt dig i den här kursen. Noterna förklarar dem. Där står vilka redovisningsprinciper ' +
        'bolaget följer och hur de stora posterna är uppdelade, till exempel avskrivningar, goodwill, skulder och skatt. En siffra ' +
        'i räkningarna kan ha en hänvisning till en not. H&M:s helårsrapport hänvisar till exempel till en not för av- och ' +
        'nedskrivningarna. När något ser konstigt ut i räkningarna är noten nästa ställe att leta.',
    },
    { kind: 'h', text: 'Bolagsstyrning och hållbarhet' },
    {
      kind: 'p',
      text:
        'Ett aktiebolag vars värdepapper handlas på en reglerad marknad ska ha en bolagsstyrningsrapport, antingen i ' +
        'förvaltningsberättelsen eller som en egen handling. Den beskriver bland annat hur styrelsen och dess utskott fungerar, ' +
        'bolagets interna kontroll av den finansiella rapporteringen och aktieägare som har minst en tiondel av rösterna.',
    },
    {
      kind: 'p',
      text:
        'Aktiebolag över vissa storleksgränser ska också ha en hållbarhetsrapport som ett eget avsnitt i förvaltningsberättelsen. ' +
        'Gränserna gäller antal anställda, summan av tillgångarna och omsättningen, och de är lägre för bolag vars värdepapper ' +
        'handlas på en reglerad marknad. Rapporten ska bland annat ta upp miljö, sociala ' +
        'förhållanden, personal, mänskliga rättigheter och motverkande av korruption.',
    },
    { kind: 'h', text: 'Revisorn' },
    {
      kind: 'p',
      text:
        'Enligt aktiebolagslagen (kontrollerad 2026-11-20) ska revisorn granska årsredovisningen, bokföringen och hur styrelsen ' +
        'och den verkställande direktören har skött bolaget. Efter varje räkenskapsår lämnar revisorn en revisionsberättelse ' +
        'till bolagsstämman. Tidsgränserna står i lagarna (kontrollerade 2026-11-20): bolaget ska lämna årsredovisningen till ' +
        'revisorn senast sex veckor före stämman, och revisorn ska lämna revisionsberättelsen till styrelsen senast tre veckor ' +
        'före årsstämman.',
    },
    {
      kind: 'list',
      items: [
        'Revisorn uttalar sig om årsredovisningen är gjord enligt lagen och ger en rättvisande bild av resultat och ställning.',
        'Revisorn uttalar sig om stämman bör fastställa, alltså slutligt godkänna, resultaträkningen och balansräkningen.',
        'Revisorn uttalar sig om styrelsen och den verkställande direktören bör beviljas ansvarsfrihet.',
        'Finns det väsentlig osäkerhet om bolaget kan fortsätta sin verksamhet ska det stå i berättelsen.',
      ],
    },
    {
      kind: 'p',
      text:
        'Auktoriserade och godkända revisorer kallas kvalificerade revisorer och står under Revisorsinspektionens tillsyn. ' +
        'Revisor är däremot ingen skyddad titel. Tänk på att revisorns ' +
        'uttalande gäller redovisningen, inte om aktien är värd att köpa. Tänk också på att en rapport under året kan vara ' +
        'ogranskad. H&M skriver att helårsrapporten för 2025 inte har granskats av revisorerna, och Volvo skriver detsamma om sin ' +
        'rapport för fjärde kvartalet 2025.',
    },
    { kind: 'h', text: 'Var du hittar vad' },
    {
      kind: 'list',
      items: [
        'Hur året gick och vad ledningen väntar sig: förvaltningsberättelsen och vd:ns ord.',
        'Siffrorna: resultaträkningen, balansräkningen och kassaflödesanalysen.',
        'Hur posterna är räknade och vad de består av: noterna.',
        'Vem som styr och hur: bolagsstyrningsrapporten.',
        'Miljö, personal och andra hållbarhetsfrågor: hållbarhetsrapporten.',
        'Bolagets egna nyckeltal och hur de räknas: avsnittet med definitioner.',
        'Om siffrorna är granskade: revisionsberättelsen, som hos H&M står efter räkningarna och noterna.',
      ],
    },
    {
      kind: 'p',
      text:
        'Enligt årsredovisningslagen (kontrollerad 2026-11-20) ska ett aktiebolag skicka in årsredovisningen och revisionsberättelsen till Bolagsverket inom en månad efter att ' +
        'stämman har fastställt resultaträkningen och balansräkningen. H&M har till exempel också lagt ut sin på sidan för ' +
        'investerare.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig hitta i en årsredovisning, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'H&M:s års- och hållbarhetsredovisning 2025',
    text:
      'Redovisningen gäller räkenskapsåret 1 december 2024 till 30 november 2025. Enligt innehållsförteckningen börjar ' +
      'bolagsstyrningsrapporten på sidan 45 och hållbarhetsrapporten på sidan 59. Koncernens räkningar börjar på sidan 138, ' +
      'noterna på sidan 150, underskrifterna står på sidan 175 och revisionsberättelsen börjar på sidan 176. Definitionerna av ' +
      'nyckeltalen finns från sidan 183. Förvaltningsberättelsen är sidorna 16 till 21 och 41 till 137. Revisorn, Deloitte AB, ' +
      'skriver att årsredovisningen och koncernredovisningen ger en rättvisande bild och rekommenderar att stämman fastställer ' +
      'resultaträkningen och balansräkningen. Uttalandet omfattar inte bolagsstyrningsrapporten och hållbarhetsrapporten. För ' +
      'hållbarhetsrapporten finns en egen, mer begränsad granskning från sidan 180.',
    source: HM_AR25,
  },
  key: [
    'Årsredovisningen består av balansräkning, resultaträkning, noter och förvaltningsberättelse, och för större företag kassaflödesanalys.',
    'Förvaltningsberättelsen beskriver året och riskerna, och noterna förklarar siffrorna.',
    'Revisorn granskar redovisningen och förvaltningen och uttalar sig i revisionsberättelsen, men en rapport under året kan vara ogranskad.',
  ],
  terms: [
    { word: 'Förvaltningsberättelse', meaning: 'Den del av årsredovisningen som beskriver årets utveckling, viktiga händelser, framtiden och riskerna.' },
    { word: 'Not', meaning: 'En förklaring i årsredovisningen till en post i räkningarna, med detaljer och redovisningsprinciper.' },
    { word: 'Redovisningsprinciper', meaning: 'De regler och metoder bolaget följer när det räknar fram siffrorna.' },
    { word: 'Koncernredovisning', meaning: 'Redovisningen för en hel koncern, alltså moderbolaget och dess dotterbolag tillsammans.' },
    { word: 'Bolagsstyrningsrapport', meaning: 'Rapporten om hur ett noterat bolag styrs, till exempel styrelsens arbete och intern kontroll.' },
    { word: 'Hållbarhetsrapport', meaning: 'Avsnittet om bland annat miljö, personal, mänskliga rättigheter och korruption.' },
    { word: 'Revisor', meaning: 'Den som granskar bolagets redovisning och förvaltning och lämnar en revisionsberättelse.' },
    { word: 'Revisionsberättelse', meaning: 'Revisorns rapport till bolagsstämman efter granskningen av räkenskapsåret.' },
    { word: 'Rättvisande bild', meaning: 'Att räkningarna och noterna tillsammans ger en riktig bild av bolagets ställning och resultat.' },
    { word: 'Ansvarsfrihet', meaning: 'Ett beslut på bolagsstämman om styrelsens och vd:s ansvar mot bolaget för årets förvaltning. Revisorn uttalar sig om den bör beviljas.' },
    { word: 'Fastställa', meaning: 'Bolagsstämmans beslut att slutligt godkänna resultaträkningen och balansräkningen.' },
    { word: 'Kvalificerad revisor', meaning: 'En auktoriserad eller godkänd revisor. De står under Revisorsinspektionens tillsyn.' },
    { word: 'Revisorsinspektionen', meaning: 'Myndigheten som har tillsyn över auktoriserade och godkända revisorer.' },
    { word: 'Bolagsverket', meaning: 'Myndigheten som aktiebolag skickar in sina årsredovisningar till.' },
  ],
  sources: [ARL, ABL, RI_REVISOR, RI_TILLSYN, HM_AR25, HM_FY25, VOLVO_Q4],
  questions: [
    {
      id: 'k2-07-q1',
      text: 'Du vill veta hur ett bolag räknar fram värdet på sitt varulager. Var i årsredovisningen letar du först?',
      options: [
        'I vd:ns ord i början av årsredovisningen.',
        'I revisionsberättelsen.',
        'I bolagsstyrningsrapporten.',
        'I noterna, där redovisningsprinciperna och posternas detaljer står.',
      ],
      correct: 3,
      why:
        'Noterna förklarar räkningarnas poster och vilka redovisningsprinciper bolaget följer. Vd:ns ord och ' +
        'bolagsstyrningsrapporten handlar om annat, och revisorn beskriver sin granskning, inte varje post.',
    },
    {
      id: 'k2-07-q2',
      text: 'Vad betyder det när revisorn skriver att årsredovisningen ger en rättvisande bild?',
      options: [
        'Att aktien är rimligt värderad och värd att köpa.',
        'Att redovisningen enligt revisorns granskning ger en riktig bild av resultat och ställning.',
        'Att revisorn har kontrollerat varje enskild affär under året.',
        'Att bolaget kommer att gå med vinst nästa år.',
      ],
      correct: 1,
      why:
        'Revisorns uttalande gäller redovisningen, inte aktiens värde eller framtiden. Enligt aktiebolagslagen uttalar sig ' +
        'revisorn om årsredovisningen ger en rättvisande bild av bolagets resultat och ställning.',
    },
    {
      id: 'k2-07-q3',
      text: 'Vilka fyra delar ska en årsredovisning alltid bestå av enligt årsredovisningslagen?',
      options: [
        'Balansräkning, resultaträkning, noter och förvaltningsberättelse.',
        'Resultaträkning, vd:ns ord, revisionsberättelse och hållbarhetsrapport.',
        'Kassaflödesanalys, kvartalsrapport, noter och bolagsstyrningsrapport.',
        'Balansräkning, kursgraf, utdelningsförslag och pressmeddelande.',
      ],
      correct: 0,
      why:
        'Lagen räknar upp balansräkning, resultaträkning, noter och förvaltningsberättelse. Kassaflödesanalys krävs dessutom för ' +
        'större företag, och revisionsberättelsen skrivs av revisorn, inte av bolaget.',
    },
    {
      id: 'k2-07-q4',
      text:
        'H&M skriver att helårsrapporten för 2025 inte har granskats av revisorerna. Vad är rimligast att dra för slutsats?',
      options: [
        'Att siffrorna i rapporten troligen är fel.',
        'Att bolaget bryter mot lagen genom att publicera den.',
        'Att siffrorna inte är granskade än och att årsredovisningen med revisionsberättelsen kommer senare.',
        'Att revisorn har vägrat att godkänna bolagets redovisning.',
      ],
      correct: 2,
      why:
        'En rapport under året kan vara ogranskad. H&M publicerade helårsrapporten i januari 2026, och årsredovisningen med ' +
        'revisionsberättelsen kom senare. Att rapporten är ogranskad säger inte att något är fel.',
    },
  ],
  lab:
    'Öppna den senaste årsredovisningen för ett bolag du äger eller följer, på bolagets sida för investerare. Använd ' +
    'innehållsförteckningen och skriv ner på vilka sidor resultaträkningen, balansräkningen, kassaflödesanalysen och ' +
    'revisionsberättelsen står. Läs revisorns uttalande och skriv med egna ord vad revisorn säger att den har granskat.',
};
