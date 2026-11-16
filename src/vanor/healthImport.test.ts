import { describe, expect, it } from 'vitest';
import { AppleExportReader, sumWithoutOverlap } from './appleExport';
import { mergeHealthImport, parseHealthFile, summarizeHealth } from './healthImport';

const rec = (type: string, source: string, start: string, end: string, value: string, unit = '') =>
  ` <Record type="HK${/Sleep|Stand|Mindful/.test(type) ? 'Category' : 'Quantity'}TypeIdentifier${type}" sourceName="${source}" unit="${unit}" creationDate="${end} +0100" startDate="${start} +0100" endDate="${end} +0100" value="${value}"/>`;

function read(lines: string[]) {
  const reader = new AppleExportReader();
  for (const l of lines) reader.line(l);
  return reader;
}

describe('Apple Hälsas export', () => {
  it('lägger ihop steg per dag och räknar inte klocka och telefon dubbelt', () => {
    const days = read([
      rec('StepCount', 'Eriks Apple Watch', '2025-03-01 08:00:00', '2025-03-01 08:10:00', '1000', 'count'),
      rec('StepCount', 'Eriks iPhone', '2025-03-01 08:05:00', '2025-03-01 08:15:00', '900', 'count'),
      rec('StepCount', 'Eriks iPhone', '2025-03-01 12:00:00', '2025-03-01 12:10:00', '432', 'count'),
      rec('StepCount', 'Eriks iPhone', '2025-03-02 09:00:00', '2025-03-02 09:10:00', '50', 'count'),
    ]).days();
    expect(days.map((d) => [d.date, d.values.steps])).toEqual([
      ['2025-03-01', 1432],
      ['2025-03-02', 50],
    ]);
  });

  it('två mätningar från samma källa räknas båda, även om de överlappar', () => {
    expect(sumWithoutOverlap([{ s: 0, e: 10, v: 5, rank: 1 }, { s: 5, e: 15, v: 7, rank: 1 }])).toBe(12);
  });

  it('gör om enheter och tar senaste värdet för vikt och snittet för syre', () => {
    const [day] = read([
      rec('BodyMass', 'Våg', '2025-03-01 07:00:00', '2025-03-01 07:00:00', '180', 'lb'),
      rec('BodyMass', 'Våg', '2025-03-01 20:00:00', '2025-03-01 20:00:00', '83.5', 'kg'),
      rec('OxygenSaturation', 'Eriks Apple Watch', '2025-03-01 02:00:00', '2025-03-01 02:00:00', '0.96', '%'),
      rec('OxygenSaturation', 'Eriks Apple Watch', '2025-03-01 03:00:00', '2025-03-01 03:00:00', '0.98', '%'),
      rec('DistanceWalkingRunning', 'Eriks iPhone', '2025-03-01 09:00:00', '2025-03-01 09:30:00', '2', 'mi'),
    ]).days();
    expect(day.values.weightKg).toBe(83.5);
    expect(day.values.spo2).toBe(97);
    expect(day.values.distanceKm).toBeCloseTo(3.22, 2);
  });

  it('räknar natten till dagen du vaknar, med faser, och tar bara en källa', () => {
    const [day] = read([
      rec('SleepAnalysis', 'Eriks Apple Watch', '2025-03-01 23:00:00', '2025-03-02 02:00:00', 'HKCategoryValueSleepAnalysisAsleepCore'),
      rec('SleepAnalysis', 'Eriks Apple Watch', '2025-03-02 02:00:00', '2025-03-02 02:10:00', 'HKCategoryValueSleepAnalysisAwake'),
      rec('SleepAnalysis', 'Eriks Apple Watch', '2025-03-02 02:10:00', '2025-03-02 04:10:00', 'HKCategoryValueSleepAnalysisAsleepDeep'),
      rec('SleepAnalysis', 'Eriks Apple Watch', '2025-03-02 04:10:00', '2025-03-02 06:10:00', 'HKCategoryValueSleepAnalysisAsleepREM'),
      rec('SleepAnalysis', 'Sömnapp', '2025-03-01 23:00:00', '2025-03-02 06:00:00', 'HKCategoryValueSleepAnalysisAsleepUnspecified'),
      rec('SleepAnalysis', 'Eriks iPhone', '2025-03-01 22:45:00', '2025-03-02 06:30:00', 'HKCategoryValueSleepAnalysisInBed'),
    ]).days();
    expect(day.date).toBe('2025-03-02');
    expect(day.values).toMatchObject({ sleepH: 7, sleepDeepH: 2, sleepCoreH: 3, sleepRemH: 2, sleepAwakeMin: 10, sleepWakes: 1, inBedH: 7.75, bedtime: 23, wakeTime: 6.167 });
    expect(day.stages?.map((s) => s.k)).toEqual(['core', 'awake', 'deep', 'rem']);
  });

  it('räknar ståtimmar, mindfulness och träningspass och hoppar över okända typer', () => {
    const reader = read([
      rec('AppleStandHour', 'Eriks Apple Watch', '2025-03-01 08:00:00', '2025-03-01 09:00:00', 'HKCategoryValueAppleStandHourStood'),
      rec('AppleStandHour', 'Eriks Apple Watch', '2025-03-01 09:00:00', '2025-03-01 10:00:00', 'HKCategoryValueAppleStandHourIdle'),
      rec('MindfulSession', 'Eriks Apple Watch', '2025-03-01 07:00:00', '2025-03-01 07:03:00', 'HKCategoryValueNotApplicable'),
      rec('HeadphoneAudioExposure', 'Eriks iPhone', '2025-03-01 07:00:00', '2025-03-01 07:03:00', '70', 'dBASPL'),
      ' <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" startDate="2025-03-01 17:00:00 +0100" endDate="2025-03-01 17:30:00 +0100">',
      ' <ExportDate value="2025-03-02 10:00:00 +0100"/>',
    ]);
    expect(reader.days()[0].values).toEqual({ standHours: 1, mindfulMin: 3, workouts: 1 });
    expect([...reader.skipped]).toEqual([['HeadphoneAudioExposure', 1]]);
    expect(reader.exported).toBe('2025-03-02 10:00:00 +0100');
  });
});

describe('importfilen', () => {
  const file = (days: unknown) => JSON.stringify({ format: 'groundwork-halsa', version: 1, days });

  it('läser dagar och rensar bort okända mått, konstiga värden och datum som inte finns', () => {
    const days = parseHealthFile(
      file([
        { date: '2025-03-02', values: { steps: 8432, hittepa: 4, weightKg: -1, vo2Max: 'hög' }, stages: [{ k: 'core', s: 1, e: 2 }, { k: 'x', s: 1, e: 2 }] },
        { date: '2025-02-30', values: { steps: 1 } },
        { date: '2025-03-01', values: {} },
      ]),
    );
    expect(days).toEqual([{ date: '2025-03-02', values: { steps: 8432 }, stages: [{ k: 'core', s: 1, e: 2 }] }]);
  });

  it('säger vad som är fel', () => {
    expect(() => parseHealthFile('hej')).toThrow('går inte att läsa');
    expect(() => parseHealthFile('{"days":[]}')).toThrow('ingen hälsofil');
    expect(() => parseHealthFile(file([]))).toThrow('inga dagar');
  });

  it('fyller bara i det som saknas: värden som redan finns ändras aldrig', () => {
    const existing = [{ date: '2025-03-02', updated: 5, values: { steps: 9000, sleepScore: 88 } }];
    const merged = mergeHealthImport(
      existing,
      [
        { date: '2025-03-01', values: { steps: 100 } },
        { date: '2025-03-02', values: { steps: 8432, vo2Max: 41.2, sleepH: 7, sleepDeepH: 1 }, stages: [{ k: 'deep', s: 1, e: 2 }] },
      ],
      99,
    );
    expect(merged.puts).toEqual([
      { date: '2025-03-01', updated: 99, values: { steps: 100 } },
      { date: '2025-03-02', updated: 99, values: { steps: 9000, sleepScore: 88, vo2Max: 41.2, sleepH: 7, sleepDeepH: 1 }, stages: [{ k: 'deep', s: 1, e: 2 }] },
    ]);
    expect(merged).toMatchObject({ newDays: 1, filledDays: 1, values: 4 });
  });

  it('rör inte sömnen en dag som redan har sömn från genvägen', () => {
    const existing = [{ date: '2025-03-02', updated: 5, values: { sleepH: 6.5 } }];
    const merged = mergeHealthImport(existing, [{ date: '2025-03-02', values: { sleepH: 7, sleepDeepH: 1, bedtime: 23, respRate: 14 }, stages: [{ k: 'deep', s: 1, e: 2 }] }], 99);
    expect(merged.puts).toEqual([{ date: '2025-03-02', updated: 99, values: { sleepH: 6.5, respRate: 14 } }]);
  });

  it('gör ingenting andra gången samma fil läses in', () => {
    const days = [{ date: '2025-03-01', values: { steps: 100 } }];
    const first = mergeHealthImport([], days, 1);
    expect(mergeHealthImport(first.puts, days, 2).puts).toEqual([]);
  });

  it('räknar dagar och summa eller snitt per mått', () => {
    const summary = summarizeHealth([
      { date: '2025-03-01', values: { steps: 100, restingHr: 60 } },
      { date: '2025-03-02', values: { steps: 50, restingHr: 62 } },
    ]);
    expect(summary).toEqual([
      { metric: 'steps', days: 2, total: 150, kind: 'sum', first: '2025-03-01', last: '2025-03-02' },
      { metric: 'restingHr', days: 2, total: 61, kind: 'mean', first: '2025-03-01', last: '2025-03-02' },
    ]);
  });
});
