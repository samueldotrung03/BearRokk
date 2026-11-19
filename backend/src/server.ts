import { serve } from '@hono/node-server';
import { GrokBrain } from './agents/grokBrain.ts';
import { SimBrain } from './agents/simBrain.ts';
import { AgentSystem } from './agents/system.ts';
import { createApp } from './app.ts';
import { firebaseVerifier, webConfig } from './auth.ts';
import { config, liveAvailable, provider } from './config.ts';
import { openStore } from './store/index.ts';
import { cached, writeRoadmap } from './roadmap.ts';

const store = await openStore();
// Live agents need a key; without one the same system runs on simulated agents and sample data.
const newSystem = (profile = {}) =>
  liveAvailable()
    ? new AgentSystem(
        new GrokBrain(),
        config.grokTransport === 'api'
          ? { provider: 'grok' }
          : { provider: provider() === 'claude' ? 'claude' : 'grok', concurrency: config.grokCli.concurrency, maxJobs: config.liveCli.maxJobs, managerStaggerMs: 600 },
        profile,
      )
    : new AgentSystem(new SimBrain({ speed: Number(process.env.SIM_SPEED ?? 0.6) }), { managerStaggerMs: 900 }, profile);
const verify = firebaseVerifier();
const { app } = createApp(store, {}, {
  demo: newSystem(),
  // A student who signs in gets their own agents, named from their Google name or, for email sign-in, the part before the @.
  forUser: (user) => {
    const name = user.name?.split(' ')[0] ?? user.email?.split('@')[0];
    return newSystem(name ? { name } : {});
  },
  verify,
  webConfig: webConfig(),
  roadmap: liveAvailable() ? cached(writeRoadmap) : null,
  grok: !liveAvailable()
    ? { connected: false, mode: 'simulated', detail: 'No Grok connection is configured, so the agents are simulated on sample data.' }
    : config.grokTransport === 'claude'
      ? { connected: false, mode: 'claude', detail: 'For testing, the agents are running on Claude through this computer. Grok is not connected yet.' }
      : config.grokTransport === 'cli'
      ? { connected: true, mode: 'cli', detail: 'Through the Grok app on this computer, on its Grok subscription.' }
      : { connected: true, mode: 'api', detail: `Through the xAI API (${config.xaiModels.normal} and ${config.xaiModels.low}).` },
});

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`backend listening on http://localhost:${port}`);
  console.log(`  store:  ${store.kind === 'firestore' ? 'Firestore' : `local file (${config.localDataFile})`}`);
  const m = config.xaiModels;
  console.log(`  agents: ${!liveAvailable() ? 'simulated on sample data (no XAI_API_KEY)' : config.grokTransport === 'claude' ? `TEST MODE on Claude (${config.claudeCli.models.normal} and ${config.claudeCli.models.low}) through the Claude CLI. Swap to Grok: see SWAP_TO_GROK.md` : config.grokTransport === 'cli' ? `live Grok through the CLI on this machine's subscription (${config.grokCli.bin})` : `live Grok API: master/managers/validation/presentation ${m.normal}, workers ${m.low}`}`);
  console.log(`  sign-in: ${verify ? `Google and email, Firebase project ${config.firebaseWeb.projectId}` : 'off (set FIREBASE_WEB_API_KEY and FIREBASE_PROJECT_ID)'}`);
  console.log(`  watch:  http://localhost:${port}/`);
});
