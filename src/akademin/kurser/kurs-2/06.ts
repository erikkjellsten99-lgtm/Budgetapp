// Kurs 2, lektion 6. Källorna öppnades och kontrollerades 2026-11-20. Regler: se ../../CLAUDE.md.
// Bolagen A och B är påhittade, och räntan på 5 procent är ett antagande för att visa hur räkningen går.
import type { Lesson } from '../../types';
import { ARL, ATLAS_DEF, ATLAS_Q3, HM_AR25, HM_FY25, SCB_SOLIDITET, VOLVO_Q4 } from './kallor';

export const K2_06: Lesson = {
  id: 'k2-06',
  course: 2,
  number: 6,
  title: 'Skulder och finansiell styrka',
  body: [
    {
      kind: 'p',
      text:
        'Skulder är inte farliga i sig. Atlas Copco, H&M och Volvo har alla räntebärande lån. Men skulder ska betalas med ränta på bestämda dagar, ' +
        'oavsett hur affärerna går. Därför vill du veta hur mycket bolaget är skyldigt, hur stort det egna kapitalet är och när ' +
        'skulderna förfaller.',
    },
    { kind: 'h', text: 'Nettoskuld' },
    {
      kind: 'p',
      text:
        'Nettoskulden är i grunden de räntebärande skulderna minus de likvida medlen. Atlas Copco räknar lån plus pensionsskulder ' +
        'minus likvida medel och andra kortfristiga finansiella tillgångar, med en justering för vissa räntederivat. Den 30 ' +
        'september 2026 var nettoskulden 14 244 miljoner kronor, varav 1 590 miljoner var pensionsskulder.',
    },
    {
      kind: 'p',
      text:
        'Bolagen räknar olika, och det kan ge helt olika siffror. H&M redovisar två mått för den 30 november 2025. Nettoskulden ' +
        'inklusive leasingskulder och pensioner var 57 028 miljoner kronor. Räknar man bara lån, utan leasingskulder och ' +
        'pensioner, minus likvida medel, hade H&M i stället en nettokassa på 233 miljoner. Volvos industriverksamhet hade enligt ' +
        'bolaget en nettokassa på 63,0 miljarder kronor den 31 december 2025, räknat utan pensioner och leasingskulder.',
    },
    { kind: 'h', text: 'Soliditet' },
    {
      kind: 'p',
      text:
        'Soliditet visar hur stor del av tillgångarna som är finansierade med eget kapital. Statistiska centralbyrån definierar ' +
        'den som justerat eget kapital delat med totala tillgångar. Atlas Copco kallar sitt mått andel eget kapital och räknar ' +
        'eget kapital i procent av totala tillgångar: 51 procent den 30 september 2026. H&M:s motsvarande mått var 25,2 procent ' +
        'den 30 november 2025.',
    },
    {
      kind: 'p',
      text:
        'Volvokoncernens andel var 27,5 procent vid utgången av 2025, men för industriverksamheten ensam 37,6 procent. Volvo har ' +
        'också en finansieringsverksamhet som lånar ut pengar till kunder, och där var andelen eget kapital 10,0 procent. Den ' +
        'drar ned koncernens siffra. Läs därför vad som ingår innan du jämför.',
    },
    { kind: 'h', text: 'Skuld i förhållande till vinst och eget kapital' },
    {
      kind: 'p',
      text:
        'EBITDA är rörelseresultatet före av- och nedskrivningar. Nettoskulden delad med EBITDA visar ungefär hur många års ' +
        'sådant resultat skulden motsvarar. Atlas Copco angav 0,3 för tredje kvartalet 2026. H&M angav 1,4 i årsredovisningen ' +
        'för 2025, räknat med leasingskulderna, och har som mål att ligga mellan 1,0 och 2,0.',
    },
    {
      kind: 'p',
      text:
        'Atlas Copco definierar också nettoskulden i förhållande till eget kapital, i den svenska rapporten kallad ' +
        'skuldsättningsgrad: 14 244 delat med 118 930 är 12 procent. Ett annat mått är räntetäckningsgrad, som visar hur många ' +
        'gånger resultatet räcker till räntorna. Atlas Copco har en definition, men rapporten för tredje kvartalet anger inget ' +
        'värde.',
    },
    { kind: 'h', text: 'Skuld förstärker åt båda hållen' },
    {
      kind: 'p',
      text:
        'Två påhittade bolag har tillgångar på 1 000 kronor var. Bolag A har bara eget kapital. Bolag B har 500 i eget kapital ' +
        'och 500 i lån med 5 procents ränta, alltså 25 kronor om året. Vi bortser från skatt.',
    },
    {
      kind: 'list',
      items: [
        'Ett bra år är rörelseresultatet 100 i båda bolagen. A får 100 delat med 1 000, alltså 10 procent på det egna kapitalet. B får 75 delat med 500, alltså 15 procent.',
        'Ett dåligt år är rörelseresultatet 20. A får 2 procent. B får 20 minus 25, alltså minus 5, och det blir minus 1 procent.',
      ],
    },
    {
      kind: 'p',
      text:
        'Lånen gör de goda åren bättre och de dåliga sämre för ägarna, eftersom räntan ska betalas oavsett. Det är därför en hög ' +
        'avkastning på eget kapital kan bero på mycket skulder, som du såg med H&M i förra lektionen.',
    },
    { kind: 'h', text: 'När skulderna förfaller' },
    {
      kind: 'p',
      text:
        'Årsredovisningslagen kräver att bolaget för varje skuldpost anger hur mycket som ska betalas inom ett år och hur mycket ' +
        'senare. Atlas Copco och H&M anger också den genomsnittliga löptiden: 4,2 år för Atlas Copcos räntebärande skulder den 30 ' +
        'september 2026 och 5,2 år för H&M:s den 30 november 2025. Ett lån som förfaller måste betalas eller ersättas med ett ' +
        'nytt, och det nya lånet kan få en annan ränta. H&M gav till exempel under fjärde kvartalet 2025 ut ett obligationslån på ' +
        '500 miljoner euro med åtta års löptid och 3,4 procents ränta.',
    },
    {
      kind: 'p',
      text:
        'Titta också på outnyttjade krediter. H&M hade den 30 november 2025 likvida medel på 20 908 miljoner kronor och ' +
        'outnyttjade krediter på 19 680 miljoner, sammanlagt 40 588 miljoner som bolaget kallar sin likviditetsbuffert.',
    },
    {
      kind: 'p',
      text:
        'Den här lektionen är allmän utbildning. Den lär dig läsa ett bolags skulder, inte vilket bolag som är värt att köpa.',
    },
  ],
  example: {
    title: 'Atlas Copco den 30 september 2026',
    text:
      'Rapporten för tredje kvartalet 2026 anger en nettoskuld på 14 244 miljoner kronor (11 149 ett år tidigare), varav 1 590 ' +
      'miljoner var pensionsskulder. Nettoskulden i förhållande till EBITDA var 0,3 (0,2) och skuldsättningsgraden 12 procent ' +
      '(10). Andelen eget kapital var 51 procent. De räntebärande skulderna hade en genomsnittlig löptid på 4,2 år. Räntenettot ' +
      'för kvartalet var minus 102 miljoner kronor, och bolaget skriver att den högre räntekostnaden främst berodde på större ' +
      'skulder och mindre likvida medel.',
    source: ATLAS_Q3,
  },
  key: [
    'Nettoskulden är räntebärande skulder minus likvida medel, men bolagen räknar olika, till exempel med eller utan leasingskulder.',
    'Soliditet eller andel eget kapital visar hur stor del av tillgångarna som ägarna har finansierat.',
    'Skulder förstärker resultatet för ägarna både uppåt och nedåt, och det spelar roll när de förfaller.',
  ],
  terms: [
    { word: 'Nettoskuld', meaning: 'Räntebärande skulder minus likvida medel. Exakt vad som ingår står i bolagets definition.' },
    { word: 'Nettokassa', meaning: 'När de likvida medlen är större än de räntebärande skulderna.' },
    { word: 'Soliditet', meaning: 'Eget kapital i procent av totala tillgångar. Atlas Copco kallar måttet andel eget kapital.' },
    { word: 'EBITDA', meaning: 'Rörelseresultatet före av- och nedskrivningar.' },
    { word: 'Nettoskuld i förhållande till EBITDA', meaning: 'Nettoskulden delad med EBITDA, ungefär hur många års sådant resultat skulden motsvarar.' },
    { word: 'Skuldsättningsgrad', meaning: 'Hos Atlas Copco nettoskulden i procent av det egna kapitalet.' },
    { word: 'Räntetäckningsgrad', meaning: 'Hur många gånger resultatet räcker till att betala räntorna.' },
    { word: 'Hävstång', meaning: 'Att lånade pengar gör ägarnas resultat större både i goda och dåliga år.' },
    { word: 'Löptid', meaning: 'Tiden tills ett lån ska betalas tillbaka.' },
    { word: 'Pensionsskuld', meaning: 'Bolagets skuld för pensioner som anställda har tjänat in.' },
    { word: 'Outnyttjad kredit', meaning: 'En kredit som banken har lovat men som bolaget inte har använt.' },
  ],
  sources: [ATLAS_Q3, ATLAS_DEF, HM_FY25, HM_AR25, VOLVO_Q4, SCB_SOLIDITET, ARL],
  questions: [
    {
      id: 'k2-06-q1',
      text:
        'Ett bolag har tillgångar på 1 000 kronor, eget kapital på 400 och lån på 600 med 5 procents ränta. Rörelseresultatet är 80. Vad blir resultatet i procent av det egna kapitalet, om vi bortser från skatt?',
      options: ['8 procent', '20 procent', '12,5 procent', '5 procent'],
      correct: 2,
      why:
        'Räntan är 5 procent av 600, alltså 30. Resultatet efter ränta är 80 minus 30, alltså 50. Delat med det egna kapitalet ' +
        'på 400 blir det 12,5 procent.',
    },
    {
      id: 'k2-06-q2',
      text: 'Ett bolag har eget kapital på 300 miljoner kronor och totala tillgångar på 1 200 miljoner. Vad är soliditeten?',
      options: ['25 procent', '400 procent', '33 procent', '75 procent'],
      correct: 0,
      why:
        'Soliditeten är det egna kapitalet i procent av de totala tillgångarna: 300 delat med 1 200 är 0,25, alltså 25 procent. ' +
        '33 procent får du om du felaktigt delar med skulderna på 900.',
    },
    {
      id: 'k2-06-q3',
      text:
        'H&M hade den 30 november 2025 en nettoskuld på 57 028 miljoner kronor enligt ett mått och en nettokassa på 233 miljoner enligt ett annat. Hur kan båda stämma?',
      options: [
        'Det ena måttet gäller moderbolaget och det andra ett dotterbolag.',
        'Det ena måttet räknar med leasingskulder och pensioner, det andra inte.',
        'Det ena måttet är i kronor och det andra i euro.',
        'Det ena måttet är från början av året och det andra från slutet.',
      ],
      correct: 1,
      why:
        'Nettoskulden på 57 028 miljoner inkluderar leasingskulder och pensioner. Nettokassan räknar bara lån minus likvida medel: ' +
        '20 675 minus 20 908 ger 233 miljoner i kassa. Därför ska du alltid läsa definitionen.',
    },
    {
      id: 'k2-06-q4',
      text: 'Ett bolag har en nettoskuld på 300 miljoner kronor och en EBITDA på 150 miljoner. Vad är nettoskulden i förhållande till EBITDA?',
      options: ['0,5', '50 procent', '450', '2,0'],
      correct: 3,
      why:
        'Nettoskulden delas med EBITDA: 300 delat med 150 är 2,0. Skulden motsvarar alltså ungefär två års resultat före ' +
        'räntor, skatt och av- och nedskrivningar.',
    },
  ],
};
