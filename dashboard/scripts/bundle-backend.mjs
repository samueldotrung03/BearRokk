// Gets the backend ready to travel inside the desktop app.
//   electron/app-config.json   the public Firebase settings the bundled backend needs for sign-in
//   backend-bundle/            the backend's code and the packages it needs on a student's laptop
// firebase-admin is left out on purpose: it is only used with a service account, and a service
// account never ships in the app.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dashboard = join(here, '..');
const backend = join(dashboard, '..', 'backend');

// The same values the page already carries; they identify the project and are not secrets.
const source = readFileSync(join(dashboard, 'src', 'auth', 'firebase.ts'), 'utf8');
const value = (name) => new RegExp(`${name}:\\s*'([^']+)'`).exec(source)?.[1];
const config = { apiKey: value('apiKey'), projectId: value('projectId'), authDomain: value('authDomain') };
if (!config.apiKey || !config.projectId) throw new Error('could not read the Firebase settings from src/auth/firebase.ts');
writeFileSync(join(dashboard, 'electron', 'app-config.json'), JSON.stringify(config, null, 2));

if (process.argv.includes('--config-only')) process.exit(0);

const out = join(dashboard, 'backend-bundle');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(backend, 'src'), join(out, 'src'), { recursive: true });
cpSync(join(backend, 'public'), join(out, 'public'), { recursive: true });
const pkg = JSON.parse(readFileSync(join(backend, 'package.json'), 'utf8'));
const { 'firebase-admin': _left, ...dependencies } = pkg.dependencies;
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'bearrok-backend', private: true, type: 'module', dependencies }, null, 2));
cpSync(join(backend, 'package-lock.json'), join(out, 'package-lock.json'));
execFileSync('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: out, stdio: 'inherit' });
console.log(`backend bundled into ${out}`);
