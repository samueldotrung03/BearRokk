// TEMPORARY, FOR TESTING: runs the agents on Claude through the Claude Code CLI (`claude -p`),
// on the Claude account signed in on this machine. It exists so the live agent system can be
// exercised before Grok access arrives. The product runs on Grok: see ../SWAP_TO_GROK.md.
//
// Same job as grok.ts and grokCli.ts: send one prompt, get one JSON answer back.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from './config.ts';
import type { GrokResult, GrokTool } from './grok.ts';
import { extractJson } from './grokCli.ts';

/** An empty folder to run in, so the CLI has no project files, settings or memory in reach. */
function sandboxDir(): string {
  const dir = join(tmpdir(), 'bearok-claude-cli');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The backend may itself have been started from a Claude Code session; do not pass that session's settings on. */
function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_')) delete env[key];
  return env;
}

function run(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.claudeCli.bin, args, { cwd: sandboxDir(), env: cleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? `claude CLI not found at "${config.claudeCli.bin}"` : e.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      // The CLI reports most failures as JSON on stdout with a non-zero exit, so hand that back to be read.
      if (code === 0 || out.trim().startsWith('{')) resolve(out);
      else reject(new Error(`claude CLI exited ${code}: ${(err || out).trim().slice(0, 400)}`));
    });
  });
}

export async function claudeCliJson<S extends z.ZodType>(opts: {
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
  const search = Boolean(opts.tools?.length);

  const args = [
    '-p', opts.user,
    '--system-prompt', `${opts.system}\n\n${search ? 'Use web search and page fetches to find and open pages. You have no other tools.' : 'Answer from the information given. You have no tools.'}`,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    '--model', opts.model ?? config.claudeCli.models.normal,
    // Only the two web tools, or none at all: no shell, no file access.
    '--tools', search ? 'WebSearch,WebFetch' : '',
    // Nothing from this machine's own Claude Code set-up: no settings, hooks, plugins, memory or connectors.
    '--setting-sources', '',
    '--strict-mcp-config',
    '--no-session-persistence',
  ];
  if (search) args.push('--allowedTools', 'WebSearch', 'WebFetch');

  const stdout = await run(args, opts.timeoutMs ?? config.claudeCli.timeoutMs);
  let body: any;
  try {
    body = JSON.parse(stdout);
  } catch {
    throw new Error(`claude CLI returned something that is not JSON: ${stdout.trim().slice(0, 300)}`);
  }
  if (body.is_error || body.subtype !== 'success') throw new Error(`claude CLI: ${String(body.result ?? body.subtype ?? 'failed').slice(0, 300)}`);
  // With --json-schema the validated answer is in structured_output; fall back to reading the text.
  const answer = body.structured_output ?? extractJson(String(body.result ?? ''));
  return { data: opts.schema.parse(answer), citations: [] };
}
