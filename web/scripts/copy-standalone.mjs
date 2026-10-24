// Copy the single-file build to the repository root as ARTC.html.
import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../ARTC.html');
copyFileSync(resolve(here, '../dist-standalone/index.html'), target);
console.log(`Wrote ${target}`);
