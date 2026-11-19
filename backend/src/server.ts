import { serve } from '@hono/node-server';
import { GrokBrain } from './agents/grokBrain.ts';
import { SimBrain } from './agents/simBrain.ts';
import { AgentSystem } from './agents/system.ts';
import { createApp } from './app.ts';
import { config, liveAvailable } from './config.ts';
import { openStore } from './store/index.ts';

const store = await openStore();
// Live agents need a key; without one the same system runs on simulated agents and sample data.
const agents = liveAvailable()
  ? new AgentSystem(new GrokBrain())
  : new AgentSystem(new SimBrain({ speed: Number(process.env.SIM_SPEED ?? 0.6) }), { managerStaggerMs: 900 });
const { app } = createApp(store, {}, agents);

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`backend listening on http://localhost:${port}`);
  console.log(`  store:  ${store.kind === 'firestore' ? 'Firestore' : `local file (${config.localDataFile})`}`);
  const m = config.xaiModels;
  console.log(`  agents: ${liveAvailable() ? `live Grok: master/managers/validation/presentation ${m.normal}, workers ${m.low}` : 'simulated on sample data (no XAI_API_KEY)'}`);
  console.log(`  watch:  http://localhost:${port}/`);
});
