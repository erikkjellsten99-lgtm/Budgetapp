// Kurs 1, lektion 3. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Titeln står utan citattecken runt ordet marknaden, eftersom citattecken inte får finnas i texten.
import type { Lesson, Source } from '../../types';

const CHECKED = '2026-11-20';

const NASDAQ_OMXS30: Source = {
  title: 'OMX Stockholm 30 Index, metodbeskrivning (2025), Nasdaq',
  url: 'https://indexes.nasdaqomx.com/docs/Methodology_OMXS30.pdf',
  checked: CHECKED,
};
const KBF_FONDTYPER: Source = {
  title: 'Olika fonder, Konsumenternas Bank- och finansbyrå',
  url: 'https://konsumenternasbankochfinansbyra.se/sparande--pension/sparande/fonder/olika-fondtyper',
  checked: CHECKED,
};
const INDU_Q3: Source = {
  title: 'Industrivärden, delårsrapport 1 januari till 30 september 2026',
  url: 'https://storage.mfn.se/a4e075a7-dd35-4ef1-a955-2966a8755971/delarsrapport-9m-2026-sve.pdf',
  checked: CHECKED,
};

export const K1_03: Lesson = {
  id: 'k1-03',
  course: 1,
  number: 3,
  title: 'Index och vad marknaden är',
  body: [
    {
      kind: 'p',
      text:
        'När nyheterna säger att börsen steg en procent i dag har ingen räknat på alla aktier en och en. Det som har mätts ' +
        'är ett index. Ett index är ett tal som sammanfattar hur kurserna för en hel grupp aktier har rört sig.',
    },
    {
      kind: 'p',
      text:
        'Marknaden är alltså inget eget ting. Det är summan av alla affärer mellan köpare och säljare, och ett index är ett sätt ' +
        'att beskriva den med en enda siffra.',
    },
    { kind: 'h', text: 'OMXS30, ett index för de största bolagen' },
    {
      kind: 'p',
      text:
        'OMX Stockholm 30, förkortat OMXS30, ägs och räknas av Nasdaq. Enligt Nasdaqs metodbeskrivning (version från 2025) mäter ' +
        'det utvecklingen för ett urval av de största och mest handlade aktierna på Nasdaq Stockholm. Reglerna i korthet:',
    },
    {
      kind: 'list',
      items: [
        'Aktien måste först ingå i Nasdaqs bredare index OMX Stockholm All-Share, förkortat OMXSPI.',
        'Bara en aktie per bolag får vara med. Har bolaget flera aktieslag väljs normalt det som handlas mest.',
        'Aktien måste ha handlats för minst 50 miljoner kronor per dag i genomsnitt under de senaste sex månaderna.',
        'Aktierna rangordnas efter börsvärdet på de aktier som är fritt tillgängliga för handel. De 20 största kommer med, och de som redan är med får stanna om de ligger bland de 35 största, så länge det blir högst 30.',
        'Urvalet ses över två gånger om året, och ändringarna gäller från första handelsdagen i juni och december.',
      ],
    },
    { kind: 'h', text: 'Stora bolag väger tyngre' },
    {
      kind: 'p',
      text:
        'OMXS30 är viktat efter börsvärde. Det betyder att ett stort bolag påverkar indexet mer än ett litet. Stiger det största ' +
        'bolaget med en procent flyttar det indexet mycket mer än om det minsta gör samma sak.',
    },
    {
      kind: 'p',
      text:
        'För att ett enda bolag inte ska dominera har reglerna ett tak: ingen aktie får väga mer än 15 procent när vikterna ' +
        'räknas om. Mellan omräkningarna kan en aktie som stiger mycket ändå hamna över taket.',
    },
    {
      kind: 'p',
      text:
        'Indexet räknas fram utifrån senast betalt för aktierna och publiceras varje sekund, från strax efter klockan 09:00 ' +
        'till 17:35 varje dag som Nasdaq Stockholm har öppet.',
    },
    {
      kind: 'p',
      text:
        'Ett nytt stort bolag behöver inte alltid vänta på översynen. Ett nyss noterat bolag kan tas in mellan översynerna om ' +
        'börsvärdet efter andra handelsdagen räcker till en plats bland de 20 största och handeln väntas bli tillräckligt stor. ' +
        'Då kan indexet en tid ha fler än 30 aktier.',
    },
    { kind: 'h', text: 'Kursindex och totalavkastningsindex' },
    {
      kind: 'p',
      text:
        'Ett index som bara följer kurserna missar en del av det ägarna faktiskt får, nämligen utdelningarna. Därför finns det ' +
        'index som räknar som om varje utdelning hade använts till att köpa fler aktier. De kallas totalavkastningsindex.',
    },
    {
      kind: 'p',
      text:
        'Två exempel är SIXRX, Stockholmsbörsens totalavkastningsindex, och OMXS30GI, som är OMXS30 räknat med utdelningarna. ' +
        'Totalavkastning betyder kursutveckling plus återinvesterad utdelning. Det är det mått du ska använda när du jämför ' +
        'ditt eget sparande med marknaden, eftersom du själv också fick utdelningarna.',
    },
    { kind: 'h', text: 'Tre saker ett index används till' },
    {
      kind: 'list',
      items: [
        'En snabb bild av hur aktierna som grupp har rört sig en dag, ett år eller tio år.',
        'En måttstock. Bolag som Industrivärden och Investor jämför sin aktie med ett jämförelseindex för att visa om det gått bättre eller sämre än marknaden, och du kan göra samma sak.',
        'Något att följa. En indexfond följer ett index, till exempel OMXS30, genom att äga samma aktier som indexet.',
      ],
    },
    { kind: 'h', text: 'Jämför rätt' },
    {
      kind: 'p',
      text:
        'En lätt miss att göra är att jämföra äpplen och päron. Om du räknar din egen avkastning med utdelningar och jämför med ' +
        'ett kursindex utan utdelningar ser du bättre ut än du är. Jämför totalavkastning med totalavkastningsindex. ' +
        'Jämför också samma period: ett år för din aktie mot fem år för indexet säger ingenting.',
    },
    {
      kind: 'p',
      text:
        'Den andra missen är att tro att indexet är din portfölj. Äger du fyra bolag kan du gå åt helt andra hållet än index ' +
        'ett år, både uppåt och nedåt. Och ett index beskriver det som redan har hänt. Det säger ingenting säkert om nästa år.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Att en aktie eller ett index har gått bra säger inte att det är klokt att köpa nu.',
    },
  ],
  example: {
    title: 'Industrivärden jämför sig med SIXRX',
    text:
      'Industrivärden jämför i sina rapporter aktiens totalavkastning med SIXRX och med OMXS30GI. I delårsrapporten för ' +
      '1 januari till 30 september 2026 var totalavkastningen 31 procent för A-aktien och 30 procent för C-aktien, medan ' +
      'SIXRX gav 11 procent. Rapporten anger också att C-aktiens totalavkastning varit 17 procent per år under de senaste ' +
      'fem åren och 15 procent per år under de senaste tio. Jämförelsen är rättvis eftersom både aktiens och indexets siffror ' +
      'räknar med utdelningarna. Den visar vad som hände under just de perioderna, inte vad som händer härnäst.',
    source: INDU_Q3,
  },
  key: [
    'Ett index sammanfattar många aktiers kursrörelser i ett tal, och OMXS30 består av ungefär 30 stora och mycket handlade aktier på Nasdaq Stockholm.',
    'OMXS30 är viktat efter börsvärde, så stora bolag påverkar det mest, med ett tak på 15 procent per aktie vid omräkningen.',
    'Jämför din totalavkastning med ett totalavkastningsindex som SIXRX, som räknar med utdelningarna.',
  ],
  terms: [
    { word: 'Index', meaning: 'Ett tal som sammanfattar hur kurserna för en grupp aktier har rört sig.' },
    { word: 'OMXS30', meaning: 'Nasdaqs index med ungefär 30 av de största och mest handlade aktierna på Nasdaq Stockholm.' },
    { word: 'OMXSPI', meaning: 'OMX Stockholm All-Share, Nasdaqs bredare index för Stockholmsbörsen.' },
    { word: 'Viktat efter börsvärde', meaning: 'Varje aktie påverkar indexet i proportion till sitt börsvärde.' },
    { word: 'Totalavkastning', meaning: 'Kursutveckling plus återinvesterad utdelning.' },
    { word: 'Totalavkastningsindex', meaning: 'Ett index som räknar som om utdelningarna köpte fler aktier, till exempel SIXRX.' },
    { word: 'SIXRX', meaning: 'Stockholmsbörsens totalavkastningsindex, ett vanligt jämförelseindex.' },
    { word: 'Jämförelseindex', meaning: 'Det index man mäter sin egen avkastning mot.' },
    { word: 'Indexfond', meaning: 'En fond som äger samma aktier som ett index och följer det.' },
  ],
  sources: [NASDAQ_OMXS30, KBF_FONDTYPER, INDU_Q3],
  questions: [
    {
      id: 'k1-03-q1',
      text:
        'Under en dag stiger det största bolaget i OMXS30 med 3 procent och ett av de minsta faller med 3 procent. Övriga står still. Vad händer med indexet?',
      options: [
        'Ingenting, eftersom uppgången och nedgången tar ut varandra.',
        'Det faller, eftersom små bolag påverkar index mest.',
        'Ingenting förrän vid nästa omräkning i juni eller december.',
        'Det stiger, eftersom det stora bolaget väger tyngre.',
      ],
      correct: 3,
      why:
        'OMXS30 är viktat efter börsvärde. Det största bolaget har mycket större vikt än det minsta, så samma procentuella ' +
        'rörelse åt olika håll ger ett plus för indexet. Indexet räknas om varje sekund, inte bara vid översynen.',
    },
    {
      id: 'k1-03-q2',
      text:
        'Du räknar din avkastning med utdelningarna inräknade och jämför med OMXS30, som är ett kursindex. Vilket fel riskerar du?',
      options: [
        'Ditt sparande ser sämre ut än det är, eftersom indexet räknar utdelningarna två gånger.',
        'Ditt sparande ser bättre ut än det är, eftersom indexet saknar utdelningarna.',
        'Inget fel, eftersom alla index räknar med utdelningar.',
        'Felet uppstår bara om du äger A-aktier.',
      ],
      correct: 1,
      why:
        'Ett kursindex följer bara priserna. Din siffra innehåller utdelningarna men indexet gör det inte, så du får ett ' +
        'försprång som inte är ärligt. Jämför med ett totalavkastningsindex som SIXRX eller OMXS30GI.',
    },
    {
      id: 'k1-03-q3',
      text: 'Ett bolag har både A och B-aktier på Nasdaq Stockholm. Varför finns bara en av dem i OMXS30?',
      options: [
        'Reglerna tillåter en aktie per bolag, normalt den som handlas mest.',
        'B-aktier får aldrig ingå i ett index.',
        'A-aktier har för många röster för att få vara med.',
        'Nasdaq väljer alltid den billigaste aktien.',
      ],
      correct: 0,
      why:
        'Enligt Nasdaqs metodbeskrivning får bara en aktie per bolag ingå. Är ingen av dem redan med väljs den som handlats ' +
        'för mest pengar per dag de senaste sex månaderna.',
    },
    {
      id: 'k1-03-q4',
      text:
        'Industrivärdens C-aktie gav 30 procent i totalavkastning under januari till september 2026, och SIXRX gav 11 procent. Vilken slutsats håller?',
      options: [
        'C-aktien kommer att gå bättre än SIXRX även nästa år.',
        'SIXRX måste ha räknats fel, eftersom skillnaden är så stor.',
        'C-aktien gav mer än marknaden som helhet under just den perioden.',
        'C-aktien har lägre risk än marknaden.',
      ],
      correct: 2,
      why:
        'Båda siffrorna är totalavkastning, så jämförelsen är rättvis för perioden. Men den beskriver det som hänt. Den säger ' +
        'ingenting om nästa år och inget om hur stor risken var.',
    },
  ],
};
