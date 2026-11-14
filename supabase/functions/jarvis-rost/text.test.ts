import { describe, expect, it } from 'vitest'
import { MAX_SPEECH, speakable, ssml } from './text.ts'

describe('speakable', () => {
  it('skriver ihop tusental och skriver ut kronor', () => {
    expect(speakable('Gemensamt sparmål: 69\u00A0940 kr av 1\u00A0000\u00A0000 kr, 7 %.')).toBe('Gemensamt sparmål: 69940 kronor av 1000000 kronor, 7 procent.')
    expect(speakable('runt 96 000 kronor')).toBe('runt 96000 kronor')
    expect(speakable('Kvar: 1\u202F586 kr.')).toBe('Kvar: 1586 kronor')
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

describe('ssml', () => {
  it('lägger texten i rösten och tar språket från röstens namn', () => {
    expect(ssml('Hej Erik.', 'sv-SE-MattiasNeural')).toBe("<speak version='1.0' xml:lang='sv-SE'><voice name='sv-SE-MattiasNeural'>Hej Erik.</voice></speak>")
    expect(ssml('Hi.', 'en-US-AvaNeural')).toContain("xml:lang='en-US'")
  })

  it('skriver om tecken som betyder något i XML', () => {
    expect(ssml(`Mat & hushåll <"A"> 'b'`, 'sv-SE-SofieNeural')).toContain('Mat &amp; hushåll &lt;&quot;A&quot;&gt; &apos;b&apos;')
    expect(ssml('x', "a'><break/>")).toContain("name='a&apos;&gt;&lt;break/&gt;'")
  })
})
