// Lär: fast innehåll om personer inom andning, kyla, bastu, meditation och personlig utveckling.
// Inga citat, bara sammanfattningar med egna ord. Varje påstående har märkning och minst en https-källa
// som kontrollerats på nätet när den skrevs in. Regler: se CLAUDE.md i den här mappen.

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

export type Source = { title: string; url: string };
export type Claim = { text: string; evidence: Evidence; note?: string; sources: Source[] };
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
const LAUKKANEN_2015: Source = {
  title: 'Laukkanen m.fl. 2015, bastu och dödlighet i JAMA Internal Medicine (ScienceDaily)',
  url: 'https://sciencedaily.com/releases/2015/02/150223122602.htm',
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
      'Engagemang: att öva varje dag och hålla fast vid det över tid.',
    ],
    claims: [
      {
        text:
          'I en studie fick 24 friska män antingen tio dagars träning i andning, kyla och meditation eller ingen ' +
          'träning. De tränade fick mer adrenalin i blodet, färre influensalika symtom och lägre inflammation när ' +
          'de fick ett ämne från bakterier som framkallar en tillfällig immunreaktion.',
        evidence: 'svagt',
        note:
          'Slumpad studie men liten, bara unga män och ett konstgjort test i labbet. Den visar inte att metoden ' +
          'skyddar mot sjukdom i vardagen.',
        sources: [
          {
            title: 'Kox m.fl. 2014, frivillig påverkan på nervsystem och immunförsvar, PNAS (PubMed)',
            url: 'https://pubmed.ncbi.nlm.nih.gov/24799686/',
          },
        ],
      },
      {
        text:
          'När forskare testade Wim Hof själv dämpades immunreaktionen och han fick höga halter av stresshormoner, ' +
          'som om han själv kunde starta en kontrollerad stressreaktion.',
        evidence: 'svagt',
        note: 'Fallstudie på en enda person. Forskarna skrev själva att större studier behövs.',
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
        note: 'Författarna bedömde att studierna höll låg kvalitet och att resultaten ska tolkas försiktigt.',
        sources: [
          {
            title: 'Almahayni och Hammond 2024, systematisk genomgång i PLOS ONE (PMC)',
            url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10936795',
          },
          {
            title: 'Pressmeddelande om genomgången (EurekAlert)',
            url: 'https://www.eurekalert.org/news-releases/1036707',
          },
        ],
      },
      {
        text:
          'Wim Hof menar att den som övar regelbundet får mer energi, sover bättre och klarar stress bättre.',
        evidence: 'asikt',
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
        title: 'Boken The Wim Hof Method, 2020 (Sounds True)',
        url: 'https://www.soundstrue.com/products/the-wim-hof-method-1',
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
      'Växla mellan kallt vatten och bastu i flera omgångar.',
      'Avsluta med kyla och låt kroppen värma upp sig själv efteråt, det hon kallar Søbergprincipen.',
      'Korta stunder räcker: hennes vinterbadare låg bara några minuter i vattnet åt gången.',
    ],
    claims: [
      {
        text:
          'Unga män som vinterbadade och bastade regelbundet ökade sin värmeproduktion mer än en kontrollgrupp ' +
          'när de kyldes ner, trots att det bruna fettet aktiverades ungefär lika mycket i båda grupperna.',
        evidence: 'svagt',
        note:
          'Bara 8 vinterbadare och 8 i kontrollgruppen, alla män. Studien jämför grupper vid ett tillfälle och ' +
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
        note: 'Samma lilla studie. Tolkningen om termostaten är en hypotes som behöver prövas mer.',
        sources: [SOBERG_2021, SOBERG_2021_FULL],
      },
      {
        text:
          'Vinterbadarna i studien låg i snitt ungefär 11 minuter i kallt vatten och satt ungefär 57 minuter i ' +
          'bastun per vecka.',
        evidence: 'svagt',
        note:
          'Siffrorna beskriver vad de 8 vinterbadarna råkade göra, och mängderna har aldrig testats som en dos. ' +
          'Ingen vet om just den mängden ger bäst effekt, men siffran sprids ofta som ett recept.',
        sources: [
          SOBERG_2021_FULL,
          {
            title: 'Pressmeddelande om studien (ScienceDaily)',
            url: 'https://www.sciencedaily.com/releases/2021/10/211011110818.htm',
          },
        ],
      },
      {
        text:
          'Søberg menar att man ska avsluta med kyla för att få större nytta, eftersom kroppen då själv måste ' +
          'producera värme efteråt.',
        evidence: 'asikt',
        note: 'Ett råd som bygger på hur kroppen fungerar, inte en jämförande studie.',
        sources: [
          {
            title: 'Huberman Lab: Dr. Susanna Søberg om kyla och värme',
            url: 'https://www.hubermanlab.com/episode/dr-susanna-soberg-how-to-use-cold-and-heat-exposure-to-improve-your-health',
          },
          {
            title: 'Søbergs egen text om kyla (Goodreads, författarblogg)',
            url: 'https://www.goodreads.com/author_blog_posts/23271891-the-new-science-of-cold-exposure-reduce-stress-boost-immunity-increa?tab=book',
          },
        ],
      },
      {
        text:
          'En genomgång av andra forskare (Espeland m.fl. 2022) fann tecken på bättre insulinkänslighet och att ' +
          'brunt fett aktiveras, men de flesta studierna var små.',
        evidence: 'svagt',
        note:
          'Genomgången säger själv att små grupper, oftast ett kön och olika vattentemperatur gör det svårt att ' +
          'dra säkra slutsatser.',
        sources: [
          {
            title: 'Espeland m.fl. 2022, hälsoeffekter av frivilliga kallbad (UiT)',
            url: 'https://munin.uit.no/handle/10037/27902',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken Winter Swimming, 2022 (Booktopia)',
        url: 'https://booktopia.com.au/winter-swimming-susanna-soberg/book/9781529417463.html',
      },
      {
        title: 'Huberman Lab: Dr. Susanna Søberg om kyla och värme',
        url: 'https://www.hubermanlab.com/episode/dr-susanna-soberg-how-to-use-cold-and-heat-exposure-to-improve-your-health',
      },
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
          'Bland 2 315 finska män som följdes i ungefär 20 år hade de som bastade 4 till 7 gånger i veckan lägre ' +
          'risk att dö av hjärtsjukdom och av alla orsaker än de som bastade en gång i veckan.',
        evidence: 'belagt',
        note:
          'Stor studie med lång uppföljning, men den är observerande: den visar ett samband, inte att bastun är ' +
          'orsaken. Bara medelålders män från östra Finland.',
        sources: [
          LAUKKANEN_2015,
          {
            title: 'Pressmeddelande om studien (EurekAlert)',
            url: 'https://www.eurekalert.org/news-releases/862302',
          },
        ],
      },
      {
        text:
          'I samma grupp män hade de som bastade 4 till 7 gånger i veckan lägre risk för demens och Alzheimers ' +
          'sjukdom än de som bastade en gång i veckan.',
        evidence: 'belagt',
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
          'Bland 1 628 män och kvinnor hade de som bastade 4 till 7 gånger i veckan ungefär 60 procent lägre risk ' +
          'för stroke, även när man tagit hänsyn till motion, blodtryck och annat.',
        evidence: 'belagt',
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
        note:
          'Ej slumpad studie som bara mätte direkt efter ett pass. Studien gjordes i bastur från en ' +
          'tillverkare som var partner i projektet.',
        sources: [
          {
            title: 'Östra Finlands universitet om studien',
            url: 'https://www.uef.fi/en/article/scientists-uncover-why-sauna-bathing-is-good-for-your-health',
          },
          {
            title: 'Om studien (ScienceDaily)',
            url: 'https://www.sciencedaily.com/releases/2018/01/180105124005.htm',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Laukkanen m.fl. 2018, genomgång av bastu och hälsa, Mayo Clinic Proceedings (Bristols universitet)',
        url: 'https://research-information.bris.ac.uk/en/publications/875f218f-f6a3-46e8-bdbc-ea005e174ab9',
      },
      {
        title: 'Rhonda Patrick intervjuar Jari Laukkanen (FoundMyFitness)',
        url: 'https://www.foundmyfitness.com/episodes/sauna-use-associated-with-decreased-risk-of-heart-disease-and-alzheimer-s-disease-jari-laukkanen',
      },
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
      'Andrew Huberman är docent (associate professor) i neurobiologi vid Stanford och driver podden Huberman Lab sedan 2021. ' +
      'Han forskar själv om synen och om andning och stress, men i podden pratar han ofta om områden ' +
      'utanför sitt eget. ' +
      'Han har fått kritik för att dra för långa slutsatser av små studier.',
    method: [
      'Cyklisk suck: andning med långa utandningar, fem minuter om dagen.',
      'Kyla i korta pass utspridda över veckan i stället för ett långt pass.',
      'Gör om forskning till enkla dagliga vanor, så kallade protokoll.',
    ],
    claims: [
      {
        text:
          'I hans grupps studie gav fem minuter cyklisk suck om dagen i en månad bättre humör och lugnare ' +
          'andning än lika lång tid mindfulnessmeditation.',
        evidence: 'svagt',
        note:
          'Slumpad studie med drygt hundra deltagare, men en enda studie från hans eget labb, små effekter och ' +
          'humöret rapporterades av deltagarna själva.',
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
        note:
          'Siffran kommer från vad vinterbadarna i Søbergs lilla studie redan gjorde. Den har aldrig testats som ' +
          'dos.',
        sources: [
          {
            title: 'Huberman Lab: vetenskapen om kyla (nyhetsbrev)',
            url: 'https://www.hubermanlab.com/newsletter/the-science-and-use-of-cold-exposure-for-health-and-performance',
          },
          SOBERG_2021_FULL,
        ],
      },
      {
        text:
          'Han lyfter fram att kallt vatten ger en stor och långvarig ökning av dopamin och noradrenalin. ' +
          'Studien bakom visade att en timme i 14 grader varmt vatten ökade noradrenalin ungefär sex gånger ' +
          'och dopamin ungefär tre och en halv gånger.',
        evidence: 'svagt',
        note:
          'En liten studie med unga män som låg en hel timme i vattnet, mycket längre än de korta pass han ' +
          'själv föreslår.',
        sources: [
          SRAMEK_2000,
          {
            title: 'Huberman Lab: vetenskapen om kyla (nyhetsbrev)',
            url: 'https://www.hubermanlab.com/newsletter/the-science-and-use-of-cold-exposure-for-health-and-performance',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Huberman Lab: vetenskapen om kyla (nyhetsbrev)',
        url: 'https://www.hubermanlab.com/newsletter/the-science-and-use-of-cold-exposure-for-health-and-performance',
      },
      {
        title: 'Huberman Lab: Dr. Susanna Søberg om kyla och värme',
        url: 'https://www.hubermanlab.com/episode/dr-susanna-soberg-how-to-use-cold-and-heat-exposure-to-improve-your-health',
      },
    ],
    warning: WARN_BREATH_COLD,
  },
  {
    id: 'rhonda-patrick',
    name: 'Rhonda Patrick',
    kind: 'Forskare och poddare',
    areas: ['kallbad'],
    teaser: 'Biomedicinsk forskare som förklarar vad bastu och kyla gör i cellerna.',
    about:
      'Rhonda Patrick har en doktorsexamen i biomedicin och driver sajten och podden FoundMyFitness, podden sedan 2014. ' +
      'Hon sammanfattar studier och intervjuar forskare som Jari Laukkanen. Hon pratar ofta om bastu som ' +
      'ett sätt att belasta kroppen ungefär som träning.',
    method: [
      'Hon förordar bastu flera gånger i veckan som ett komplement till träning.',
      'Förklara mekanismer: värmechockproteiner efter bastu och noradrenalin efter kyla.',
      'Bygga på stora befolkningsstudier och visa var bevisen tar slut.',
    ],
    claims: [
      {
        text:
          'Hon lyfter fram de finska studierna där män som bastade ofta hade lägre risk att dö av hjärtsjukdom ' +
          'och lägre risk för demens.',
        evidence: 'belagt',
        note: 'Stora observerande studier som visar samband, inte bevisad orsak. Mest män från östra Finland.',
        sources: [
          {
            title: 'FoundMyFitness: bastu och lägre risk för hjärtsjukdom och demens',
            url: 'https://www.foundmyfitness.com/episodes/sauna-use-decreased-risk-of-heart-and-neurodegenerative-diseases',
          },
          LAUKKANEN_2015,
        ],
      },
      {
        text:
          'Hon beskriver bastu som en form av träning för hjärtat. I en tysk studie med 19 personer steg puls ' +
          'och blodtryck i bastun till samma nivå som vid cykling med måttlig belastning, och sjönk sedan under utgångsläget.',
        evidence: 'svagt',
        note: 'Liten studie som bara mätte direkt under och efter ett pass. Ingen visar att bastu ersätter träning.',
        sources: [
          {
            title: 'FoundMyFitness: bastu som träning för hjärtat (Rosetta)',
            url: 'https://rosetta.to/u/foundmyfitness/sauna-use-as-an-exercise-mimetic-for-heart-and-healthspan',
          },
          {
            title: 'Ketelhut och Ketelhut 2019, bastu och puls (ScienceDaily)',
            url: 'https://www.sciencedaily.com/releases/2019/06/190612093900.htm',
          },
        ],
      },
      {
        text:
          'Hon menar att värmen i bastun ökar värmechockproteiner, som hjälper cellerna att hålla proteiner i ' +
          'rätt form, och att det kan bidra till att bevara muskler.',
        evidence: 'svagt',
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
          'timme i 14 grader varmt vatten ökade noradrenalin ungefär sex gånger.',
        evidence: 'svagt',
        note: 'Bygger på en liten studie med långa pass i vattnet.',
        sources: [
          {
            title: 'FoundMyFitness: kallbad, kylbehandling och noradrenalin',
            url: 'https://foundmyfitness.com/episodes/cold-shock-norepinephrine',
          },
          SRAMEK_2000,
        ],
      },
    ],
    startHere: [
      {
        title: 'FoundMyFitness: intervjun med Jari Laukkanen om bastu',
        url: 'https://www.foundmyfitness.com/episodes/sauna-use-associated-with-decreased-risk-of-heart-disease-and-alzheimer-s-disease-jari-laukkanen',
      },
      {
        title: 'FoundMyFitness: allt om bastu',
        url: 'https://www.foundmyfitness.com/tags/sauna',
      },
    ],
    warning: WARN_COLD,
  },
  {
    id: 'jon-kabat-zinn',
    name: 'Jon Kabat-Zinn',
    kind: 'Forskare',
    areas: ['meditation'],
    teaser: 'Grundade kursen MBSR och tog in mindfulness i vården.',
    about:
      'Jon Kabat-Zinn startade 1979 en klinik för stresshantering vid University of ' +
      'Massachusetts. Där byggde han den åtta veckor långa kursen Mindfulness-Based Stress Reduction, MBSR, ' +
      'för patienter med långvarig smärta och sjukdom. Kursen har sedan spridits över hela världen.',
    method: [
      'Mindfulness: att medvetet rikta uppmärksamheten mot nuet utan att döma det man märker.',
      'En kurs på åtta veckor med träffar varje vecka och en heldag med övning.',
      'Övningar i meditation och medveten närvaro som man fortsätter med hemma.',
    ],
    claims: [
      {
        text:
          'En stor genomgång av 47 slumpade studier med över 3 500 vuxna fann att program med mindfulness ' +
          'minskade ångest, nedstämdhet och smärta något.',
        evidence: 'belagt',
        note:
          'Effekterna var små till måttliga, och meditation var inte bättre än annan aktiv behandling som ' +
          'motion eller terapi.',
        sources: [
          {
            title: 'Goyal m.fl. 2014, meditation och stress, JAMA Internal Medicine (QxMD)',
            url: 'https://read.qxmd.com/read/24395196/meditation-programs-for-psychological-stress-and-well-being-a-systematic-review-and-meta-analysis',
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
        note: 'Grupperna var inte slumpade, och studien gjordes av den som skapat kursen.',
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
          'Han beskriver mindfulness som uppmärksamhet med avsikt, i nuet och utan att döma, och säger själv att ' +
          'det är en arbetsdefinition och inte den slutliga.',
        evidence: 'asikt',
        sources: [
          {
            title: 'Kabat-Zinn om hur han definierar mindfulness (Mindful)',
            url: 'https://www.mindful.org/jon-kabat-zinn-defining-mindfulness/',
          },
          {
            title: 'Intervju i The Psychologist (BPS)',
            url: 'https://thepsychologist.bps.org.uk/not-mcmindfulness-any-stretch-imagination',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Boken Full Catastrophe Living, 1990 (Publishers Weekly)',
        url: 'https://www.publishersweekly.com/9780385298971',
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
      'James Clear är författare och skriver om vanor och beslut. Hans bok Atomic Habits från 2018 har sålt i ' +
      'tiotals miljoner exemplar. Han forskar inte själv utan samlar idéer från forskning och andra författare ' +
      'och gör dem praktiska.',
    method: [
      'Fyra lagar för nya vanor: gör det synligt, lockande, lätt och tillfredsställande.',
      'Vänd på lagarna för att bryta en dålig vana: gör den osynlig, olockande, svår och otillfredsställande.',
      'Börja med vem du vill vara, och låt varje litet beslut bli en röst för den personen.',
      'Haka på en ny vana direkt efter en du redan har.',
    ],
    claims: [
      {
        text:
          'Små förbättringar varje dag växer som ränta på ränta. En procent bättre varje dag blir ungefär 37 ' +
          'gånger bättre på ett år.',
        evidence: 'asikt',
        note: 'Räkningen stämmer, men livet växer sällan så jämnt. Idén lånar han från Dave Brailsfords cykellag.',
        sources: [
          {
            title: 'Continuous Improvement (jamesclear.com)',
            url: 'https://jamesclear.com/continuous-improvement',
          },
        ],
      },
      {
        text:
          'Den som bestämmer exakt när och var en sak ska göras blir mer benägen att göra den. En genomgång av 94 ' +
          'tester fann en måttlig till stor effekt av sådana planer.',
        evidence: 'belagt',
        note:
          'Idén kommer från Peter Gollwitzer, genomgången gjorde han med Paschal Sheeran.',
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
          'Det finns inget magiskt antal dagar för en ny vana. I en studie var medianen 66 dagar innan ' +
          'en ny vana kändes automatisk, med stor spridning mellan personer.',
        evidence: 'svagt',
        note:
          'En studie med 96 personer som själva skattade hur automatisk vanan kändes. Spridningen var från 18 ' +
          'till 254 dagar.',
        sources: [
          {
            title: 'How Long Does it Actually Take to Form a New Habit? (jamesclear.com)',
            url: 'https://jamesclear.com/new-habit',
          },
          {
            title: 'Lally m.fl. 2010 om hur vanor bildas (BPS Research Digest)',
            url: 'https://bps.org.uk/research-digest/how-form-habit',
          },
        ],
      },
      {
        text:
          'Vanor fastnar bättre om de bygger på vem man vill vara än på vad man vill uppnå.',
        evidence: 'asikt',
        sources: [
          {
            title: 'Identity-Based Habits (jamesclear.com)',
            url: 'https://jamesclear.com/identity-based-habits',
          },
        ],
      },
      {
        text:
          'Att haka på en ny vana direkt efter en befintlig gör den lättare att komma ihåg. Idén kommer från BJ ' +
          'Foggs metod Tiny Habits.',
        evidence: 'asikt',
        sources: [
          {
            title: 'Habit Stacking (jamesclear.com)',
            url: 'https://jamesclear.com/habit-stacking',
          },
          {
            title: 'Tiny Habits, introduktion (Stanford Medicine)',
            url: 'https://med.stanford.edu/content/dam/sm/ascend/documents/Introduction_%20Tiny%20Habits%20for%20Self%20Compassion,%20Getting%20Started.pdf',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Sammanfattning av Atomic Habits (jamesclear.com)',
        url: 'https://jamesclear.com/atomic-habits-summary',
      },
      {
        title: 'Modern Wisdom #064: James Clear om vanor som håller',
        url: 'https://chriswillx.com/064-james-clear-how-to-build-habits-that-last/',
      },
    ],
  },
  {
    id: 'chris-williamson',
    name: 'Chris Williamson',
    kind: 'Poddare',
    areas: ['utveckling'],
    teaser: 'Poddaren bakom Modern Wisdom samlar idéer om lycka, driv och vanor.',
    about:
      'Chris Williamson är en brittisk poddare som driver Modern Wisdom sedan 2018. Han var tidigare ' +
      'klubbarrangör och deltog i första säsongen av Love Island. Han forskar inte, utan intervjuar forskare ' +
      'och författare och sammanfattar vad han lärt sig i återkommande avsnitt med lärdomar.',
    method: [
      'Långa intervjuer med forskare, författare och idrottare.',
      'I återkommande avsnitt går han igenom de lärdomar han tagit med sig.',
      'Han lånar gärna idéer från gästerna och säger varifrån de kommer.',
    ],
    claims: [
      {
        text:
          'Han varnar ofta för att vara en osäker överpresterare: att jaga mål för att laga en inre känsla av ' +
          'att inte räcka till, och att tro att oro gör en bättre.',
        evidence: 'asikt',
        note: 'Begreppet kommer från forskaren Laura Empson, som studerat personer på kunskapsföretag som konsult- och advokatbyråer.',
        sources: [
          {
            title: 'Modern Wisdom #879: 16 lärdomar från 2024 (Podscripts)',
            url: 'https://podscripts.co/podcasts/modern-wisdom/879-16-lessons-from-2024-chris-bumstead-elon-musk-alex-hormozi',
          },
          {
            title: 'Laura Empson om osäkra överpresterare (City St Georges, University of London)',
            url: 'https://www.citystgeorges.ac.uk/news-and-events/news/2018/02/if-youre-so-successful-why-are-you-still-working-70-hours-a-week',
          },
        ],
      },
      {
        text:
          'Han menar att många börjar varje dag med en känsla av skuld över allt som inte är gjort, och att den ' +
          'skulden aldrig går att betala av. En lista över det man faktiskt gjort hjälper mer än en lista över ' +
          'det som återstår.',
        evidence: 'asikt',
        note: 'Både skulden och listan över det gjorda kommer från författaren Oliver Burkeman.',
        sources: [
          {
            title: 'Chris Williamson om produktivitetsskuld (Rosetta)',
            url: 'https://rosetta.to/u/chriswillx/productivity-debt',
          },
          {
            title: 'Oliver Burkeman om listan över det gjorda',
            url: 'https://www.oliverburkeman.com/donelist',
          },
        ],
      },
      {
        text:
          'Han menar att förväntningar styr hur lycklig man känner sig mer än vad som faktiskt händer, eftersom ' +
          'vi jämför oss med andra och med det vi väntat oss.',
        evidence: 'asikt',
        note: 'Han lånar tanken från bland andra författaren Morgan Housel.',
        sources: [
          {
            title: 'Modern Wisdom #702: 16 lärdomar från 700 avsnitt (Global Player)',
            url: 'https://globalplayer.com/podcasts/episodes/7Drih6n',
          },
          {
            title: 'Chris Williamson om förväntningar och lycka (Rosetta)',
            url: 'https://rosetta.to/u/chriswillx/if-only-you-really-wanted-to-be-happy',
          },
        ],
      },
    ],
    startHere: [
      {
        title: 'Modern Wisdom #064: James Clear om vanor som håller',
        url: 'https://chriswillx.com/064-james-clear-how-to-build-habits-that-last/',
      },
      {
        title: 'Modern Wisdom, alla avsnitt',
        url: 'https://chriswillx.com/podcast/',
      },
    ],
  },
];

export const peopleIn = (area: AreaId | 'alla'): Person[] =>
  area === 'alla' ? PEOPLE : PEOPLE.filter(p => p.areas.includes(area));

export const personById = (id: string): Person | undefined => PEOPLE.find(p => p.id === id);
