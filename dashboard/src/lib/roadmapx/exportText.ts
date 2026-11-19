// The roadmap as plain text, for pasting into notes, a message to an advisor, or a doc.
import { formatHours, type CoachContext } from './context.ts';
import { pace, readiness } from './readiness.ts';

export function roadmapAsText(ctx: CoachContext, notes: Record<string, string> = {}): string {
  const score = readiness(ctx);
  const status = pace(ctx);
  const done = ctx.steps.filter((s) => s.done).length;
  const date = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const lines: string[] = [
    `Roadmap: ${ctx.goal}`,
    `${ctx.profile.fullName}, ${ctx.profile.year}, ${ctx.profile.major}`,
    '',
    `Readiness ${score.score}/100 · ${done} of ${ctx.steps.length} steps done · ${status.label}`,
    '',
    'What this goal asks for',
    ...ctx.requirements.map((r) => `  [${r.met ? 'x' : ' '}] ${r.label}`),
  ];

  const groups = new Map<string, typeof ctx.steps>();
  for (const step of ctx.steps) groups.set(step.phase, [...(groups.get(step.phase) ?? []), step]);
  for (const [phase, steps] of groups) {
    lines.push('', phase);
    for (const step of steps) {
      const bits = [step.due ? `by ${date(step.due)}` : null, `about ${formatHours(step.hours)}`];
      if (step.evidence) bits.push(`${step.evidence.count} of ${step.evidence.total} people did this`);
      lines.push(`  [${step.done ? 'x' : ' '}] ${step.title} (${bits.filter(Boolean).join(', ')})`);
      const note = notes[step.id]?.trim();
      if (note) lines.push(`      Note: ${note.replace(/\s+/g, ' ')}`);
    }
  }
  lines.push('', 'Made with BearRok. Hours are rough estimates; counts come from sample profiles.');
  return lines.join('\n');
}
