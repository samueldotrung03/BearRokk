// One small live call to confirm the key, the model name and web search all work on this account.
// Run: npm run grok:check
import { z } from 'zod';
import { config } from '../src/config.ts';
import { grokJson } from '../src/grok.ts';

if (!config.xaiApiKey) {
  console.error('XAI_API_KEY is not set. Put it in backend/.env first.');
  process.exit(1);
}
const started = Date.now();
const { data, citations } = await grokJson({
  name: 'check',
  system: 'Use web search. Answer from what you find.',
  user: 'Find one hackathon listed on devpost.com that is open for registration right now.',
  schema: z.object({ title: z.string(), url: z.string(), quote: z.string() }),
  tools: [{ type: 'web_search' }],
});
console.log(`model ${config.xaiModel} answered in ${Date.now() - started} ms`);
console.log(data);
console.log(`${citations.length} citation(s)`, citations.slice(0, 5));
