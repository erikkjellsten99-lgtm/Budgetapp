/**
 * Navigeringen (designspec "Två rum"): fyra flikar i vardagsrummet. Jarvis är inte en flik utan ett rum
 * som öppnas med orben. Ekonomi har egna underflikar.
 */
export type Section = 'idag' | 'ekonomi' | 'vanor' | 'nyheter';
export type EconomyView = 'overview' | 'budget' | 'goal' | 'assets' | 'wishlist';
export type View = 'idag' | 'nyheter' | 'vanor' | 'account' | EconomyView;

/** Huvudflikarna. Ikonerna är enkla linjer i ett 24×24-rutnät. */
export const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'idag', label: 'Idag', icon: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'ekonomi', label: 'Ekonomi', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'vanor', label: 'Vanor', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.2l2.7 2.6L16.2 9.4' },
  { id: 'nyheter', label: 'Nyheter', icon: 'M5 4h11v15a1 1 0 0 0 2 0V8h2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM8 8h5M8 12h5M8 16h3' },
];

/** Underflikarna i Ekonomi. */
export const ECONOMY: { id: EconomyView; label: string }[] = [
  { id: 'overview', label: 'Översikt' },
  { id: 'budget', label: 'Budget' },
  { id: 'goal', label: 'Prognos' },
  { id: 'assets', label: 'Konton' },
  { id: 'wishlist', label: 'Önskelista' },
];

/** Underflikarna som syns (segmentväljaren). Konton och Önskelista öppnas från rader i Översikt. */
export type EconomyTab = 'overview' | 'budget' | 'goal';
export const ECONOMY_TABS: { id: EconomyTab; label: string }[] = [
  { id: 'overview', label: 'Översikt' },
  { id: 'budget', label: 'Budget' },
  { id: 'goal', label: 'Prognos' },
];

/** Vilken underflik som är vald när en vy visas. Konton och Önskelista hör till Översikt. */
export const tabOf = (view: EconomyView): EconomyTab => (view === 'assets' || view === 'wishlist' ? 'overview' : view);

export const isEconomy = (view: string): view is EconomyView => ECONOMY.some((item) => item.id === view);

export const sectionOf = (view: View): Section | null =>
  view === 'idag' || view === 'vanor' || view === 'nyheter' ? view : isEconomy(view) ? 'ekonomi' : null;

/** Vyn att öppna appen på, från det som sparats. Vyer som inte längre finns (Jarvis, Träning) leder rätt. */
export function restoreView(saved: string | null): View {
  if (saved === 'traning') return 'vanor'; // Träning fanns en tid som egen flik.
  if (saved === 'idag' || saved === 'vanor' || saved === 'nyheter' || saved === 'account') return saved;
  if (saved && isEconomy(saved)) return saved;
  return 'idag';
}
