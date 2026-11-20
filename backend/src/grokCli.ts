// Grok through the Grok Build CLI (`grok -p ...`), signed in with a Grok subscription.
// Same job as the API client in grok.ts: send one prompt, get one JSON answer back.
// Usage is counted against the subscription of whoever ran `grok login` on this machine.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { currentSignal, StoppedError } from './agents/stop.ts';
import { config } from './config.ts';
import type { GrokResult, GrokTool } from './grok.ts';

/** An empty folder for the CLI to run in, so a coding agent has no project files in reach. */
function sandboxDir(): string {
  const dir = join(tmpdir(), 'bearok-grok-cli');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(args: string[], timeoutMs: number): Promise<string> {
  const stop = currentSignal();
  if (stop?.aborted) return Promise.reject(new StoppedError());
  return new Promise((resolve, reject) => {
    const child = spawn(config.grokCli.bin, args, { cwd: sandboxDir(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`grok CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    // The student stopped the search: end this call now rather than when it finishes.
    const onStop = () => {
      clearTimeout(timer);
      child.kill('SIGKILL');
      reject(new StoppedError());
    };
    stop?.addEventListener('abort', onStop, { once: true });
    child.on('close', () => stop?.removeEventListener('abort', onStop));
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? `grok CLI not found at "${config.grokCli.bin}". Install it and run "grok login".` : e.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`grok CLI exited ${code}: ${(err || out).trim().slice(0, 400)}`));
    });
  });
}

/** The CLI's `json` output wraps the answer in an object; its field names are not documented, so look in the likely places. */
export function answerText(stdout: string): string {
  const raw = stdout.trim();
  try {
    const body = JSON.parse(raw);
    if (typeof body === 'string') return body;
    for (const key of ['result', 'response', 'text', 'output', 'content', 'message']) {
      const v = body?.[key];
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v?.content === 'string') return v.content;
      if (typeof v?.text === 'string') return v.text;
    }
    // The answer itself may already be the JSON we asked for.
    return raw;
  } catch {
    return raw;
  }
}

/** The answer the CLI checked against the schema it was given (`--json-schema`), when it returned one. */
export function structuredAnswer(stdout: string): unknown {
  try {
    const body = JSON.parse(stdout.trim());
    const v = body?.structuredOutput ?? body?.structured_output;
    return v && typeof v === 'object' ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Every complete top-level JSON object in a reply, in the order written. */
export function jsonObjects(text: string): unknown[] {
  const found: unknown[] = [];
  let i = 0;
  while ((i = text.indexOf('{', i)) >= 0) {
    let depth = 0;
    let inString = false;
    let end = -1;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (ch === '\\') j++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        end = j;
        break;
      }
    }
    if (end < 0) break;
    try {
      found.push(JSON.parse(text.slice(i, end + 1)));
      i = end + 1;
    } catch {
      i += 1;
    }
  }
  return found;
}

/**
 * The fullest answer in the CLI's output that fits the schema. The CLI sometimes writes an empty
 * copy of the shape before or between its searches, in its text or as its checked answer, so the
 * first object found is not always the real one.
 */
export function fullestAnswer<S extends z.ZodType>(stdout: string, schema: S): z.infer<S> {
  const candidates = [structuredAnswer(stdout), ...jsonObjects(answerText(stdout))].filter((c) => c !== undefined);
  let best: { data: z.infer<S>; size: number } | null = null;
  let firstError: unknown;
  for (const c of candidates) {
    const parsed = schema.safeParse(c);
    if (!parsed.success) {
      firstError ??= parsed.error;
      continue;
    }
    const size = JSON.stringify(parsed.data).length;
    if (!best || size > best.size) best = { data: parsed.data, size };
  }
  if (best) return best.data;
  throw firstError ?? new Error('the reply contained no JSON object');
}

/** Pull the first complete JSON object out of a reply that may have prose or code fences around it. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    const start = c.indexOf('{');
    if (start < 0) continue;
    let depth = 0;
    let inString = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(c.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  throw new Error('the reply contained no JSON object');
}

export async function grokCliJson<S extends z.ZodType>(opts: {
  name: string;
  system: string;
  user: string;
  schema: S;
  tools?: GrokTool[];
  model?: string;
  timeoutMs?: number;
}): Promise<GrokResult<z.infer<S>>> {
  const schema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete schema.$schema;
  const prompt = [
    opts.system,
    opts.tools?.length ? 'Use your web search tool to find and open pages. Do not read, write or run anything on this computer.' : 'Answer from the information given. Do not use any tools.',
    `Reply with one JSON object and nothing else: no explanation, no code fence. Write it once, after your research is done, never as an empty placeholder. It must match this JSON Schema:\n${JSON.stringify(schema)}`,
    `---\n${opts.user}`,
  ].join('\n\n');

  const args = ['-p', prompt, '--output-format', 'json', '--no-auto-update', '--cwd', sandboxDir()];
  if (opts.model) args.push('-m', opts.model);
  // The CLI is a full agent: at its default effort one search takes minutes of thinking between steps.
  if (config.grokCli.effort) args.push('--reasoning-effort', config.grokCli.effort);
  if (!opts.tools?.length) args.push('--disable-web-search');
  // The CLI holds the answer to the schema itself, which is quicker and surer than finding JSON in prose.
  const withSchema = [...args, '--json-schema', JSON.stringify(schema)];
  // Only when switched on: lets the CLI use tools (web search) without a person approving each one.
  if (opts.tools?.length && config.grokCli.alwaysApprove) args.push('--always-approve');

  let lastError: unknown;
  // One retry, without the schema option in case the CLI turned the schema down: the prompt still asks for the JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stdout = await run(attempt === 0 ? withSchema : args, opts.timeoutMs ?? config.grokCli.timeoutMs);
      return { data: fullestAnswer(stdout, opts.schema), citations: [] };
    } catch (e) {
      lastError = e;
      if (e instanceof StoppedError || (e instanceof Error && /not found|timed out/.test(e.message))) break;
    }
  }
  throw lastError;
}
