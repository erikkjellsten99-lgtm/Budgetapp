import { describe, expect, it } from 'vitest'
import { MAX_SPEECH, speakable } from './text.ts'

describe('speakable', () => {
  it('skriver ihop tusental och skriver ut kronor', () => {
    expect(speakable('Gemensamt sparmål: 69 940 kr av 1 000 000 kr, 7 %.')).toBe('Gemensamt sparmål: 69940 kronor av 1000000 kronor, 7 procent.')
    expect(speakable('runt 96 000 kronor')).toBe('runt 96000 kronor')
    expect(speakable('Kvar: 1 586 kr.')).toBe('Kvar: 1586 kronor')
  })

  it('rör inte tal som inte är tusental', () => {
    expect(speakable('om 2 år och 10 månader, den 14 december 2026')).toBe('om 2 år och 10 månader, den 14 december 2026')
    expect(speakable('3 av 7')).toBe('3 av 7')
    expect(speakable('mellan 10-12 dagar')).toBe('mellan 10-12 dagar')
  })

  it('skriver ut minus och tar bort formatering', () => {
    expect(speakable('**Blir över:** −1 200 kr')).toBe('Blir över: minus 1200 kronor')
    expect(speakable('  två\n\nrader  ')).toBe('två rader')
  })

  it('kortar långa texter', () => {
    expect(speakable('a'.repeat(5000))).toHaveLength(MAX_SPEECH)
  })
})
