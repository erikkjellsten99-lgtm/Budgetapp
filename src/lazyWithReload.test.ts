import { describe, expect, it } from 'vitest';
import { loadOrReload } from './lazyWithReload';

const mod = { default: 'modulen' };

function env(online = true) {
  const store = new Map<string, string>();
  let reloads = 0;
  return {
    reloads: () => reloads,
    store,
    opts: {
      key: 'test',
      online: () => online,
      session: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: string | null) => (v === null ? store.delete(k) : store.set(k, v)) },
      reload: () => {
        reloads += 1;
      },
      fallback: { default: 'reserv' },
    },
  };
}

describe('loadOrReload', () => {
  it('ger modulen och glömmer omladdningen när laddningen lyckas', async () => {
    const e = env();
    e.store.set('test', '1');
    await expect(loadOrReload(() => Promise.resolve(mod), e.opts)).resolves.toBe(mod);
    expect(e.store.has('test')).toBe(false);
  });

  it('laddar om sidan en gång när filen saknas', async () => {
    const e = env();
    const p = loadOrReload(() => Promise.reject(new Error('404')), e.opts);
    await new Promise((r) => setTimeout(r, 0));
    expect(e.reloads()).toBe(1);
    expect(e.store.get('test')).toBe('1');
    expect(await Promise.race([p, new Promise((r) => setTimeout(() => r('väntar'), 20))])).toBe('väntar');
  });

  it('visar reserven i stället för att ladda om igen', async () => {
    const e = env();
    e.store.set('test', '1');
    await expect(loadOrReload(() => Promise.reject(new Error('404')), e.opts)).resolves.toBe(e.opts.fallback);
    expect(e.reloads()).toBe(0);
  });

  it('visar reserven direkt utan uppkoppling', async () => {
    const e = env(false);
    await expect(loadOrReload(() => Promise.reject(new Error('offline')), e.opts)).resolves.toBe(e.opts.fallback);
    expect(e.reloads()).toBe(0);
  });
});
