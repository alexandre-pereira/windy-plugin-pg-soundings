import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, isNewer, nextCandidates } from '../src/update';

const RELEASE = 'https://api.github.com/repos/alexandre-pereira/windy-plugin-pg-soundings/releases/latest';

/** Bouchon de fetch : versions publiées sur windy-plugins.com, dernière release GitHub (ou panne) */
const network = (opts: { published: string[]; release?: string | 'down'; cdnDown?: boolean }) => {
    const asked: string[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            asked.push(url);
            if (url === RELEASE) {
                if (opts.release === 'down' || !opts.release) throw new Error('réseau');
                return { ok: true, json: async () => ({ tag_name: `v${opts.release}` }) };
            }
            if (opts.cdnDown) throw new Error('réseau');
            const m = /\/(\d+\.\d+\.\d+)\/plugin\.json$/.exec(url);
            return { ok: !!m && opts.published.includes(m[1]) };
        }),
    );
    return asked;
};

/** Bouchon de localStorage, vide au départ */
const storage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
    });
    return map;
};

describe('recherche de mise à jour', () => {
    let store: Map<string, string>;
    beforeEach(() => {
        store = storage();
    });
    afterEach(() => vi.unstubAllGlobals());

    it('ordonne les versions', () => {
        expect(isNewer('1.12.0', '1.9.0')).toBe(true);
        expect(isNewer('1.9.0', '1.12.0')).toBe(false);
        expect(isNewer('1.12.0', '1.12.0')).toBe(false);
        expect(isNewer('2.0.0', '1.99.9')).toBe(true);
    });

    it('candidates : correctifs et mineures avec des numéros sautés, puis la majeure', () => {
        expect(nextCandidates('1.12.0')).toEqual([
            '1.12.1', '1.12.2', '1.12.3', '1.13.0', '1.14.0', '1.15.0', '2.0.0',
        ]);
    });

    it('GitHub donne la dernière release, vérifiée sur windy-plugins.com : une seule sonde', async () => {
        const asked = network({ published: ['1.10.0', '1.11.0', '1.12.0'], release: '1.12.0' });
        expect(await checkForUpdate('1.9.0')).toBe('1.12.0');
        expect(asked.filter(u => u.includes('windy-plugins.com'))).toHaveLength(1);
    });

    it('une release GitHub absente de windy-plugins.com n’est pas annoncée', async () => {
        network({ published: ['1.10.0', '1.11.0'], release: '1.12.0' });
        expect(await checkForUpdate('1.9.0')).toBe('1.11.0');
    });

    it('sans GitHub, avance de version en version jusqu’à la dernière, même lointaine', async () => {
        const published = ['1.2.0', '1.2.1', '1.2.2', '1.3.0', '1.4.0', '1.4.1', '1.5.0', '1.6.0', '1.6.1', '1.6.2', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0', '1.12.0'];
        network({ published, release: 'down' });
        expect(await checkForUpdate('1.1.6')).toBe('1.12.0');
    });

    it('sans GitHub, passe un numéro sauté', async () => {
        network({ published: ['1.12.2', '1.14.0'], release: 'down' });
        expect(await checkForUpdate('1.12.0')).toBe('1.14.0');
    });

    it('rien de plus récent : null, et le résultat est gardé', async () => {
        network({ published: ['1.12.0'], release: '1.12.0' });
        expect(await checkForUpdate('1.12.0')).toBeNull();
        expect(JSON.parse(store.get('wpp-update-check') as string)).toMatchObject({ from: '1.12.0', latest: null });
    });

    it('une panne du réseau ne cache pas une version pendant des heures', async () => {
        network({ published: [], release: 'down', cdnDown: true });
        expect(await checkForUpdate('1.9.0')).toBeNull();
        expect(store.has('wpp-update-check')).toBe(false);
    });

    it('le résultat gardé est réutilisé tant qu’il est récent', async () => {
        store.set('wpp-update-check', JSON.stringify({ from: '1.9.0', latest: '1.12.0', t: Date.now() }));
        const asked = network({ published: [], release: 'down', cdnDown: true });
        expect(await checkForUpdate('1.9.0')).toBe('1.12.0');
        expect(asked).toHaveLength(0);
    });
});
