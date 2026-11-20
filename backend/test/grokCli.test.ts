import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { z } from 'zod';

// A stand-in for the real `grok` program: records its arguments and prints a canned reply.
const dir = mkdtempSync(join(tmpdir(), 'fake-grok-'));
const bin = join(dir, 'grok');
writeFileSync(
  bin,
  `#!/bin/sh
printf '%s\\n' "$@" > "${dir}/args"
n=$(cat "${dir}/count" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "${dir}/count"
cat "${dir}/reply-$n" 2>/dev/null || cat "${dir}/reply"
exit $(cat "${dir}/exit" 2>/dev/null || echo 0)
`,
);
chmodSync(bin, 0o755);
process.env.GROK_TRANSPORT = 'cli';
process.env.GROK_CLI_BIN = bin;

const { grokJson } = await import('../src/grok.ts');
const { answerText, extractJson, structuredAnswer, fullestAnswer } = await import('../src/grokCli.ts');
const { readFileSync, rmSync } = await import('node:fs');
const Schema = z.object({ title: z.string(), url: z.string() });
const reset = () => { for (const f of ['count', 'reply-1', 'reply-2', 'exit']) rmSync(join(dir, f), { force: true }); };

test('CLI replies are unwrapped from the json envelope, prose and code fences', () => {
  assert.equal(answerText('{"result":"hello","session_id":"s1"}'), 'hello');
  assert.equal(answerText('{"message":{"content":"hi"}}'), 'hi');
  assert.equal(answerText('plain words'), 'plain words');
  assert.deepEqual(extractJson('Sure! ```json\n{"a":{"b":"}"}}\n``` done'), { a: { b: '}' } });
  assert.deepEqual(extractJson('Here it is: {"a":1} thanks'), { a: 1 });
  assert.throws(() => extractJson('no json here'));
});

test('grokJson goes through the CLI when GROK_TRANSPORT=cli', async () => {
  reset();
  writeFileSync(join(dir, 'reply'), JSON.stringify({ result: '```json\n{"title":"Winter Hack","url":"https://example.org/w"}\n```' }));
  const { data } = await grokJson({ name: 't', system: 'You are a scout.', user: 'Find one.', schema: Schema, tools: [{ type: 'web_search' }], model: 'some-model' });
  assert.deepEqual(data, { title: 'Winter Hack', url: 'https://example.org/w' });
  const args = readFileSync(join(dir, 'args'), 'utf8');
  assert.match(args, /^-p\n/);
  assert.match(args, /You are a scout\./);
  assert.match(args, /"required":\["title","url"\]/);
  assert.match(args, /--output-format\njson/);
  assert.match(args, /-m\nsome-model/);
  // Tools are not auto-approved unless the setting is turned on.
  assert.doesNotMatch(args, /--always-approve/);
});

test('a reply that is not valid JSON is asked for once more', async () => {
  reset();
  writeFileSync(join(dir, 'reply-1'), 'Sorry, here you go:');
  writeFileSync(join(dir, 'reply-2'), '{"title":"A","url":"https://example.org/a"}');
  const { data } = await grokJson({ name: 't', system: 's', user: 'u', schema: Schema });
  assert.equal(data.title, 'A');
  assert.equal(readFileSync(join(dir, 'count'), 'utf8').trim(), '2');
});

test('a failing CLI gives a readable error', async () => {
  reset();
  writeFileSync(join(dir, 'reply'), 'not logged in');
  writeFileSync(join(dir, 'exit'), '1');
  await assert.rejects(grokJson({ name: 't', system: 's', user: 'u', schema: Schema }), /grok CLI exited 1: not logged in/);
});

test('the answer the CLI checked against the schema is used when it returns one', () => {
  assert.deepEqual(structuredAnswer('{"text":"{\\"a\\":1}","structuredOutput":{"a":1}}'), { a: 1 });
  assert.equal(structuredAnswer('{"text":"words only"}'), undefined);
  assert.equal(structuredAnswer('not json'), undefined);
});

test('an empty placeholder written before the real answer does not win', () => {
  const schema = z.object({ items: z.array(z.string()) });
  const out = JSON.stringify({ text: '{"items":[]}\n\n{"items":["a","b"]}', structuredOutput: { items: [] } });
  assert.deepEqual(fullestAnswer(out, schema), { items: ['a', 'b'] });
  assert.deepEqual(fullestAnswer(JSON.stringify({ text: 'done', structuredOutput: { items: ['x'] } }), schema), { items: ['x'] });
  assert.throws(() => fullestAnswer(JSON.stringify({ text: 'no answer here' }), schema));
});
