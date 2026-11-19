// Thin client for the xAI Responses API with structured output and server-side search tools.
import { z } from 'zod';
import { config } from './config.ts';

export type GrokTool = { type: 'web_search' } | { type: 'x_search' };

export type GrokResult<T> = { data: T; citations: string[] };

export async function grokJson<S extends z.ZodType>(opts: {
  name: string;
  system: string;
  user: string;
  schema: S;
  tools?: GrokTool[];
  /** Model to use for this call. Defaults to XAI_MODEL. */
  model?: string;
  timeoutMs?: number;
}): Promise<GrokResult<z.infer<S>>> {
  if (!config.xaiApiKey) throw new Error('XAI_API_KEY is not set');

  const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const res = await fetch(`${config.xaiBaseUrl}/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.xaiApiKey}` },
    signal: AbortSignal.timeout(opts.timeoutMs ?? config.grokTimeoutMs),
    body: JSON.stringify({
      model: opts.model ?? config.xaiModel,
      input: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
      text: { format: { type: 'json_schema', name: opts.name, schema: jsonSchema, strict: true } },
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`Grok ${res.status}: ${raw.slice(0, 500)}`);

  const body = JSON.parse(raw);
  const text = extractText(body);
  if (!text) throw new Error(`Grok returned no text: ${raw.slice(0, 500)}`);
  return { data: opts.schema.parse(JSON.parse(text)), citations: extractCitations(body) };
}

/** Final message text from a Responses API body. */
export function extractText(body: any): string {
  if (typeof body?.output_text === 'string' && body.output_text) return body.output_text;
  const parts: string[] = [];
  for (const item of body?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
    }
  }
  return parts.join('');
}

/** URLs the model cited, from the top-level list and from inline annotations. */
export function extractCitations(body: any): string[] {
  const urls = new Set<string>();
  for (const c of body?.citations ?? []) {
    if (typeof c === 'string') urls.add(c);
    else if (typeof c?.url === 'string') urls.add(c.url);
  }
  for (const item of body?.output ?? []) {
    for (const c of item?.content ?? []) {
      for (const a of c?.annotations ?? []) if (typeof a?.url === 'string') urls.add(a.url);
    }
  }
  return [...urls];
}
