import type { ComponentType } from 'react';

type Loaded<P> = { default: ComponentType<P> };

/** Det loadOrReload behöver av omvärlden. Skilt från webbläsaren så att det går att testa. */
export interface ReloadOptions<M> {
  /** Nyckel i sessionStorage som minns att sidan redan laddats om en gång för den här filen. */
  key: string;
  online: () => boolean;
  session: { get(key: string): string | null; set(key: string, value: string | null): void };
  reload: () => void;
  /** Visas när filen inte går att hämta och omladdning redan är prövad, eller utan uppkoppling. */
  fallback: M;
}

/**
 * Laddar en fil som hämtas först när den behövs. Vanligaste felet: en ny version har publicerats sedan appen
 * öppnades, och den gamla filen finns inte längre på servern. Då laddas sidan om en gång (med den nya versionen).
 * Misslyckas det igen, eller saknas uppkoppling, visas reserven i stället för att hela appen försvinner.
 */
export function loadOrReload<M>(load: () => Promise<M>, o: ReloadOptions<M>): Promise<M> {
  return load()
    .then((module) => {
      o.session.set(o.key, null);
      return module;
    })
    .catch(() => {
      if (o.online() && !o.session.get(o.key)) {
        o.session.set(o.key, '1');
        o.reload();
        return new Promise<never>(() => {});
      }
      return o.fallback;
    });
}

const session = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch {
      // Utan lagring laddas sidan om varje gång filen saknas; det är ändå bättre än en vit skärm.
    }
  },
};

/** Som `import()` för React.lazy, men med omladdning och reserv enligt loadOrReload. */
export function lazyWithReload<P>(load: () => Promise<Loaded<P>>, key: string, fallback: ComponentType<P>): () => Promise<Loaded<P>> {
  return () =>
    loadOrReload(load, {
      key: `omladdad-${key}`,
      online: () => navigator.onLine,
      session,
      reload: () => location.reload(),
      fallback: { default: fallback },
    });
}
