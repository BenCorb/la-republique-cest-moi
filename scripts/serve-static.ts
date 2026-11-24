/**
 * Serveur de fichiers statiques minimal pour vérifier le dossier `build/`
 * (`npm run serve:static -- --port 4174 [--base /depot]`).
 *
 * Il reproduit le comportement d'un hébergement statique comme GitHub Pages :
 * aucun rendu côté serveur, uniquement des fichiers, éventuellement sous un
 * sous-répertoire (`--base` ou variable `BASE_PATH`), redirection de `/depot` vers
 * `/depot/` et page `404.html` si elle existe. Outil de développement et de test,
 * jamais utilisé en production. Exécuté directement par Node.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { normalizeBasePath } from './base-path.ts';

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain; charset=utf-8',
	'.woff2': 'font/woff2'
};

const { values } = parseArgs({
	options: {
		port: { type: 'string', default: '4174' },
		host: { type: 'string', default: '127.0.0.1' },
		dir: { type: 'string', default: 'build' },
		base: { type: 'string', default: process.env.BASE_PATH ?? '' }
	}
});

const root = resolve(values.dir);
const base = normalizeBasePath(values.base);
if (!existsSync(join(root, 'index.html'))) {
	console.error(`Aucun build trouvé dans ${root}. Lancer d'abord « npm run build ».`);
	process.exit(1);
}

/** Résout un chemin (sans le base path) vers un fichier du build, sans sortir de la racine. */
function resolveFile(pathname: string): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	const target = normalize(join(root, decoded));
	if (target !== root && !target.startsWith(root + sep)) return null;
	const candidates = [target, `${target}.html`, join(target, 'index.html')];
	return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

function contentType(file: string): string {
	return MIME_TYPES[extname(file)] ?? 'application/octet-stream';
}

const server = createServer((request, response) => {
	const pathname = (request.url ?? '/').split('?')[0] ?? '/';

	// Comme GitHub Pages : `/depot` redirige vers `/depot/`.
	if (base && pathname === base) {
		response.writeHead(301, { location: `${base}/` });
		response.end();
		return;
	}

	const file = pathname.startsWith(`${base}/`) ? resolveFile(pathname.slice(base.length)) : null;
	if (file) {
		response.writeHead(200, { 'content-type': contentType(file) });
		createReadStream(file).pipe(response);
		return;
	}

	const notFoundPage = join(root, '404.html');
	if (existsSync(notFoundPage)) {
		response.writeHead(404, { 'content-type': contentType(notFoundPage) });
		createReadStream(notFoundPage).pipe(response);
		return;
	}
	response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
	response.end('404 — fichier introuvable');
});

server.listen(Number(values.port), values.host, () => {
	console.log(
		`Build statique servi depuis ${root} sur http://${values.host}:${values.port}${base}/`
	);
});
