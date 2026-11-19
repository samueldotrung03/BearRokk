// Grok through the Grok Build CLI (`grok -p ...`), signed in with a Grok subscription.
// Same job as the API client in grok.ts: send one prompt, get one JSON answer back.
// Usage is counted against the subscription of whoever ran `grok login` on this machine.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from './config.ts';
import type { GrokResult, GrokTool } from './grok.ts';

/** An empty folder for the CLI to run in, so a coding agent has no project files in reach. */
function sandboxDir(): string {
  const dir = join(tmpdir(), 'bearok-grok-cli');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.grokCli.bin, args, { cwd: sandboxDir(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`grok CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
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
    `Reply with one JSON object and nothing else: no explanation, no code fence. It must match this JSON Schema:\n${JSON.stringify(schema)}`,
    `---\n${opts.user}`,
  ].join('\n\n');

  const args = ['-p', prompt, '--output-format', 'json', '--no-auto-update', '--cwd', sandboxDir()];
  if (opts.model) args.push('-m', opts.model);
  // Only when switched on: lets the CLI use tools (web search) without a person approving each one.
  if (opts.tools?.length && config.grokCli.alwaysApprove) args.push('--always-approve');

  let lastError: unknown;
  // One retry: a reply that is not valid JSON is usually fixed by asking again.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const stdout = await run(args, opts.timeoutMs ?? config.grokCli.timeoutMs);
      return { data: opts.schema.parse(extractJson(answerText(stdout))), citations: [] };
    } catch (e) {
      lastError = e;
      if (e instanceof Error && /not found|timed out/.test(e.message)) break;
    }
  }
  throw lastError;
}
