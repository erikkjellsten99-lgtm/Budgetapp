import { PEOPLE, type AreaId, type Person } from './people';

export type LarState = { area: AreaId | 'alla'; openId: string | null };
export type LarAction =
  | { type: 'filter'; area: AreaId | 'alla' }
  | { type: 'open'; id: string }
  | { type: 'back' };

export function larReducer(state: LarState, action: LarAction): LarState {
  switch (action.type) {
    case 'filter':
      return { ...state, area: action.area };
    case 'open':
      return { ...state, openId: action.id };
    case 'back':
      return { ...state, openId: null };
  }
}

/** Personen som ska visas, eller undefined (då visas listan, även för ett okänt id). */
export function visiblePerson(state: LarState): Person | undefined {
  return state.openId === null ? undefined : PEOPLE.find((p) => p.id === state.openId);
}
