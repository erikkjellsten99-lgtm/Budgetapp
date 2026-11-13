// Lär: fast innehåll om personer inom andning, kyla, bastu, meditation och personlig utveckling.
// Inga citat, bara sammanfattningar med egna ord. Varje påstående har märkning, en sammanfattning skriven
// från den öppnade källan och minst en https-källa som öppnats och kontrollerats (2026-11-13).
// Regler: se CLAUDE.md i den här mappen.

export type AreaId = 'andning' | 'kallbad' | 'meditation' | 'utveckling';

export const AREAS: { id: AreaId; label: string }[] = [
  { id: 'andning', label: 'Andning och kyla' },
  { id: 'kallbad', label: 'Kallbad och bastu' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'utveckling', label: 'Personlig utveckling' },
];

export type Evidence = 'belagt' | 'svagt' | 'asikt';

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  belagt: 'Väl belagt',
  svagt: 'Svagt stöd',
  asikt: 'Egen åsikt',
};

/** En källa. `summary` är bokens, artikelns eller avsnittets huvudpunkter (krävs för Börja här). */
export type Source = { title: string; url: string; summary?: string[] };
/**
 * Ett påstående. `text` är rubriken på en rad, `summary` en sammanfattning i 2 till 4 stycken skriven från
 * den öppnade källan, `note` förbehållet.
 */
export type Claim = { text: string; evidence: Evidence; summary: string[]; note?: string; sources: Source[] };
export type Person = {
  id: string;
  name: string;
  kind: string;
  areas: AreaId[];
  teaser: string;
  about: string;
  method: string[];
  claims: Claim[];
  startHere: Source[];
  warning?: string;
};

const WARN_BREATH_COLD =
  'Andningen kan göra att du svimmar. Gör den aldrig i vatten, i badkaret eller när du kör bil. ' +
  'Kallt vatten och het bastu belastar hjärtat och blodtrycket. Var försiktig vid hjärtproblem, ' +
  'graviditet och efter alkohol, och bada aldrig ensam i kallt vatten.';

const WARN_COLD =
  'Kallt vatten och het bastu belastar hjärtat och blodtrycket. Var försiktig vid hjärtproblem, ' +
  'graviditet och efter alkohol, och bada aldrig ensam i kallt vatten.';

// Källor som används av flera personer.
const SRAMEK_2000: Source = {
  title: 'Šrámek m.fl. 2000, kroppens svar på bad i vatten med olika temperatur (PubMed)',
  url: 'https://pubmed.ncbi.nlm.nih.gov/10751106/',
};
const SOBERG_2021: Source = {
  title: 'Søberg m.fl. 2021, brunt fett och värmeproduktion hos vinterbadande män (PubMed)',
  url: 'https://pubmed.ncbi.nlm.nih.gov/34755128/',
};
const SOBERG_2021_FULL: Source = {
  title: 'Søberg m.fl. 2021, hela artikeln i Cell Reports Medicine (PMC)',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8561167',
};
const SOBERG_HUBERMAN: Source = {
  title: 'Huberman Lab: Dr. Susanna Søberg om kyla och värme',
  url: 'https://www.hubermanlab.com/episode/dr-susanna-soberg-how-to-use-cold-and-heat-exposure-to-improve-your-health',
  summary: [
    'Søberg, som disputerade vid Köpenhamns universitet, berättar om sin forskning om hur kyla och värme påverkar ämnesomsättningen.',
    'De går igenom hur kyla och bastu kan påverka ämnesomsättning, hjärta, hjärna, hormoner och inflammation.',
    'Hon räknar fram att vinterbadarna i hennes studie kom upp i 11 minuter kallt vatten och 57 minuter bastu i veckan.',
    'Hon förklarar Søbergprincipen, att avsluta med kyla så att kroppen själv måste värma upp sig.',
    'De jämför kalla duschar med bad i kallt vatten och vanlig bastu med infraröd.',
  ],
};
const HUBERMAN_COLD: Source = {
  title: 'Huberman Lab: vetenskapen om kyla (nyhetsbrev)',
  url: 'https://www.hubermanlab.com/newsletter/the-science-and-use-of-cold-exposure-for-health-and-performance',
  summary: [
    'Han sätter säkerheten först: aldrig farligt vatten, aldrig överandning före eller i vattnet, och hellre för varmt än för kallt i början.',
    'Han beskriver rätt temperatur som så kall att man vill upp men säkert kan stanna, och skriver att ju kallare vattnet är desto kortare tid behövs.',
    'Han skriver att kyla frisätter adrenalin, noradrenalin och dopamin och att det ger mer energi, fokus och bättre humör efteråt.',
    'Hans protokoll är 11 minuter i veckan fördelat på 2 till 4 korta pass, och att avsluta med kyla enligt Søbergprincipen.',
    'Han skriver att kallbad inom ungefär fyra timmar efter träning kan minska vinsten av träningen och att kyla sent på dagen kan störa sömnen.',
  ],
};
const FMF_COLD: Source = {
  title: 'FoundMyFitness: kallbad, kylbehandling och noradrenalin',
  url: 'https://foundmyfitness.com/episodes/cold-shock-norepinephrine',
  summary: [
    'Sidan förklarar hur kallbad och kylbehandling ger en kraftig frisättning av noradrenalin.',
    'Den beskriver kyla som hormesis, en mild stress som förbereder kroppen för större påfrestningar.',
    'Den tar upp möjliga effekter på blodsocker, blodfetter, inflammation, tankeförmåga och immunförsvar.',
    'Den jämför olika doser, från en timme i 14 grader till 20 sekunder i ungefär 4 grader.',
    'Den påpekar att forskningen är ung och att kyla har risker, särskilt utan tillsyn.',
  ],
};
const ATOMIC_SUMMARY: Source = {
  title: 'Sammanfattning av Atomic Habits (jamesclear.com)',
  url: 'https://jamesclear.com/atomic-habits-summary',
  summary: [
    'Boken menar att små förbättringar varje dag växer som ränta på ränta, och att en procent bättre om dagen i ett år blir ungefär 37 gånger bättre.',
    'Clear menar att systemet, alltså de vanor och processer som leder dit, betyder mer än själva målen.',
    'Han menar att vanor som bygger på identitet håller bäst, och kallar varje handling en röst för den person man vill bli.',
    'En vana har enligt boken fyra steg: signal, begär, handling och belöning.',
    'De fyra lagarna för nya vanor är att göra dem synliga, lockande, lätta och tillfredsställande.',
  ],
};
const MW_CLEAR: Source = {
  title: 'Modern Wisdom #064: James Clear om vanor som håller',
  url: 'https://chriswillx.com/064-james-clear-how-to-build-habits-that-last/',
  summary: [
    'Chris Williamson intervjuar James Clear om boken Atomic Habits, som han kallar sin mest rekommenderade bok 2019.',
    'Avsnittet handlar om hur man bygger nya vanor och bryter gamla.',
    'Utgångspunkten är att framgång och misslyckande är eftersläpande mått på det man gör varje dag, och att vanorna styr de handlingarna.',
    'De pratar också om hur man hittar sin passion och kopplar den till ett syfte.',
  ],
};
const ALMAHAYNI_2024: Source = {
  title: 'Almahayni och Hammond 2024, systematisk genomgång av Wim Hof-metoden i PLOS ONE (PMC)',
  url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10936795',
};
const LAUKKANEN_2015: Source = {
  title: 'Laukkanen m.fl. 2015, bastu och dödlighet, JAMA Internal Medicine (PubMed)',
  url: 'https://pubmed.ncbi.nlm.nih.gov/25705824/',
};
const FMF_LAUKKANEN: Source = {
  title: 'FoundMyFitness: Rhonda Patrick intervjuar Jari Laukkanen om bastu',
  url: 'https://www.foundmyfitness.com/episodes/jari-laukkanen',
  summary: [
    'Laukkanen berättar om studien där över 2 300 medelålders män i östra Finland följdes i ungefär 20 år.',
    'Män som bastade 2 till 3 gånger i veckan hade 27 procent lägre dödlighet i hjärt-kärlsjukdom än de som bastade en gång, och de som bastade 4 till 7 gånger hade 50 procent lägre.',
    'För död av alla orsaker var skillnaden 24 och 40 procent, och för Alzheimers ungefär 65 procent i gruppen som bastade oftast.',
    'I avsnittet säger Laukkanen att minst 20 minuter i 79 grader 4 till 7 gånger i veckan var det läge som hängde ihop med lägst risk i de finska sambandsstudierna.',
    'De pratar om möjliga förklaringar som lägre blodtryck och värmechockproteiner, och Laukkanen varnar för kallbad efter bastun för den som har ett instabilt hjärta.',
  ],
};

export const PEOPLE: Person[] = [
  {
    id: 'wim-hof',
    name: 'Wim Hof',
    kind: 'Utövare',
    areas: ['andning'],
    teaser: 'Andning, kyla och fokus: metoden som fick forskare att mäta immunförsvaret.',
    about:
      'Wim Hof är en nederländsk utövare som blivit känd för att tåla extrem kyla. Han har byggt en metod av ' +
      'andning, kallbad och träget övande, och har låtit forskare mäta vad som händer i kroppen. ' +
      'Han forskar inte själv, och hans egna löften går längre än studierna visar.',
    method: [
      'Andning i omgångar: kraftiga andetag in, avslappnat ut, och sedan en lång andhållning.',
      'Kyla: kalla duschar eller isbad som ökas långsamt.',
      'Engagemang: att hålla fast vid övningen över tid.',
    ],
    claims: [
      {
        text:
          'I en studie fick 24 friska män antingen tio dagars träning i andning, kyla och meditation eller ingen ' +
          'träning. De tränade fick mer adrenalin i blodet, färre influensalika symtom och lägre inflammation när ' +
          'de fick ett ämne från bakterier som framkallar en tillfällig immunreaktion.',
        evidence: 'svagt',
        summary: [
          'Forskare vid Radboud universitetssjukhus i Nederländerna lottade 24 friska män i åldern 19 till 27 år ' +
            'till två lika stora grupper. Tolv tränade i tio dagar meditation, andning med upprepad överandning ' +
            'och andhållning samt kyla, bland annat bad i iskallt vatten. Tolv tränade inte alls.',
          'Sedan fick alla en dos bakteriegift i blodet, som ger en kort inflammation och ' +
            'influensaliknande symtom. Medan de tränade andades enligt metoden steg adrenalinet kraftigt. I deras blod ' +
            'steg det inflammationsdämpande ämnet IL-10 snabbare och högre, och tre ämnen som driver ' +
            'inflammation låg lägre.',
          'En senare genomgång anger att IL-10 var 194 procent högre och att de tre ämnena var 51 till 57 ' +
            'procent lägre än i gruppen som inte tränat. De tränade kände också mindre av symtomen.',
        ],
        note:
          'Slumpad studie men liten, bara unga män och ett konstgjort test i labbet. Den visar inte att metoden ' +
          'skyddar mot sjukdom i vardagen.',
        sources: [
          {
            title: 'Kox m.fl. 2014, frivillig påverkan på nervsystem och immunförsvar, PNAS (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/24799686/',
          },
          ALMAHAYNI_2024,
        ],
      },
      {
        text:
          'När forskare testade Wim Hof själv dämpades immunreaktionen och han fick höga halter av stresshormoner, ' +
          'som om han själv kunde starta en kontrollerad stressreaktion.',
        evidence: 'svagt',
        summary: [
          'Forskarna gjorde två försök med Wim Hof. I det första låg han 80 minuter i is medan han använde sin ' +
            'teknik för koncentration och meditation. Blod togs före och efter, och hans vita blodkroppar ' +
            'utsattes för bakterieämne i provrör. Efter isbadet blev svaret kraftigt mindre, både av ämnen som ' +
            'driver inflammation och av dämpande ämnen, och kortisolet var högt.',
          'I det andra försöket fick han bakterieämnet direkt i blodet. Han fick mer adrenalin och liknande ' +
            'hormoner, kortisolet blev högre än hos någon tidigare försöksperson, och både inflammationen och ' +
            'symtomen var påfallande låga jämfört med 112 personer som tidigare gjort samma försök.',
        ],
        note: 'Fallstudie på en enda person, jämförd med tidigare försökspersoner som inte använde tekniken.',
        sources: [
          {
            title: 'Kox m.fl. 2012, fallstudie om koncentration och meditation, Psychosomatic Medicine (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/22685240/',
          },
        ],
      },
      {
        text:
          'En systematisk genomgång av åtta studier om metoden fann tecken på mer adrenalin och lägre ' +
          'inflammation, men oklara effekter på träning och prestation.',
        evidence: 'svagt',
        summary: [
          'Två forskare sökte studier om Wim Hof-metoden publicerade från 2014 till juli 2022. Nio artiklar från ' +
            'åtta försök kom med. Varje studie hade 15 till 48 deltagare, och 86,4 procent av alla deltagare var män.',
          'Det tydligaste fyndet gällde inflammation. Andningen höjde adrenalinet, och det följdes av mer av det ' +
            'dämpande ämnet IL-10 och mindre av ämnen som driver inflammation, både hos friska och hos patienter ' +
            'med en inflammatorisk ryggsjukdom. När andningen gjordes före träning blev resultaten för prestation ' +
            'och andning blandade.',
          'Nästan alla de slumpade studierna bedömdes ha hög risk för snedvridning, bland annat för att deltagarna ' +
            'visste vilken grupp de var i. Författarna vill se fler studier på personer med inflammatoriska sjukdomar.',
        ],
        note: 'Författarna bedömde att studierna höll mycket låg kvalitet och att alla resultat ska tolkas försiktigt.',
        sources: [
          ALMAHAYNI_2024,
          {
            title: 'Samma genomgång hos tidskriften PLOS ONE',
            url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286933',
          },
        ],
      },
      {
        text:
          'Wim Hof menar att den som övar regelbundet får mer energi, sover bättre och klarar stress bättre.',
        evidence: 'asikt',
        summary: [
          'På metodens egen sida beskrivs andningen så här: ungefär 30 djupa andetag, sedan håller man andan ' +
            'efter sista utandningen tills kroppen själv vill andas, tar ett djupt andetag och håller det 10 till ' +
            '15 sekunder. Omgången görs 3 till 4 gånger. Sidan säger att yrsel och stickningar är vanligt och att ' +
            'man aldrig ska öva i vatten, i duschen eller när man kör bil.',
          'För kylan föreslår sidan 30 sekunder kallt vatten i slutet av duschen och lite mer varje vecka. Med ' +
            'tiden ska man enligt sidan vakna lättare, sova djupare och få jämnare energi. Den tredje delen, ' +
            'tankesättet, handlar om att märka obehag utan att genast reagera.',
        ],
        note: 'Det här är metodens egna löften. De har inte prövats i stora oberoende studier.',
        sources: [
          {
            title: 'Vad är Wim Hof-metoden? (wimhofmethod.com)',
            url: 'https://www.wimhofmethod.com/practice-the-method',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken The Wim Hof Method (förlaget Sounds True)',
        url: 'https://www.soundstrue.com/products/the-wim-hof-method-1',
        summary: [
          'Boken går igenom metodens tre delar: kyla, andning och tankesätt.',
          'Andningsövningarna ska enligt förlaget ge energi och skärpa fokus.',
          'Kylövningarna beskrivs som kontrollerade och utan chock för kroppen.',
          'Den återger studier om metoden och, enligt förlaget, berättelser från personer som använt den vid sjukdom.',
          'Den berättar också Wim Hofs egen historia.',
        ],
      },
    ],
    warning: WARN_BREATH_COLD,
  },
  {
    id: 'susanna-soberg',
    name: 'Susanna Søberg',
    kind: 'Forskare',
    areas: ['kallbad'],
    teaser: 'Dansk forskare om vinterbad, bastu och brunt fett. Avsluta med kyla.',
    about:
      'Susanna Søberg är dansk forskare i ämnesomsättning. Vid Köpenhamns universitet har hon studerat ' +
      'vinterbadare som växlar mellan kallt vatten och bastu, och hon har skrivit boken Winter Swimming om ' +
      'hur kroppen reagerar på kyla och värme.',
    method: [
      'Vinterbad: kallt vatten och bastu i växling, flera gånger per tillfälle.',
      'Søbergprincipen: hon menar att man ska sluta med kyla och låta kroppen värma upp sig själv.',
      'Korta dopp: vinterbadarna i hennes studie låg i snitt under två minuter per dopp.',
    ],
    claims: [
      {
        text:
          'Unga män som vinterbadade och bastade regelbundet ökade sin värmeproduktion mer än en kontrollgrupp ' +
          'när de kyldes ner, trots att det bruna fettet aktiverades ungefär lika mycket i båda grupperna.',
        evidence: 'svagt',
        summary: [
          'Søberg och kollegor vid Köpenhamns universitet jämförde 8 unga män som vinterbadade 2 till 3 gånger i ' +
            'veckan och var inne på minst sin andra säsong (7 kom med i analyserna) med 8 som inte gjorde det. ' +
            'Grupperna var lika i ålder, BMI och kondition, men vinterbadarna hade lägre fettprocent, 12 mot 18.',
          'När deltagarna kyldes ner med vattenfyllda filtar ökade vinterbadarnas värmeproduktion mer, och de ' +
            'förbrände fler kalorier. Omräknat till ett dygn låg förbrukningen under nedkylningen på 3 044 ' +
            'kilokalorier hos vinterbadarna och 2 560 hos de andra.',
          'Det bruna fettets sockerupptag och musklernas aktivitet ökade däremot ungefär lika mycket i båda ' +
            'grupperna. Forskarna föreslår vinterbad som ett sätt att öka energiförbrukningen, om man inte äter ' +
            'mer för att kompensera.',
        ],
        note:
          'Bara 7 vinterbadare och 8 i kontrollgruppen, alla män. Studien jämför grupper vid ett tillfälle och ' +
          'kan inte visa att det är badandet som orsakar skillnaden.',
        sources: [
          SOBERG_2021,
          {
            title: 'Köpenhamns universitet om studien',
            url: 'https://cbmr.ku.dk/news/2021/winter-swimming-scandinavian-men-can-teach-us-how-the-body-adapts-to-extreme-heat-and-cold',
          },
        ],
      },
      {
        text:
          'Vinterbadarna hade lägre kroppstemperatur och inaktivt brunt fett när de inte frös. Forskarna tolkar ' +
          'det som att kroppens termostat ställts om.',
        evidence: 'svagt',
        summary: [
          'I samma studie mättes deltagarna också i ett läge där de varken frös eller svettades. Då hade ' +
            'vinterbadarna lägre temperatur inne i kroppen, och deras bruna fett tog inte upp något socker alls, ' +
            'medan kontrollgruppens bruna fett var aktivt. Forskarna hade väntat sig mer brunt fett hos ' +
            'vinterbadarna, inte mindre aktivitet.',
          'Under ett helt dygn i behaglig temperatur nådde vinterbadarna en lägre kroppstemperatur, och huden ' +
            'nära det bruna fettet hade en tydlig topp mellan halv fem och halv sex på morgonen. Forskarna ser ' +
            'det som tecken på att kroppen vant sig vid både kyla och värme, och att bastun kan bidra till den ' +
            'lägre temperaturen.',
        ],
        note: 'Samma lilla studie. Tolkningen om termostaten är en hypotes som behöver prövas mer.',
        sources: [SOBERG_2021, SOBERG_2021_FULL],
      },
      {
        text:
          'Vinterbadarna i studien låg i snitt ungefär 11 minuter i kallt vatten och satt ungefär 57 minuter i ' +
          'bastun per vecka.',
        evidence: 'svagt',
        summary: [
          'Siffrorna kommer från studiens tabell över vad de 7 vinterbadarna faktiskt gjorde månaden före ' +
            'försöken. De badade i snitt 2,6 gånger i veckan, doppade sig ungefär 2,6 gånger per tillfälle och ' +
            'låg i snitt 1,4 minuter per dopp. Sammanlagt blev det 11 minuter i kallt vatten och 57 minuter i ' +
            'bastu per vecka.',
          'I en intervju hos Andrew Huberman räknar Søberg fram samma siffror och säger att passen i vattnet ' +
            'kan vara 1 till 2 minuter så länge man kommer upp i 11 minuter i veckan. Huberman gör sedan om ' +
            'siffran till ett råd om minsta mängd kyla.',
        ],
        note:
          'Siffran är vad de 7 vinterbadarna i studien redan gjorde. Studien prövade inte olika mängder, så den ' +
          'visar inte att just den mängden behövs eller räcker.',
        sources: [SOBERG_2021_FULL, SOBERG_HUBERMAN],
      },
      {
        text:
          'Søberg menar att man ska avsluta med kyla för att få större nytta, eftersom kroppen då själv måste ' +
          'producera värme efteråt.',
        evidence: 'asikt',
        summary: [
          'I samtalet med Andrew Huberman förklarar Søberg att kroppen fortsätter att svalna en stund efter att ' +
            'man gått upp ur det kalla vattnet, eftersom blodet åter strömmar ut i den kalla huden. Kroppen får ' +
            'då värma upp sig själv, bland annat genom att huttra, och huttringen sätter igång det bruna fettet.',
          'Därför menar hon att man ska sluta med kyla och inte gå tillbaka in i bastun eller en varm dusch. ' +
            'Hon beskriver det som att kroppen då tränar i flera timmar efteråt. Huberman kallar regeln ' +
            'Søbergprincipen och säger att han själv brukar göra tvärtom.',
        ],
        note: 'Ett råd som bygger på hur kroppen fungerar, inte en jämförande studie.',
        sources: [SOBERG_HUBERMAN],
      },
      {
        text:
          'En genomgång av andra forskare (Espeland m.fl. 2022) fann tecken på att kallbad påverkar ' +
          'kroppsfettet och förbättrar insulinkänsligheten, men resultaten var blandade och de flesta studierna ' +
          'var små.',
        evidence: 'svagt',
        summary: [
          'Forskarna sökte i flera databaser efter studier om vad frivilliga bad i kallt vatten gör med hälsan ' +
            'och fann 104 relevanta studier. Många visade mätbara effekter på kroppens funktioner och blodvärden. ' +
            'En del gjordes på vana vinterbadare, andra på ovana personer eller på kallbad efter träning.',
          'Kallbad verkar minska eller omvandla kroppsfett och förbättra insulinkänsligheten, vilket enligt ' +
            'författarna kan skydda mot hjärt-kärlsjukdom och fetma. De beskriver också riskerna: köldchocken ' +
            'höjer puls, andning och blodtryck och kopplas till rytmrubbningar och drunkning.',
          'Om vinterbadare som grupp är friskare än andra är oklart, och författarna skriver att frågan kommer ' +
            'att fortsätta diskuteras tills fler säkra studier finns.',
        ],
        note:
          'Genomgången säger själv att små grupper, oftast ett kön och olika vattentemperatur gör det svårt att ' +
          'dra säkra slutsatser. Författarna skriver också att många av de hälsovinster som tillskrivs kallbad ' +
          'kanske inte beror på kylan utan på livsstil, socialt umgänge och inställning.',
        sources: [
          {
            title: 'Espeland m.fl. 2022, hälsoeffekter av frivilliga kallbad (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/36137565/',
          },
          {
            title: 'Samma genomgång, hela artikeln (PMC)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9518606',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken Winter Swimming, 2022 (förlagets text hos bokhandeln Booktopia)',
        url: 'https://booktopia.com.au/winter-swimming-susanna-soberg/book/9781529417463.html',
        summary: [
          'Boken skildrar traditioner med kallt vatten i Skandinavien och andra delar av världen, med många bilder.',
          'Søberg förklarar steg för steg vad köldchocken är och hur kroppen vänjer sig vid kallt vatten under en vintersäsong.',
          'Hon beskriver hur blodomlopp, hjärta, lungor, hud, immunförsvar, ämnesomsättning och psykisk hälsa påverkas.',
          'Hon förklarar särskilt hur det bruna fettet sätts igång av kylan.',
          'Bakgrunden är hennes egen forskning om fettminskning genom vinterbad.',
        ],
      },
      SOBERG_HUBERMAN,
    ],
    warning: WARN_COLD,
  },
  {
    id: 'jari-laukkanen',
    name: 'Jari Laukkanen',
    kind: 'Forskare',
    areas: ['kallbad'],
    teaser: 'Finsk hjärtläkare som följt tusentals bastubadare i över 20 år.',
    about:
      'Jari Laukkanen är kardiolog och professor vid Östra Finlands universitet. Hans grupp har följt ' +
      'tusentals personer från Kuopio i flera decennier och jämfört hur ofta de badar bastu med hur deras ' +
      'hälsa utvecklas.',
    method: [
      'Följa stora grupper i många år och jämföra de som bastar ofta med de som bastar sällan.',
      'Mäta blodtryck, puls och kärl före och efter ett bastubad för att förstå vad som händer i kroppen.',
      'Den traditionella finska bastun är utgångspunkten, ofta 4 till 7 gånger i veckan i grupperna med lägst risk.',
    ],
    claims: [
      {
        text:
          'Bland 2 315 finska män som följdes i ungefär 20 år hade de som bastade 4 till 7 gånger i veckan lägre ' +
          'risk att dö av hjärtsjukdom och av alla orsaker än de som bastade en gång i veckan.',
        evidence: 'belagt',
        summary: [
          'Studien bygger på Kuopiostudien om hjärtsjukdom: ett urval av 2 315 män mellan 42 och 60 år från ' +
            'östra Finland som undersöktes 1984 till 1989. Männen fick uppge hur ofta och hur länge de bastade och ' +
            'följdes sedan i median 20,7 år.',
          'Under tiden dog 929 av männen. Bland dem som bastade en gång i veckan dog 49,1 procent, bland dem som ' +
            'bastade 4 till 7 gånger 30,8 procent. Efter justering för andra riskfaktorer var risken för plötslig ' +
            'hjärtdöd ungefär 63 procent lägre i den gruppen, och sambanden var liknande för död i hjärtsjukdom ' +
            'och död av alla orsaker.',
          'Längre bad, över 19 minuter, hängde också ihop med lägre risk för hjärtdöd men inte för död av alla ' +
            'orsaker. Forskarna skriver att fler studier behövs för att förstå varför.',
        ],
        note:
          'Stor studie med lång uppföljning, men den är observerande: den visar ett samband, inte att bastun är ' +
          'orsaken. Bara medelålders män från östra Finland.',
        sources: [LAUKKANEN_2015],
      },
      {
        text:
          'I samma grupp män hade de som bastade 4 till 7 gånger i veckan lägre risk för demens och Alzheimers ' +
          'sjukdom än de som bastade en gång i veckan.',
        evidence: 'belagt',
        summary: [
          'Forskarna använde samma 2 315 till synes friska män från Kuopio, undersökta 1984 till 1989 och följda ' +
            'i median 20,7 år. Under den tiden fick 204 av dem diagnosen demens och 123 diagnosen Alzheimers sjukdom.',
          'Efter justering för bland annat ålder, alkohol, vikt, blodtryck, rökning, diabetes och tidigare ' +
            'hjärtinfarkt var risken för demens 66 procent lägre för dem som bastade 4 till 7 gånger i veckan än ' +
            'för dem som bastade en gång. För Alzheimers var den 65 procent lägre. För 2 till 3 gånger i veckan ' +
            'var skillnaden mindre och inte säker.',
          'Forskarna skriver att det är den första studien om bastu och minnessjukdomar och att mekanismerna ' +
            'behöver studeras.',
        ],
        note: 'Observerande studie med samband, inte bevisad orsak. Bara män.',
        sources: [
          {
            title: 'Laukkanen m.fl. 2017, bastu och demens, Age and Ageing (Bristols universitet)',
            url: 'https://research-information.bris.ac.uk/en/publications/sauna-bathing-is-inversely-associated-with-dementia-and-alzheimer/',
          },
        ],
      },
      {
        text:
          'Bland 1 628 män och kvinnor hade de som bastade 4 till 7 gånger i veckan ungefär 60 procent lägre risk ' +
          'för stroke, även när man tagit hänsyn till motion, blodtryck och annat.',
        evidence: 'belagt',
        summary: [
          'Här följdes 1 628 män och kvinnor mellan 53 och 74 år ur samma Kuopiostudie, ingen av dem med tidigare ' +
            'stroke. De delades in efter om de bastade en gång, 2 till 3 gånger eller 4 till 7 gånger i veckan. ' +
            'Under i median 14,9 år fick 155 personer stroke.',
          'Jämfört med en gång i veckan var risken 61 procent lägre för 4 till 7 gånger, och det sambandet höll ' +
            'även efter justering för ålder, kön, diabetes, vikt, blodfetter, alkohol, motion och socioekonomisk ' +
            'ställning. För 2 till 3 gånger anger universitetet 14 procent lägre risk, men den skillnaden ' +
            'redovisas inte som säker.',
          'Forskarna tror att lägre blodtryck, påverkan på immunförsvaret och nervsystemet och bättre ' +
            'fungerande hjärta och kärl kan ligga bakom.',
        ],
        note: 'Observerande studie. Sambandet var lika starkt för kvinnor och män.',
        sources: [
          {
            title: 'Östra Finlands universitet om studien i Neurology 2018',
            url: 'https://uef.fi/en/news/frequent-sauna-bathing-reduces-risk-of-stroke',
          },
          {
            title: 'Kunutsor m.fl. 2018, bastu och stroke (Bristols universitet)',
            url: 'https://research-information.bris.ac.uk/en/publications/sauna-bathing-reduces-the-risk-of-stroke-in-finnish-men-and-women/',
          },
        ],
      },
      {
        text:
          'Direkt efter 30 minuter i bastu sjönk blodtrycket och kärlen blev mindre stela hos 100 personer, ' +
          'medan pulsen steg ungefär som vid måttlig träning.',
        evidence: 'svagt',
        summary: [
          'Forskargruppen lät 100 personer, kunder hos en vårdgivare, sitta 30 minuter i en finsk bastu och mätte ' +
            'före, direkt efter och efter 30 minuters vila. Det övre blodtrycket sjönk i snitt från 137 till 130 ' +
            'och det nedre från 82 till 75, och det övre låg kvar lägre efter vilan.',
          'Pulsvågens hastighet, ett mått på hur stela kärlen är, sjönk från 9,8 till 8,6 meter per sekund. ' +
            'Under badet steg pulsen ungefär som vid måttlig träning och kroppstemperaturen med ungefär 2 grader. ' +
            'Forskarna menar att det kan förklara sambanden i befolkningsstudierna, men att fler försök behövs.',
        ],
        note:
          'Samma personer mättes före och efter ett enda pass, utan jämförelsegrupp. Studien gjordes i bastur från ' +
          'en tillverkare som var partner i projektet.',
        sources: [
          {
            title: 'Östra Finlands universitet om studien',
            url: 'https://www.uef.fi/en/article/scientists-uncover-why-sauna-bathing-is-good-for-your-health',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Laukkanen m.fl. 2018, genomgång av bastu och hälsa, Mayo Clinic Proceedings (Bristols universitet)',
        url: 'https://research-information.bris.ac.uk/en/publications/875f218f-f6a3-46e8-bdbc-ea005e174ab9',
        summary: [
          'Genomgången samlar befolkningsstudier, försök och behandlingsstudier om finsk bastu som publicerats fram till februari 2018.',
          'Bastu kopplas där till lägre risk för högt blodtryck, hjärt-kärlsjukdom, minnessjukdomar och lungsjukdomar och till lägre dödlighet.',
          'Den tar också upp studier om lindring vid ledsjukdom, huvudvärk och influensa.',
          'Författarna beskriver möjliga förklaringar som bättre kärlfunktion, mindre stela artärer, påverkan på nervsystemet, blodfetterna och ett lägre blodtryck.',
          'Den pekar också ut vad som fortfarande är osäkert och vad det betyder för vården.',
        ],
      },
      FMF_LAUKKANEN,
    ],
    warning: WARN_COLD,
  },
  {
    id: 'andrew-huberman',
    name: 'Andrew Huberman',
    kind: 'Forskare och poddare',
    areas: ['andning', 'kallbad'],
    teaser: 'Hjärnforskare och poddare med konkreta råd om andning och kyla.',
    about:
      'Andrew Huberman är forskare i neurobiologi vid Stanford och driver podden Huberman Lab. Hans egen ' +
      'forskning gäller främst synen och hur stress, syn och andning påverkar hjärnans tillstånd, men i podden ' +
      'pratar han ofta om områden utanför sitt eget.',
    method: [
      'Cyklisk suck: andning med långa utandningar, fem minuter om dagen.',
      'Kyla i korta pass utspridda över veckan i stället för ett långt pass.',
      'Han gör om forskning till dagliga rutiner som han kallar protokoll.',
    ],
    claims: [
      {
        text:
          'I hans grupps studie gav fem minuter cyklisk suck om dagen i en månad bättre humör och lugnare ' +
          'andning än lika lång tid mindfulnessmeditation.',
        evidence: 'svagt',
        summary: [
          'Studien gjordes på distans av forskare vid Stanford, med Huberman som en av författarna. 108 vuxna, ' +
            'de flesta studenter, lottades till fem minuter om dagen i en månad av antingen mindfulnessmeditation ' +
            'eller en av tre andningsövningar: cyklisk suck med långa utandningar, boxandning med lika långa ' +
            'faser, eller snabb andning följd av andhållning.',
          'Alla grupper kände sig mindre oroliga efter övningarna. Andningsgrupperna, och mest cyklisk suck, fick ' +
            'en större ökning av positiva känslor än meditationsgruppen, och skillnaden växte ju fler dagar de ' +
            'övat. Andningsfrekvensen i vila, mätt med ett armband, sjönk också mer. Sömnen ändrades inte i någon grupp.',
          'Forskarna skriver själva att studien var tänkt som en förstudie inför en större prövning och att ' +
            'grupperna var små.',
        ],
        note:
          'Slumpad studie med 108 deltagare, men en enda studie från hans eget labb, och de positiva känslorna ' +
          'rapporterades av deltagarna själva.',
        sources: [
          {
            title: 'Balban m.fl. 2023, korta andningsövningar och humör, Cell Reports Medicine (PMC)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947',
          },
        ],
      },
      {
        text:
          'Han rekommenderar ungefär 11 minuter kyla i veckan totalt, fördelat på två till fyra korta pass.',
        evidence: 'asikt',
        summary: [
          'I sitt nyhetsbrev om kyla föreslår Huberman 11 minuter i veckan totalt, fördelat på 2 till 4 pass om ' +
            '1 till 5 minuter. Enligt honom ska vattnet vara så kallt att man vill upp men ändå säkert kan stanna. Han kallar ' +
            'det ett minimum och skriver att siffran bygger på en ny studie.',
          'I hans samtal med Susanna Søberg framgår att det är hennes studie, där 11 minuter var vad vinterbadarna ' +
            'själva råkade göra. Han skriver också att man kan avsluta med kyla och låta kroppen värma upp sig ' +
            'själv för större effekt på ämnesomsättningen, och att kallbad strax efter träning kan minska vinsten ' +
            'av träningen.',
        ],
        note:
          'Siffran är vad vinterbadarna i Søbergs lilla studie redan gjorde. Studien prövade inte olika mängder, ' +
          'så den visar inte att just den mängden behövs eller räcker.',
        sources: [HUBERMAN_COLD, SOBERG_HUBERMAN, SOBERG_2021_FULL],
      },
      {
        text:
          'Han lyfter fram att kallt vatten ger en stor ökning av dopamin och noradrenalin som han beskriver som ' +
          'långvarig. I en studie där unga män låg en timme i 14 grader varmt vatten var noradrenalin 530 ' +
          'procent och dopamin 250 procent högre än före badet.',
        evidence: 'svagt',
        summary: [
          'I nyhetsbrevet skriver Huberman att kyla frisätter adrenalin och noradrenalin, som gör en vaken och ' +
            'kan ge energi och fokus en tid efteråt. Han skriver också att kyla ger en långvarig ökning av ' +
            'dopamin och hänvisar till en studie där människor låg ungefär en timme i vatten på omkring 15 grader.',
          'Studien från 2000 lät unga män ligga en timme i vatten på 32, 20 och 14 grader. Bara vid 14 grader ' +
            'steg noradrenalin och dopamin, medan adrenalinet inte ändrades. Ämnesomsättningen steg med 350 ' +
            'procent och puls och blodtryck steg något.',
          'Nyhetsbrevet namnger inte studien, så kopplingen till just den här görs här i Lär.',
        ],
        note:
          'En liten studie med unga män som låg en hel timme i vattnet, mycket längre än de korta pass han ' +
          'själv föreslår.',
        sources: [SRAMEK_2000, HUBERMAN_COLD],
      },
    ],
    startHere: [HUBERMAN_COLD, SOBERG_HUBERMAN],
    warning: WARN_BREATH_COLD,
  },
  {
    id: 'rhonda-patrick',
    name: 'Rhonda Patrick',
    kind: 'Forskare och poddare',
    areas: ['kallbad'],
    teaser: 'Biomedicinsk forskare som förklarar vad bastu och kyla gör i cellerna.',
    about:
      'Rhonda Patrick har en doktorsexamen i biomedicin och driver sajten och podden FoundMyFitness. ' +
      'Hon sammanfattar studier och intervjuar forskare som Jari Laukkanen. Hon pratar ofta om bastu som ' +
      'ett sätt att belasta kroppen ungefär som träning.',
    method: [
      'Bastu efter träningen, som hon själv brukar göra.',
      'Förklara mekanismer: värmechockproteiner efter bastu och noradrenalin efter kyla.',
      'Bygga på stora befolkningsstudier och säga när forskningen ännu är ung.',
    ],
    claims: [
      {
        text:
          'Hon lyfter fram de finska studierna där män som bastade ofta hade lägre risk att dö av hjärtsjukdom ' +
          'och lägre risk för demens.',
        evidence: 'belagt',
        summary: [
          'I intervjun med Jari Laukkanen går hon igenom Kuopiostudien med över 2 300 medelålders män. Den som ' +
            'bastade 2 till 3 gånger i veckan hade 27 procent lägre risk att dö av hjärt-kärlsjukdom än den som ' +
            'bastade en gång, och 4 till 7 gånger gav 50 procent lägre risk. För död av alla orsaker var ' +
            'skillnaden 24 och 40 procent.',
          'De tar också upp att männen som bastade oftast hade ungefär 65 procent lägre risk för Alzheimers. ' +
            'Själv är hon mest intresserad av värmechockproteiner, som hon tror kan vara en av förklaringarna.',
        ],
        note: 'Stora observerande studier som visar samband, inte bevisad orsak. Mest män från östra Finland.',
        sources: [
          {
            title: 'FoundMyFitness: klipp om bastu och lägre risk för hjärtsjukdom och demens',
            url: 'https://www.foundmyfitness.com/episodes/sauna-use-decreased-risk-of-heart-and-neurodegenerative-diseases',
          },
          FMF_LAUKKANEN,
          LAUKKANEN_2015,
        ],
      },
      {
        text:
          'Hon beskriver bastu som en belastning på hjärtat som liknar måttlig träning. I en studie med 19 ' +
          'personer steg puls och blodtryck i bastun till samma nivå som vid ett arbetsprov med måttlig belastning, och ' +
          'blodtrycket sjönk sedan under utgångsläget.',
        evidence: 'svagt',
        summary: [
          'På hennes sajt beskrivs hur pulsen stiger i bastun, upp till 150 slag i minuten, så att bastun på ' +
            'vissa sätt liknar måttlig konditionsträning. Laukkanen påpekar där att många av bastuns samband med ' +
            'hälsa liknar dem för träning.',
          'I studien satt 19 friska vuxna, varav 7 kvinnor och i snitt 46 år, 25 minuter i en bastu på 93 grader. ' +
            'Blodtryck och puls steg hela tiden under badet och sjönk sedan stadigt, och efter badet låg ' +
            'blodtrycket lägre än före. Belastningen på hjärtat motsvarade ett arbetsprov med måttlig belastning, 60 till 100 watt.',
        ],
        note: 'Liten studie som bara mätte direkt under och efter ett pass. Ingen visar att bastu ersätter träning.',
        sources: [
          FMF_LAUKKANEN,
          {
            title: 'Ketelhut och Ketelhut 2019, blodtryck och puls i bastun (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/31126559/',
          },
        ],
      },
      {
        text:
          'Hon menar att värmen i bastun ökar värmechockproteiner, som hjälper cellerna att hålla proteiner i ' +
          'rätt form, och att det kan bidra till att bevara muskler.',
        evidence: 'svagt',
        summary: [
          'I ett klipp från en intervju berättar hon om en studie där bastu efter hård träning minskade ' +
            'träningsvärken och förbättrade styrkan. I en annan studie fick personer som hölls orörliga i en ' +
            'vecka lokal värme eller inte, och värmen minskade muskelförlusten med ungefär 40 procent.',
          'Hon tror att det främst beror på värmechockproteiner och tillväxthormon, och säger att djurstudier ' +
            'visat att skyddet hängde på värmechockproteinerna. Hon nämner också studier där 30 minuter i ' +
            'ungefär 73 grader höjde värmechockproteinerna med 50 procent och att de kan vara förhöjda i ungefär ' +
            '48 timmar.',
        ],
        note:
          'Mekanismen är rimlig, men att den ger bättre hälsa på lång sikt är inte visat i stora studier med ' +
          'människor.',
        sources: [
          {
            title: 'FoundMyFitness: bastu, värme och muskelstyrka',
            url: 'https://foundmyfitness.com/episodes/sauna-use-and-heat-for-strength-preservation-anti-atrophy-effect-rhonda-patrick',
          },
        ],
      },
      {
        text:
          'Hon förklarar att kallt vatten ger en kraftig ökning av noradrenalin, och hänvisar till studien där en ' +
          'timme i 14 grader varmt vatten ökade noradrenalin med 530 procent.',
        evidence: 'svagt',
        summary: [
          'På hennes sida om kyla beskrivs hur kallbad och kylbehandling frisätter mycket noradrenalin, som ' +
            'sätter igång anpassningar i ämnesomsättningen, hjärnan och generna. Hon ser det som hormesis, en ' +
            'mild stress som gör kroppen tåligare mot större påfrestningar.',
          'Hon jämför olika sätt. En timme upp till halsen i 14 grader gav också 250 procent mer dopamin, medan ' +
            '20 sekunder i ungefär 4 grader ökade noradrenalinet med 200 till 300 procent. Sidan påpekar att ' +
            'forskningen är ung och att kyla har risker.',
        ],
        note: 'Bygger på en liten studie med långa pass i vattnet.',
        sources: [FMF_COLD, SRAMEK_2000],
      },
    ],
    startHere: [FMF_LAUKKANEN, FMF_COLD],
    warning: WARN_COLD,
  },
  {
    id: 'jon-kabat-zinn',
    name: 'Jon Kabat-Zinn',
    kind: 'Forskare',
    areas: ['meditation'],
    teaser: 'Grundade kursen MBSR för kroniskt sjuka patienter.',
    about:
      'Jon Kabat-Zinn grundade och ledde programmet för stresshantering vid University of Massachusetts ' +
      'Medical Center. Där startade han 1979 den åtta veckor långa kursen Mindfulness-Based Stress Reduction, ' +
      'MBSR, för kroniskt sjuka patienter. Kursen har sedan använts i många studier.',
    method: [
      'Mindfulness: att medvetet rikta uppmärksamheten mot nuet utan att döma det man märker.',
      'En kurs på åtta veckor, vanligen med åtta träffar.',
      'Övningar som kroppsskanning och meditation, som många deltagare fortsätter med i vardagen.',
    ],
    claims: [
      {
        text:
          'En stor genomgång av 47 slumpade studier med över 3 500 vuxna fann att program med mindfulness ' +
          'minskade ångest, nedstämdhet och smärta något.',
        evidence: 'belagt',
        summary: [
          'Forskare vid Johns Hopkins gick igenom 18 753 träffar fram till november 2012 och tog med 47 slumpade ' +
            'studier med sammanlagt 3 515 vuxna. Alla studier jämförde med en aktiv kontrollgrupp, så att ' +
            'förväntningar och uppmärksamhet inte ensamma skulle förklara resultatet.',
          'Program med mindfulness gav måttligt säkra förbättringar av ångest, nedstämdhet och smärta, och mindre ' +
            'säkra förbättringar av stress och psykisk livskvalitet. För positiva känslor, uppmärksamhet, missbruk, ' +
            'matvanor, sömn och vikt fanns ingen eller för lite effekt.',
          'Enligt NPR handlade det om ungefär två och en halv timmes övning i veckan, och kursen MBSR fanns med ' +
            'i många av studierna.',
        ],
        note:
          'Effekterna var små till måttliga, och det fanns inga belägg för att meditation var bättre än annan aktiv behandling som ' +
          'motion eller terapi.',
        sources: [
          {
            title: 'Goyal m.fl. 2014, meditation och stress, JAMA Internal Medicine (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/24395196/',
          },
          {
            title: 'Samma genomgång, hela artikeln (PMC)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4142584',
          },
          {
            title: 'NPR om genomgången',
            url: 'https://www.npr.org/blogs/health/2014/01/07/260470831/mindfulness-meditation-can-help-relieve-anxiety-and-depression',
          },
        ],
      },
      {
        text:
          'I hans tidiga studie med 90 patienter med långvarig smärta minskade smärtan, oron och behovet av ' +
          'smärtstillande efter kursen, medan en jämförelsegrupp inte blev bättre.',
        evidence: 'svagt',
        summary: [
          'Kabat-Zinn och kollegor lät 90 patienter med långvarig smärta gå ett tio veckor långt program för ' +
            'stressminskning och avslappning, med träning i mindfulnessmeditation.',
          'Efteråt hade de mindre smärta i stunden, en bättre bild av sin kropp, mindre begränsning av vad de ' +
            'kunde göra, färre symtom och mindre ångest och nedstämdhet. De tog mindre smärtstillande, var mer ' +
            'aktiva och fick bättre självkänsla, oavsett kön och typ av smärta. En jämförelsegrupp med vanlig ' +
            'smärtbehandling förbättrades inte.',
          'Upp till 15 månader senare höll förbättringarna i sig, utom för smärtan i stunden, och de flesta ' +
            'sade att de fortsatt meditera.',
        ],
        note:
          'Jämförelsegruppen fick vanlig behandling, och studien beskriver ingen lottning. Den gjordes av den som ' +
          'skapat kursen.',
        sources: [
          {
            title: 'Kabat-Zinn m.fl. 1985, mindfulness vid långvarig smärta (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/3897551/',
          },
        ],
      },
      {
        text:
          'Anställda som gick kursen fick ett starkare antikroppssvar på en influensavaccination än en grupp ' +
          'som fick vänta, och mätningar visade förändrad aktivitet i hjärnan.',
        evidence: 'svagt',
        summary: [
          'Forskarna lottade friska anställda på en arbetsplats till en åtta veckor lång klinisk kurs i ' +
            'mindfulnessmeditation eller till att vänta. Hjärnans elektriska aktivitet mättes före, direkt efter ' +
            'och fyra månader efter kursen, och när kursen var slut fick alla influensavaccin.',
          'De som mediterat fick mer aktivitet i främre vänstra delen av hjärnan, ett mönster som tidigare ' +
            'kopplats till positiva känslor, och fler antikroppar mot vaccinet än de som väntade. Ju större ' +
            'förändringen i hjärnan var, desto större blev ökningen av antikroppar.',
        ],
        note:
          'Liten studie med 25 i kursen och 16 som väntade. Forskarna efterlyste mer forskning. Kabat-Zinn var en ' +
          'av författarna.',
        sources: [
          {
            title: 'Davidson m.fl. 2003, meditation, hjärna och immunförsvar (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/12883106/',
          },
        ],
      },
      {
        text:
          'Han beskriver mindfulness som uppmärksamhet med avsikt, i nuet och utan att döma, och lägger ibland ' +
          'till att det sker för att förstå sig själv och bli klokare.',
        evidence: 'asikt',
        summary: [
          'Tidningen Mindful berättar att han 1979 tog in kroniskt sjuka patienter som inte blev hjälpta av vanlig ' +
            'vård i sitt nya program på åtta veckor, det som i dag kallas MBSR. För NPR har han beskrivit ' +
            'metoden som buddhistisk meditation utan buddhismen, helt världslig.',
          'En av hans huvudtankar är att vi tar oss själva på för stort allvar, eftersom vi tror att det finns ' +
            'ett jag att ta på allvar. Berättelsen om mig är enligt honom en konstruktion, och när vi släpper den ' +
            'finns bara nuet kvar.',
          'Kroppen andas av sig själv, så det medvetna är vår uppmärksamhet på andningen. Att lägga märke till, ' +
            'vara tacksam och vara vaken ger enligt honom en levande känsla som inte fanns där förut.',
        ],
        sources: [
          {
            title: 'Kabat-Zinn om hur han definierar mindfulness (Mindful)',
            url: 'https://www.mindful.org/jon-kabat-zinn-defining-mindfulness/',
          },
          {
            title: 'NPR om mindfulness och kursen MBSR',
            url: 'https://www.npr.org/blogs/health/2014/01/07/260470831/mindfulness-meditation-can-help-relieve-anxiety-and-depression',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken Full Catastrophe Living, 1990 (recension i Publishers Weekly)',
        url: 'https://www.publishersweekly.com/9780385298971',
        summary: [
          'Boken bygger på programmet för stresshantering som Kabat-Zinn grundade och ledde vid University of Massachusetts Medical Center.',
          'Ämnet är hela spektrumet av stress i livet och hur medveten närvaro kan lugna reaktionerna utan att trubba av känslorna.',
          'Först förklarar han hur man lägger upp ett schema för meditation, och sedan använder han det på de vanligaste källorna till stress.',
          'En del i mitten går igenom vetenskapliga och anekdotiska belägg för hur sinnestillstånd hänger ihop med hälsa.',
          'Enligt recensenten lovar han inte för mycket om vad meditation kan läka.',
        ],
      },
    ],
  },
  {
    id: 'sam-harris',
    name: 'Sam Harris',
    kind: 'Författare och poddare',
    areas: ['meditation'],
    teaser: 'Neuroforskaren som lär ut meditation utan religion i appen Waking Up.',
    about:
      'Sam Harris har en examen i filosofi från Stanford och en doktorsexamen i neurovetenskap från UCLA. Han ' +
      'har mediterat i mer än 30 år och studerat för lärare från Tibet, Indien, Burma och västvärlden. Han har ' +
      'skrivit fem bästsäljare på New York Times lista och leder podden Making Sense. Han skriver och föreläser ' +
      'också om många andra ämnen. År 2018 grundade han meditationsappen Waking Up.',
    method: [
      'En introduktionskurs i appen Waking Up med en kort meditation och en kort lektion från honom varje dag i en månad.',
      'En ny guidad meditation från honom varje dag, och en timer för den som vill sitta utan vägledning.',
      'Teori vid sidan av övningen: föredrag och arkivinspelningar med kända lärare om filosofin bakom meditationen.',
      'Vipassana, en teknik från den äldsta grenen av buddhismen som han menar går att lära ut helt världsligt.',
    ],
    claims: [
      {
        text:
          'Han menar att mindfulness är en färdighet i uppmärksamhet som går att träna utan att tro på något, ' +
          'och han föreslår vipassana för nybörjare.',
        evidence: 'asikt',
        summary: [
          'I sin text om hur man mediterar skriver Harris att många av hans läsare oroar sig för att meditation ' +
            'kräver religiös tro. Han menar att det finns metoder som kan öka välbefinnandet utan att man behöver ' +
            'tro på något utan tillräckliga skäl.',
          'Vipassana betyder insikt och kommer från Theravada, den äldsta grenen av buddhismen. Fördelen är enligt ' +
            'honom att den kan läras ut helt världsligt. Mindfulness beskriver han som en öppen uppmärksamhet på ' +
            'allt som dyker upp i medvetandet, behagligt eller obehagligt, utan att döma och utan att fastna i ' +
            'tankar om det.',
          'Han skriver att övningen är mycket enkel att beskriva men inte alls lätt, och att verklig skicklighet ' +
            'kanske kräver talang och ett helt liv. Hans app Waking Up beskriver sig som världslig, utan krav på tro.',
        ],
        sources: [
          {
            title: 'Sam Harris om hur man mediterar (samharris.org, 2011)',
            url: 'https://www.samharris.org/blog/how-to-meditate',
          },
          {
            title: 'Waking Up, frågor och svar på startsidan',
            url: 'https://www.wakingup.com/',
          },
        ],
      },
      {
        text:
          'Han menar att problemet inte är tankarna utan att tänka utan att veta om att man tänker, och att ' +
          'meditation tränar förmågan att se en tanke som just en tanke.',
        evidence: 'asikt',
        summary: [
          'Harris liknar mindfulness vid att gå på lina. Att falla är att försvinna in i tankar, och det händer ' +
            'enligt honom hela tiden, i glada dagdrömmar lika väl som i rädsla, ilska och självförakt. Han menar ' +
            'att det är sinnets normala tillstånd.',
          'Hans instruktion går ut på att sitta bekvämt med rak rygg, blunda och låta uppmärksamheten vila i ' +
            'känslan av andningen, vid näsan eller i magen, utan att styra den. Ljud, känslor i kroppen och andra ' +
            'intryck får komma och gå. När den som mediterar märker att den har tappat bort sig i en tanke blir ' +
            'själva tanken något att iaktta, och sedan går uppmärksamheten tillbaka till andningen.',
          'Waking Up beskriver samma sak: meditation tränar uppmärksamheten genom att lägga märke till tankarna ' +
            'när de kommer och går, utan att döma eller reagera.',
        ],
        sources: [
          {
            title: 'Sam Harris om hur man mediterar (samharris.org, 2011)',
            url: 'https://www.samharris.org/blog/how-to-meditate',
          },
          {
            title: 'Waking Up om mindfulness och meditation',
            url: 'https://www.wakingup.com/topic/understanding-mindfulness-and-meditation',
          },
        ],
      },
      {
        text:
          'Han menar att känslan av ett jag som sitter bakom ögonen är en illusion, och att den med träning i ' +
          'meditation går att se igenom.',
        evidence: 'asikt',
        summary: [
          'Harris skriver att både hjärnforskningen och flera kontemplativa traditioner ger skäl att se den ' +
            'vanliga känslan av ett jag som en sorts kognitiv illusion. Det finns enligt honom inget avgränsat jag ' +
            'i hjärnan och inget område som har en särskild ställning för vår person.',
          'Ändå känns det för de flesta som om de färdas runt inuti kroppen. Han jämför med den blinda fläcken i ' +
            'synfältet, som alltid finns där men sällan märks. På samma sätt krävs det för de flesta mycket ' +
            'träning i meditation för att märka att det som är medvetet inte känns som ett jag.',
          'På bokens sida skriver han att känslan av att titta ut bakom ögonen kan förändras eller försvinna ' +
            'helt, och att det är en klarare förståelse av hur saker är.',
        ],
        note: 'Han beskriver egna upplevelser och en tolkning av forskningen. Det är en tankegång, inte en studie.',
        sources: [
          {
            title: 'Sam Harris om ett medvetande utan jag (samharris.org, 2007)',
            url: 'https://www.samharris.org/blog/selfless-consciousness-without-faith',
          },
          {
            title: 'Boken Waking Up (bokens sida på samharris.org)',
            url: 'https://www.samharris.org/books/waking-up',
          },
        ],
      },
      {
        text:
          'Han menar att meditation är till för mer än att minska stress: att förstå sitt eget sinne och vakna ' +
          'ur vanan att tänka utan uppehåll.',
        evidence: 'asikt',
        summary: [
          'Harris skriver att målet är att vakna ur tänkandets trans och ur vanan att gripa efter det behagliga ' +
            'och dra sig undan det obehagliga, så att sinnet blir öppet och ostört av oro. Fördelarna kommer ' +
            'enligt honom långt innan man blivit skicklig.',
          'Hans app Waking Up skriver att många tror att meditation främst handlar om att bli lugnare, men att ' +
            'målet är att förstå sinnet. Den som ser att tankarna är tillfälliga får enligt appen mer utrymme ' +
            'mellan det som händer och reaktionen, och lidandet beskrivs som något som kommer ur tolkningen av ' +
            'händelser snarare än ur händelserna själva.',
          'I en äldre essä skriver han att alla söker lycka i en tillvaro som inte går att lita på, och att det ' +
            'kontemplativa livet har viktiga insikter om hur lycklig man kan bli.',
        ],
        sources: [
          {
            title: 'Sam Harris om hur man mediterar (samharris.org, 2011)',
            url: 'https://www.samharris.org/blog/how-to-meditate',
          },
          {
            title: 'Waking Up om mindfulness och meditation',
            url: 'https://www.wakingup.com/topic/understanding-mindfulness-and-meditation',
          },
          {
            title: 'Sam Harris om ett medvetande utan jag (samharris.org, 2007)',
            url: 'https://www.samharris.org/blog/selfless-consciousness-without-faith',
          },
        ],
      },
      {
        text:
          'Han skriver att mindfulness kan dämpa smärta, ångest och nedstämdhet. En stor genomgång av 47 ' +
          'slumpade studier fann små till måttliga förbättringar för just de tre.',
        evidence: 'belagt',
        summary: [
          'I sin text från 2011 skriver Harris att mindfulness har visats påverka smärta, minska ångest och ' +
            'nedstämdhet, förbättra tankeförmågan och förändra den grå substansen i delar av hjärnan. Han ' +
            'hänvisar till en enskild studie för varje effekt.',
          'En genomgång i JAMA Internal Medicine 2014 gick igenom 18 753 träffar och tog med 47 slumpade studier ' +
            'med sammanlagt 3 515 vuxna, alla med en aktiv kontrollgrupp. Program med mindfulness gav måttligt ' +
            'säkra förbättringar av ångest, nedstämdhet och smärta, och mindre säkra av stress och psykisk ' +
            'livskvalitet.',
          'För uppmärksamhet, positiva känslor, sömn, missbruk, matvanor och vikt fanns ingen eller för lite ' +
            'effekt, och det fanns inga belägg för att meditation var bättre än annan aktiv behandling som ' +
            'läkemedel, motion eller beteendeterapi.',
        ],
        note:
          'Genomgången stöder smärta, ångest och nedstämdhet men inte hans uppgifter om tankeförmåga och grå ' +
          'substans. De fem studier han hänvisar till är inte granskade här.',
        sources: [
          {
            title: 'Sam Harris om hur man mediterar (samharris.org, 2011)',
            url: 'https://www.samharris.org/blog/how-to-meditate',
          },
          {
            title: 'Goyal m.fl. 2014, meditation och stress, JAMA Internal Medicine (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/24395196/',
          },
          {
            title: 'Samma genomgång, hela artikeln (PMC)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4142584',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken Waking Up, 2014 (bokens sida på samharris.org)',
        url: 'https://www.samharris.org/books/waking-up',
        summary: [
          'Harris skriver att han velat skriva boken i mer än tio år, eftersom han länge intresserat sig för medvetandet och för andliga upplevelser.',
          'Han vill visa att en viss sorts andlighet hör till att förstå hur sinnet fungerar.',
          'Han menar att det inte finns något avgränsat jag i hjärnan, och att känslan av ett jag kan förändras eller försvinna.',
          'Syftet är att ge läsaren en klar bild av problemet och verktyg att lösa det själv.',
          'Psykologen Paul Bloom beskriver på samma sida boken som en memoar, en utforskning av jaget och en vägledning i att meditera.',
        ],
      },
      {
        title: 'Appen Waking Up (wakingup.com)',
        url: 'https://www.wakingup.com/',
        summary: [
          'Nybörjare börjar med en introduktionskurs som blandar daglig meditation med korta lektioner om teorin bakom.',
          'Varje dag finns en ny guidad meditation från Harris, och en timer för den som vill sitta utan vägledning.',
          'Appen beskriver sig som världslig, och ingen tro krävs.',
          'Förutom Harris finns över 100 lärare och mer än 600 timmar ljud, bland annat om zen, vipassana och stoicism.',
          'Appen är ett betalt årsabonnemang efter en gratis provperiod, och enligt sidan kan den som inte har råd få ett gratis medlemskap.',
        ],
      },
    ],
  },
  {
    id: 'james-clear',
    name: 'James Clear',
    kind: 'Författare',
    areas: ['utveckling'],
    teaser: 'Små vanor som växer över tid. Författaren till Atomic Habits.',
    about:
      'James Clear är författare och skriver om vanor och beslut. Hans bok Atomic Habits har enligt hans egen ' +
      'sida sålt i mer än 30 miljoner exemplar. Han forskar inte själv utan samlar idéer från forskning och andra författare ' +
      'och gör dem praktiska.',
    method: [
      'Fyra lagar för nya vanor: att göra dem synliga, lockande, lätta och tillfredsställande.',
      'Lagarna omvända för att bryta en dålig vana: att göra den osynlig, olockande, svår och otillfredsställande.',
      'Identitet först: varje handling ser han som en röst för den person man vill bli.',
      'Vanestapling: en ny vana kopplas direkt efter en man redan har.',
    ],
    claims: [
      {
        text:
          'Clear menar att små förbättringar varje dag växer som ränta på ränta. En procent bättre varje dag ' +
          'blir ungefär 37 gånger bättre på ett år.',
        evidence: 'asikt',
        summary: [
          'Clear beskriver ständig förbättring som att göra små ändringar varje dag och räkna med att de till ' +
            'slut blir något stort. Den vanliga vägen, ett stort mål och stora kliv, slutar enligt honom ofta i ' +
            'utbrändhet och misslyckande.',
          'Hans exempel är brittiska cykelförbundet, där Dave Brailsford letade efter en procents förbättring i ' +
            'allt från sadlar och däck till massagegel, kuddar och handtvätt. Fem år senare tog britterna 8 av ' +
            '14 guldmedaljer i cykel vid OS 2008.',
          'Han föreslår också att mäta bakåt, alltså att utgå från vad man gjorde förra veckan och bli lite ' +
            'bättre den här veckan, och att ofta förbättra genom att ta bort fel i stället för att lägga till mer.',
        ],
        note: 'Räkningen stämmer, men livet växer sällan så jämnt. Idén lånar han från Dave Brailsfords cykellag.',
        sources: [
          {
            title: 'Continuous Improvement (jamesclear.com)',
            url: 'https://jamesclear.com/continuous-improvement',
          },
          {
            title: 'Marginal Gains, om Brailsford och brittisk cykel (jamesclear.com)',
            url: 'https://jamesclear.com/marginal-gains',
          },
        ],
      },
      {
        text:
          'Den som bestämmer exakt när och var en sak ska göras blir mer benägen att göra den. En genomgång av 94 ' +
          'tester fann en måttlig till stor effekt av sådana planer.',
        evidence: 'belagt',
        summary: [
          'Peter Gollwitzer och Paschal Sheeran gick 2006 igenom 94 oberoende tester av planer där man i förväg ' +
            'bestämmer när, var och hur man ska göra något, ofta i formen om Y händer gör jag X. Planerna hade ' +
            'en måttlig till stor effekt på om folk nådde sina mål.',
          'De hjälpte folk att komma igång, att stå emot störningar, att släppa det som inte fungerade och att ' +
            'spara kraft till senare. Planen gjorde att man lättare såg tillfället och att handlingen kom mer ' +
            'automatiskt.',
          'Clear lyfter fram en brittisk studie med 248 personer där 91 procent av dem som skrivit ner dag, tid ' +
            'och plats tränade minst en gång i veckan, mot 35 till 38 procent i de andra grupperna.',
        ],
        note: 'Clear hänvisar till genomgången. Den brittiska studien han beskriver pågick bara i två veckor.',
        sources: [
          {
            title: 'Gollwitzer och Sheeran 2006, genomgång om när och var-planer (Konstanz universitet)',
            url: 'https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f',
          },
          {
            title: 'Implementation Intentions (jamesclear.com)',
            url: 'https://jamesclear.com/implementation-intentions',
          },
        ],
      },
      {
        text:
          'Clear menar att vanor fastnar bättre om de bygger på vem man vill vara än på vad man vill uppnå.',
        evidence: 'asikt',
        summary: [
          'Clear beskriver tre lager av förändring: resultat, alltså vad man får, process, alltså vad man gör, ' +
            'och identitet, alltså vad man tror om sig själv. De flesta börjar med resultatet. Han menar att det ' +
            'håller bättre att börja med vem man vill bli.',
          'Han beskriver två steg: att bestämma vem man vill vara och att bevisa det för sig själv med små ' +
            'vinster. Den som inte vet var den ska börja kan enligt honom utgå från resultatet och fråga vilken sorts person ' +
            'som skulle nå det. I sammanfattningen av boken kallar han varje handling en röst för den person man ' +
            'vill bli.',
        ],
        sources: [
          {
            title: 'Identity-Based Habits (jamesclear.com)',
            url: 'https://jamesclear.com/identity-based-habits',
          },
          ATOMIC_SUMMARY,
        ],
      },
      {
        text:
          'Clear menar att en ny vana blir lättare att komma ihåg om den hakas på direkt efter en befintlig. ' +
          'Idén kommer från BJ Foggs metod Tiny Habits.',
        evidence: 'asikt',
        summary: [
          'Clear förklarar att hjärnan stärker kopplingar som används ofta och rensar bort dem som inte används. ' +
            'Vanor man redan har är därför starka och kan bli utlösare för nya.',
          'Han kallar det att stapla vanor: efter en vana jag redan har gör jag den nya, till exempel byter om ' +
            'till träningskläder direkt efter att ha tagit av jobbskorna. Han ser det som en sorts plan för när ' +
            'och var, där den nya vanan kopplas till en gammal vana i stället för till en tid och plats.',
          'Metoden skapades enligt honom av BJ Fogg inom Tiny Habits. På Tiny Habits egen sida står att Clear ' +
            'själv gick deras gratis femdagarsprogram 2012.',
        ],
        sources: [
          {
            title: 'Habit Stacking (jamesclear.com)',
            url: 'https://jamesclear.com/habit-stacking',
          },
          {
            title: 'Tiny Habits, BJ Foggs femdagarsprogram (tinyhabits.com)',
            url: 'https://tinyhabits.com/join/',
          },
        ],
      },
    ],
    startHere: [ATOMIC_SUMMARY, MW_CLEAR],
  },
  {
    id: 'chris-williamson',
    name: 'Chris Williamson',
    kind: 'Poddare',
    areas: ['utveckling'],
    teaser: 'Poddaren bakom Modern Wisdom samlar idéer om lycka, driv och vanor.',
    about:
      'Chris Williamson driver podden Modern Wisdom, med tre avsnitt i veckan och över 900 avsnitt, och ' +
      'nyhetsbrevet 3 Minute Monday. Han forskar inte, utan intervjuar forskare och författare och samlar det ' +
      'han lärt sig i nyhetsbrevet.',
    method: [
      'Långa intervjuer med forskare, författare och idrottare.',
      'Varje måndag delar han i nyhetsbrevet saker han lärt sig.',
      'Han lånar gärna idéer från gästerna och säger varifrån de kommer.',
    ],
    claims: [
      {
        text:
          'Han varnar för det han kallar kompetensens förbannelse: den som är duktig och har höga krav ser ' +
          'framgång som det minsta som krävs och känner sig aldrig nöjd.',
        evidence: 'asikt',
        summary: [
          'I sitt nyhetsbrev skriver han att en av de vanligaste frågorna på hans turné var hur man ger sig själv ' +
            'erkännande och varför man aldrig känner sig klar. Hans svar är att den som är duktig räknar med att ' +
            'lyckas, så att seger bara blir godtagbar och allt annat ett misslyckande.',
          'Han menar att vi är byggda så, eftersom våra förfäder var de mest målinriktade och osäkra ' +
            'överpresterarna, och att hjärnan bryr sig om framgång, inte om att vi mår bra. Det finns inga ' +
            'lösningar, bara avvägningar: den som är besatt av ett område kan inte stänga av det när den vill.',
          'I ett annat nyhetsbrev lyfter han fram Oliver Burkemans iakttagelse att toppen av näringslivet ' +
            'domineras av osäkra överpresterare, som drivs av en känsla av att inte räcka till och inte har roligt.',
        ],
        note:
          'Han inleder med Rich Rolls tvivel på att framgång måste förtjänas med smärta, en tanke Roll själv tror ' +
          'är fel. Ordet osäkra överpresterare finns också hos Oliver Burkeman.',
        sources: [
          {
            title: 'Chris Williamson om att aldrig känna sig nöjd (nyhetsbrevet 3 Minute Monday)',
            url: 'https://chriswillx.com/3-minute-monday-enoughness-dogs-lessons/',
          },
          {
            title: 'Chris Williamson om stress och överpresterare (nyhetsbrevet 3 Minute Monday)',
            url: 'https://chriswillx.com/3-minute-monday-stress-overachievers-amp-bad-deals/',
          },
        ],
      },
      {
        text:
          'Han lyfter fram Oliver Burkemans tanke att många börjar varje dag med en skuld över allt som inte är ' +
          'gjort, en skuld som aldrig går att betala av.',
        evidence: 'asikt',
        summary: [
          'I nyhetsbrevet återger Williamson hur Matthew Hussey beskriver att han inte känner sig värd glädje och ' +
            'lugn förrän han pressat sig genom ett brutalt schema. Williamson skriver att han känner igen sig, och ' +
            'att Burkeman har ett namn för känslan: produktivitetsskuld.',
          'Burkeman beskriver det som att börja varje morgon på minus och försöka arbeta sig upp till noll före ' +
            'kvällen. Eftersom mejl, krav och ambitioner aldrig tar slut går skulden aldrig att betala av.',
          'Hans förslag är att börja dagen på noll och föra en lista över det man faktiskt gjort, som fylls på ' +
            'under dagen. Det gör det enligt honom lättare att slappna av och att välja vad man ska lägga kraft på.',
        ],
        note:
          'Både skulden och listan över det gjorda kommer från författaren Oliver Burkeman. Williamsons ' +
          'nyhetsbrev tar upp skulden, inte listan.',
        sources: [
          {
            title: 'Chris Williamson om produktivitetsskuld (nyhetsbrevet 3 Minute Monday)',
            url: 'https://chriswillx.com/3-minute-monday-productivity-debt-taboos-amp-anxiety/',
          },
          {
            title: 'Oliver Burkeman om listan över det gjorda',
            url: 'https://www.oliverburkeman.com/donelist',
          },
        ],
      },
      {
        text:
          'Han menar att vi bedömer våra liv i jämförelse med andra, och att ett uppkopplat liv med fler att ' +
          'jämföra sig med därför ger mer avund och mindre glädje.',
        evidence: 'asikt',
        summary: [
          'Williamson utgår från en tanke av Montesquieu som han hittat hos Tim Urban: att bli lycklig vore lätt, ' +
            'men vi vill bli lyckligare än andra, och vi tror att andra är lyckligare än de är. Vi bedömer vårt ' +
            'läge mot dem omkring oss, mot hur det var förut och mot hur föräldrarna hade det.',
          'Eftersom de flesta bara visar upp sina bästa stunder ser vi våra egna misslyckanden på nära håll men ' +
            'bara andras höjdpunkter. Han lyfter också Charlie Mungers tanke att det är avund snarare än girighet ' +
            'som driver världen, och drar slutsatsen att ju mer vi kan jämföra oss, desto mindre glädje. Själv ' +
            'följer han högst 100 personer på Twitter.',
        ],
        note: 'Han bygger på Montesquieu via Tim Urban och på Charlie Munger. Det är en tankegång, inte en studie.',
        sources: [
          {
            title: 'Chris Williamson om jämförelse och status (nyhetsbrevet 3 Minute Monday)',
            url: 'https://chriswillx.com/3-minute-monday-staring-men-comparison-status-symbols/',
          },
          {
            title: 'Chris Williamson om jämförelse och avund (nyhetsbrevet 3 Minute Monday)',
            url: 'https://chriswillx.com/3-minute-monday-comparison-sexy-men-mistakes/',
          },
        ],
      },
    ],
    startHere: [
      MW_CLEAR,
      {
        title: 'Modern Wisdom, alla avsnitt',
        url: 'https://chriswillx.com/podcast/',
        summary: [
          'Sidan samlar alla avsnitt av Modern Wisdom, och de går att lyssna på direkt eller i Apple Podcasts och Spotify.',
          'Podden beskriver sig som lärdomar från kloka tänkare, eftersom livet är svårt.',
          'Gästerna har varit bland andra David Goggins, Jordan Peterson, Naval Ravikant, Sam Harris och Andrew Huberman.',
          'Varje avsnitt har en beskrivning av vad man lär sig och tidsmarkeringar för samtalets delar.',
        ],
      },
    ],
  },
];

export const peopleIn = (area: AreaId | 'alla'): Person[] =>
  area === 'alla' ? PEOPLE : PEOPLE.filter(p => p.areas.includes(area));

export const personById = (id: string): Person | undefined => PEOPLE.find(p => p.id === id);
