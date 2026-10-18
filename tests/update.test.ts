import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdate, isNewer, nextCandidates } from '../src/update';

/** Bouchon de fetch : versions publiées sur windy-plugins.com (ou panne) */
const network = (opts: { published: string[]; cdnDown?: boolean }) => {
    const asked: string[] = [];
    vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
            asked.push(url);
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

    it('ne demande qu’à windy-plugins.com', async () => {
        const asked = network({ published: ['1.10.0', '1.11.0', '1.12.0'] });
        expect(await checkForUpdate('1.9.0')).toBe('1.12.0');
        expect(asked.every(u => u.startsWith('https://windy-plugins.com/'))).toBe(true);
    });

    it('avance de version en version jusqu’à la dernière, même lointaine, en 10 requêtes au plus', async () => {
        const published = ['1.2.0', '1.2.1', '1.2.2', '1.3.0', '1.4.0', '1.4.1', '1.5.0', '1.6.0', '1.6.1', '1.6.2', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0', '1.12.0'];
        const asked = network({ published });
        expect(await checkForUpdate('1.1.6')).toBe('1.12.0');
        expect(asked.length).toBeLessThanOrEqual(10);
    });

    it('à jour, ou en retard d’un correctif ou d’une mineure : 10 requêtes au plus', async () => {
        for (const [current, published, expected] of [
            ['1.14.0', ['1.14.0'], null],
            ['1.14.0', ['1.14.0', '1.14.1'], '1.14.1'],
            ['1.14.0', ['1.14.0', '1.15.0'], '1.15.0'],
            ['1.14.0', ['1.14.0', '1.14.1', '1.15.0', '1.15.1', '1.16.0'], '1.16.0'],
        ] as const) {
            store.clear();
            const asked = network({ published: [...published] });
            expect(await checkForUpdate(current)).toBe(expected);
            expect(asked.length).toBeLessThanOrEqual(10);
        }
    });

    it('très en retard : une version plus récente tout de suite, la dernière aux recherches suivantes', async () => {
        // Une version par mineure, de 1.0.0 à 1.40.0 : trop loin pour 10 requêtes
        const published = Array.from({ length: 41 }, (_, k) => `1.${k}.0`);
        const asked = network({ published });
        let latest = await checkForUpdate('1.0.0');
        expect(latest && isNewer(latest, '1.0.0')).toBe(true);
        expect(asked.length).toBeLessThanOrEqual(10);
        for (let k = 0; k < 10 && latest !== '1.40.0'; k++) {
            // Résultat gardé périmé : la recherche suivante repart de la version déjà trouvée
            store.set('wpp-update-check', JSON.stringify({ from: '1.0.0', latest, t: 0 }));
            asked.length = 0;
            latest = await checkForUpdate('1.0.0');
            expect(asked.length).toBeLessThanOrEqual(10);
        }
        expect(latest).toBe('1.40.0');
    });

    it('passe un numéro sauté', async () => {
        network({ published: ['1.12.2', '1.14.0'] });
        expect(await checkForUpdate('1.12.0')).toBe('1.14.0');
    });

    it('rien de plus récent : null, et le résultat est gardé', async () => {
        network({ published: ['1.12.0'] });
        expect(await checkForUpdate('1.12.0')).toBeNull();
        expect(JSON.parse(store.get('wpp-update-check') as string)).toMatchObject({ from: '1.12.0', latest: null });
    });

    it('une panne du réseau ne cache pas une version pendant des heures', async () => {
        network({ published: [], cdnDown: true });
        expect(await checkForUpdate('1.9.0')).toBeNull();
        expect(store.has('wpp-update-check')).toBe(false);
    });

    it('le résultat gardé est réutilisé tant qu’il est récent', async () => {
        store.set('wpp-update-check', JSON.stringify({ from: '1.9.0', latest: '1.12.0', t: Date.now() }));
        const asked = network({ published: [], cdnDown: true });
        expect(await checkForUpdate('1.9.0')).toBe('1.12.0');
        expect(asked).toHaveLength(0);
    });
});
