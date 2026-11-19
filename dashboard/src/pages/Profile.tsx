import { RotateCcw } from 'lucide-react';
import { Link } from 'react-router';
import { Card, Page } from '../components/Page.tsx';
import { interestOptions, skillOptions } from '../data/sample.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ClassYear } from '../types.ts';

const years: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="font-semibold tracking-tight">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Profile() {
  const { state, dispatch } = useStore();
  const { profile } = state;
  const memory = [
    { label: 'Saved', count: state.saved.length },
    { label: 'Opened', count: state.opened.length },
    { label: 'Dismissed', count: state.dismissed.length },
  ];

  return (
    <Page
      title="Your profile"
      subtitle="What you tell the agents here, and what you do in the feed, decides what they look for."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="space-y-8 p-7">
          <fieldset>
            <legend className="font-semibold tracking-tight">Class year</legend>
            <div className="mt-3 inline-flex rounded-xl bg-slate-100 p-1">
              {years.map((year) => (
                <button
                  key={year}
                  type="button"
                  aria-pressed={profile.year === year}
                  onClick={() => dispatch({ type: 'setYear', year })}
                  className={`h-9 rounded-lg px-3.5 text-sm font-medium transition sm:px-4 ${
                    profile.year === year ? 'bg-white text-ink shadow-card' : 'text-ink-2'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </fieldset>

          <ChipGroup
            label="Interests"
            options={interestOptions}
            selected={profile.interests}
            onToggle={(value) => dispatch({ type: 'toggleInterest', value })}
          />
          <ChipGroup
            label="Skills"
            options={skillOptions}
            selected={profile.skills}
            onToggle={(value) => dispatch({ type: 'toggleSkill', value })}
          />

          <div>
            <label htmlFor="location" className="font-semibold tracking-tight">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={profile.location}
              onChange={(event) => dispatch({ type: 'setLocation', location: event.target.value })}
              autoComplete="address-level2"
              className="mt-3 block h-11 w-full max-w-sm rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
            <p className="mt-2 text-sm text-ink-3">In-person events and clubs are searched near here.</p>
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-linear-to-br from-[#7fa6ff] to-[#5b7cf5] font-display text-3xl text-white">
                {profile.name.charAt(0)}
              </span>
              <div>
                <h2 className="text-lg leading-tight font-semibold tracking-tight">{profile.fullName}</h2>
                <p className="text-sm text-ink-3">
                  {profile.year}, {profile.major}
                </p>
                <p className="text-sm text-ink-3">{profile.school}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">{profile.about}</p>
            <Link to="/signin" className="mt-4 inline-block text-sm font-semibold text-brand">
              Sign out
            </Link>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold tracking-tight">What the agents remember</h2>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
              {memory.map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 py-3">
                  <dd className="font-display text-4xl leading-none">{item.count}</dd>
                  <dt className="mt-1.5 text-xs text-ink-3">{item.label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              The master agent reads this history before each search. Clearing it brings dismissed cards back.
            </p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'resetHistory' })}
              className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-ink-2 transition hover:bg-slate-50"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Clear history
            </button>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
