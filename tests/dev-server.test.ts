import path from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error : module JavaScript des scripts, sans déclaration de types
import { resolveInside } from '../scripts/dev-server.js';

describe('serveur de développement', () => {
    const root = path.resolve('dist');

    it('sert les fichiers du dossier', () => {
        expect(resolveInside('dist', '/plugin.js')).toBe(path.join(root, 'plugin.js'));
        expect(resolveInside('dist', '/plugin.js?t=1')).toBe(path.join(root, 'plugin.js'));
        expect(resolveInside('dist', '/a/../plugin.js')).toBe(path.join(root, 'plugin.js'));
    });

    it('ne sort jamais du dossier', () => {
        for (const url of [
            '/..%5C.windy-api-key',
            '/..%5C..%5Cbanc3d%5CCNAME',
            '/%2e%2e/.windy-api-key',
            '/../.windy-api-key',
            '/..%2f.windy-api-key',
            '/plugin.js%00.map',
            '/C:%5CWindows%5Cwin.ini',
            '/%E0%A4%A',
        ]) {
            const file = resolveInside('dist', url);
            expect(file === null || file.startsWith(root + path.sep), url).toBe(true);
            expect(file, url).not.toBe(path.resolve('.windy-api-key'));
        }
        expect(resolveInside('dist', '/..%5C.windy-api-key')).toBeNull();
        expect(resolveInside('dist', '/')).toBeNull();
    });
});
