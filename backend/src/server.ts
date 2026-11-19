import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { config, liveAvailable } from './config.ts';
import { openStore } from './store/index.ts';

const store = await openStore();
const { app } = createApp(store);

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`backend listening on http://localhost:${port}`);
  console.log(`  store:  ${store.kind === 'firestore' ? 'Firestore' : `local file (${config.localDataFile})`}`);
  console.log(`  search: ${liveAvailable() ? `live, Grok ${config.xaiModel}` : 'prepared examples only (no XAI_API_KEY)'}`);
});
