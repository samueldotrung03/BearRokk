// One career's guide, as four parts shown one at a time in the order a student needs them: the
// basics, what people in the job say, how to start, and what the interviews ask. Each part fills in
// when the agents finish it, and "Add more" sends that part's researcher back for new items. While
// the agents work, one line says what they are doing.
import { ArrowRight, ExternalLink, Plus, RotateCw, Target } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  isBusy,
  isResearching,
  providerLabel,
  SECTION_IDS,
  SECTION_TITLES,
  stepLine,
  type Basics,
  type Guide,
  type Interview,
  type PostTopic,
  type SectionId,
  type SectionState,
  type Start,
  type Voices,
} from '../../lib/discover/guide.ts';
import { PartIcon } from './CareerGuideIcons.tsx';

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return dateLabel(iso);
}

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="dc-link">
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function Sources({ list }: { list: { title: string; url: string }[] }) {
  if (!list.length) return null;
  return (
    <p className="dc-sources">
      <span>Sources</span>
      {list.map((s) => (
        <Link key={s.url} href={s.url}>
          {s.title}
        </Link>
      ))}
    </p>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="dc-eyebrow">{title}</h3>
      <ul className="dc-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** How many things a part holds, for the line under its title. */
export function itemCount(id: SectionId, data: unknown): number {
  if (!data) return 0;
  if (id === 'basics') {
    const d = data as Basics;
    return (d.dayInLife?.length ?? 0) + d.whatTheyDo.length + d.whereTheyWork.length + (d.specialties?.length ?? 0) + d.skills.length;
  }
  if (id === 'voices') return (data as Voices).posts.length;
  if (id === 'start') return (data as Start).steps.length + (data as Start).resources.length;
  return (data as Interview).formats.length + (data as Interview).questions.length;
}

function BasicsBody({ data }: { data: Basics }) {
  return (
    <>
      <p className="dc-summary">{data.summary}</p>
      {data.dayInLife && data.dayInLife.length > 0 && (
        <div className="dc-block">
          <h3 className="dc-eyebrow">A typical day</h3>
          <ol className="dc-day">
            {data.dayInLife.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="dc-cols dc-block">
        <List title="What they do" items={data.whatTheyDo} />
        <List title="Where they work" items={data.whereTheyWork} />
        <List title="Skills that matter" items={data.skills} />
      </div>
      {data.specialties && data.specialties.length > 0 && (
        <div className="dc-block">
          <h3 className="dc-eyebrow">Areas people specialise in</h3>
          <ul className="dc-specialties">
            {data.specialties.map((s) => (
              <li key={s.name}>
                <span className="font-semibold text-ink">{s.name}</span>
                <span className="text-ink-2">{s.what}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <dl className="dc-facts">
        <div>
          <dt>Education</dt>
          <dd>{data.education ?? <span className="text-ink-3">Not stated</span>}</dd>
        </div>
        <div>
          <dt>Typical pay</dt>
          <dd>{data.pay ? <Link href={data.pay.url}>{data.pay.figure}</Link> : <span className="text-ink-3">No pay figure found</span>}</dd>
        </div>
        <div>
          <dt>Outlook</dt>
          <dd>{data.outlook ?? <span className="text-ink-3">Not stated</span>}</dd>
        </div>
      </dl>
      <Sources list={data.sources} />
    </>
  );
}

const TOPICS: { id: PostTopic; label: string }[] = [
  { id: 'the work', label: 'The work' },
  { id: 'getting in', label: 'Getting in' },
  { id: 'advice', label: 'Advice' },
  { id: 'pay and life', label: 'Pay and life' },
];

function VoicesBody({ data, sample }: { data: Voices; sample: boolean }) {
  const [topic, setTopic] = useState<PostTopic | 'all'>('all');
  const present = TOPICS.filter((t) => data.posts.some((p) => p.topic === t.id));
  const shown = topic === 'all' ? data.posts : data.posts.filter((p) => p.topic === topic);
  if (!data.posts.length) return <p className="dc-empty">No posts from people in this job were found on X this time. Try Add more.</p>;
  return (
    <>
      {sample && <p className="dc-note">Sample stories with made-up people, to show what this part looks like. Grok will find real posts on X once it is connected.</p>}
      {present.length > 1 && (
        <div className="dc-filter" role="group" aria-label="Show posts about">
          <button type="button" className={`dc-chip ${topic === 'all' ? 'is-on' : ''}`} aria-pressed={topic === 'all'} onClick={() => setTopic('all')}>
            All {data.posts.length}
          </button>
          {present.map((t) => (
            <button key={t.id} type="button" className={`dc-chip ${topic === t.id ? 'is-on' : ''}`} aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ul className="dc-voices">
        {shown.map((post, i) => (
          <li key={`${post.author}-${i}`} className="dc-voice">
            <span className="dc-avatar" aria-hidden="true">
              {post.author.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="dc-voice-head">
                <span className="font-semibold text-ink">{post.author}</span>
                {post.handle && <span className="text-ink-3">{post.handle}</span>}
                <span className="text-ink-3">· {post.role}</span>
              </p>
              <p className="dc-voice-text">{post.text}</p>
              <p className="dc-takeaway">
                <span>What to take from it</span> {post.takeaway}
              </p>
              <p className="dc-voice-meta">
                <span className="dc-tag">Grok · X</span>
                {sample && <span className="dc-tag is-sample">Sample</span>}
                {post.date && <span>{dateLabel(post.date)}</span>}
                {post.url && <Link href={post.url}>Open on X</Link>}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function StartBody({ data }: { data: Start }) {
  return (
    <>
      <ol className="dc-steps-list">
        {data.steps.map((step, i) => (
          <li key={step.title}>
            <span className="dc-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {step.title}
                {step.when && <span className="dc-tag">{step.when}</span>}
              </p>
              <p className="mt-0.5 text-ink-2">{step.detail}</p>
              {step.resource && (
                <p className="mt-1">
                  <Link href={step.resource.url}>{step.resource.title}</Link>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {data.resources.length > 0 && (
        <div className="dc-block">
          <h3 className="dc-eyebrow">Good places to learn</h3>
          <ul className="dc-rows">
            {data.resources.map((r) => (
              <li key={r.url}>
                <Link href={r.url}>{r.title}</Link>
                <span className="dc-tag">{r.kind}</span>
                {r.free === true && <span className="dc-tag is-ok">Free</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function InterviewBody({ data }: { data: Interview }) {
  // Questions are grouped under the format that asks them, in the order the formats are listed.
  const groups = useMemo(() => {
    const order = [...data.formats.map((f) => f.name), ...data.questions.map((q) => q.kind)];
    const kinds = order.filter((k, i) => order.indexOf(k) === i && data.questions.some((q) => q.kind === k));
    return kinds.map((kind) => ({ kind, questions: data.questions.filter((q) => q.kind === kind) }));
  }, [data]);
  return (
    <>
      <ul className="dc-rows dc-formats">
        {data.formats.map((f) => (
          <li key={f.name}>
            <div>
              <p className="font-semibold text-ink">{f.name}</p>
              <p className="mt-0.5 text-ink-2">{f.tests}</p>
              <p className="mt-0.5 text-ink-2">
                <span className="text-ink-3">How to practise:</span> {f.howToPractice}
              </p>
              {f.url && (
                <p className="mt-1">
                  <Link href={f.url}>Read more</Link>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {groups.length > 0 && (
        <div className="dc-block">
          <h3 className="dc-eyebrow">Questions you might get</h3>
          {groups.map((g) => (
            <div key={g.kind} className="dc-qgroup">
              <p className="dc-qkind">{g.kind}</p>
              <ul className="dc-questions">
                {g.questions.map((q) => (
                  <li key={q.question}>
                    <span className="text-ink">{q.question}</span>
                    {q.tip && <span className="dc-tip">{`A strong answer: ${q.tip.charAt(0).toLowerCase() + q.tip.slice(1)}`}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <Sources list={data.sources} />
    </>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="dc-skel" aria-hidden="true">
      <span />
      <span />
      <span className="w-2/3" />
      <p>{label}</p>
    </div>
  );
}

/** The line under a part's title: how much it holds and what the last "Add more" did. */
function partMeta(id: SectionId, s: SectionState<unknown>): string | null {
  if (!s.data) return null;
  const n = itemCount(id, s.data);
  const base = `${n} ${n === 1 ? 'item' : 'items'}`;
  if (s.status === 'working') return `${base} · finding more`;
  if (s.error) return `${base} · ${s.error}`;
  if (s.added) return `${base} · ${s.added.count ? `added ${s.added.count} new` : 'nothing new found'} ${timeAgo(s.added.at)}`;
  return base;
}

function Part({
  id,
  index,
  state,
  guideBusy,
  onAddMore,
  onNext,
  children,
}: {
  id: SectionId;
  index: number;
  state: SectionState<unknown>;
  guideBusy: boolean;
  onAddMore: () => void;
  onNext?: () => void;
  children: ReactNode;
}) {
  const working = state.status === 'working';
  const meta = partMeta(id, state);
  const body =
    state.data !== null ? (
      children
    ) : state.status === 'failed' ? (
      <p className="dc-empty">This part could not be researched this time. Search again to try once more.</p>
    ) : (
      <Skeleton label={working ? 'Researching' : 'Waiting to start'} />
    );
  return (
    <section id={`guide-panel-${id}`} role="tabpanel" aria-labelledby={`guide-tab-${id}`} className="dc-panel dc-sec" aria-busy={working}>
      <header className="dc-sec-head">
        <div className="min-w-0">
          <h2 className="dc-sec-title">
            <span className="dc-num" aria-hidden="true">
              {index + 1}
            </span>
            {SECTION_TITLES[id]}
          </h2>
          {meta && (
            <p className="dc-sec-meta" aria-live="polite">
              {meta}
            </p>
          )}
        </div>
        {state.data !== null && (
          <button type="button" className="dc-soft" onClick={onAddMore} disabled={working || guideBusy}>
            <Plus className="size-4" aria-hidden="true" />
            {working ? 'Finding more' : 'Add more'}
          </button>
        )}
      </header>
      {body}
      {onNext && (
        <footer className="dc-sec-foot">
          <button type="button" className="dc-link" onClick={onNext}>
            {`Next: ${SECTION_TITLES[SECTION_IDS[index + 1]!]}`}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </footer>
      )}
    </section>
  );
}

function Tabs({ guide, current, onPick }: { guide: Guide; current: SectionId; onPick: (id: SectionId) => void }) {
  const refs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({});
  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? SECTION_IDS.length - 1 : step ? (i + step + SECTION_IDS.length) % SECTION_IDS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    const id = SECTION_IDS[to]!;
    onPick(id);
    refs.current[id]?.focus();
  };
  return (
    <div className="dc-steps" role="tablist" aria-label="Guide parts" aria-orientation="vertical">
      {SECTION_IDS.map((id, i) => {
        const s = guide.sections[id];
        const selected = id === current;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            id={`guide-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`guide-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            className={`dc-step ${selected ? 'is-on' : ''}`}
            onClick={() => onPick(id)}
            onKeyDown={(e) => move(e, i)}
            title={`Press ${i + 1}`}
          >
            <span className={`dc-step-mark ${s.status === 'working' ? 'is-working' : s.data ? 'is-done' : ''}`} aria-hidden="true">
              <PartIcon id={id} />
            </span>
            <span className="min-w-0 flex-1 text-left">{SECTION_TITLES[id]}</span>
            <kbd className="dc-kbd dc-step-key" aria-hidden="true">
              {i + 1}
            </kbd>
            <span className="sr-only">{s.status === 'working' ? ', researching' : s.data ? ', ready' : s.status === 'failed' ? ', not found' : ', waiting'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CareerGuide({
  guide,
  onSearchAgain,
  onAddMore,
  goalAction,
  firstPart = 'basics',
}: {
  guide: Guide;
  onSearchAgain: () => void;
  onAddMore: (section: SectionId) => void;
  /** Shown when this career is one of the roadmap paths and not already the goal. */
  goalAction?: () => void;
  /** The part shown when the guide opens. */
  firstPart?: SectionId;
}) {
  const [current, setCurrent] = useState<SectionId>(firstPart);
  const line = stepLine(guide);
  const researching = isResearching(guide);
  const s = guide.sections;
  const topRef = useRef<HTMLDivElement>(null);

  const pick = (id: SectionId) => {
    setCurrent(id);
    // Keep the new part's top in view when a long part was scrolled.
    const top = topRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) topRef.current?.scrollIntoView({ block: 'start' });
  };

  // 1 to 4 switch parts, as long as the student is not typing.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SECTION_IDS.length) pick(SECTION_IDS[n - 1]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const index = SECTION_IDS.indexOf(current);
  const bodies: Record<SectionId, ReactNode> = {
    basics: s.basics.data && <BasicsBody data={s.basics.data} />,
    voices: s.voices.data && <VoicesBody data={s.voices.data} sample={s.voices.sample} />,
    start: s.start.data && <StartBody data={s.start.data} />,
    interview: s.interview.data && <InterviewBody data={s.interview.data} />,
  };

  return (
    <div className="grid gap-5">
      <header className="dc-panel dc-guide-head">
        <div className="min-w-0">
          <p className="dc-eyebrow">Career guide</p>
          <h2 className="font-display mt-1 text-4xl leading-tight text-ink">{guide.title}</h2>
          {guide.oneLine && <p className="mt-1 text-[15px] text-ink-2">{guide.oneLine}</p>}
          <p className="dc-line" aria-live="polite">
            {line ? (
              <>
                <span className="live-dot size-2 rounded-full bg-[#34c759]" aria-hidden="true" />
                {line}
              </>
            ) : (
              <span className="text-ink-3">{`Researched ${dateLabel(guide.startedAt)} by ${providerLabel(guide.provider)}`}</span>
            )}
          </p>
        </div>
        <div className="dc-guide-actions">
          {goalAction && (
            <button type="button" className="dc-soft" onClick={goalAction}>
              <Target className="size-4" aria-hidden="true" />
              Make this my goal
            </button>
          )}
          <button type="button" className="dc-soft" onClick={onSearchAgain} disabled={isBusy(guide)}>
            <RotateCw className="size-4" aria-hidden="true" />
            {researching ? 'Searching' : 'Search again'}
          </button>
        </div>
      </header>

      {guide.status === 'failed' && !SECTION_IDS.some((id) => s[id].data) ? (
        <p className="dc-panel dc-empty p-6">{guide.error ?? 'The guide could not be researched.'} Search again to try once more.</p>
      ) : (
        <div ref={topRef} className="dc-guide scroll-mt-6">
          <Tabs guide={guide} current={current} onPick={pick} />
          <Part
            key={current}
            id={current}
            index={index}
            state={s[current] as SectionState<unknown>}
            guideBusy={researching}
            onAddMore={() => onAddMore(current)}
            onNext={index < SECTION_IDS.length - 1 ? () => pick(SECTION_IDS[index + 1]!) : undefined}
          >
            {bodies[current]}
          </Part>
        </div>
      )}
    </div>
  );
}
