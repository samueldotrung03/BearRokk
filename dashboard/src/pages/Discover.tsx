import { Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { matchMeta } from '../components/meta.ts';
import { Card, Page } from '../components/Page.tsx';
import { careerPaths } from '../data/sample.ts';
import { useStore } from '../state/StoreProvider.tsx';

export function Discover() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  return (
    <Page
      title="Career discovery"
      subtitle="Paths that fit what you like and what you are good at, with what each one expects from an intern."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {careerPaths.map((path) => {
          const match = matchMeta[path.match];
          const isGoal = state.goalId === path.id;
          return (
            <Card key={path.id} className="flex flex-col p-7">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-3xl leading-tight font-medium">{path.title}</h2>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${match.tint}`}>{match.label}</span>
              </div>
              <p className="mt-2 text-[15px] text-ink-2">{path.oneLine}</p>

              <p className="mt-5 rounded-2xl bg-brand-soft/70 p-4 text-sm leading-relaxed text-ink-2">
                <span className="font-medium text-ink">Why it fits you. </span>
                {path.whyItFits}
              </p>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">What it expects</h3>
                  <ul className="mt-2 space-y-1.5 text-sm leading-snug text-ink-2">
                    {path.expects.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">First steps</h3>
                  <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-snug text-ink-2 marker:text-ink-3">
                    {path.firstSteps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-auto pt-6">
                {isGoal ? (
                  <button
                    type="button"
                    onClick={() => navigate('/roadmap')}
                    className="flex h-10 items-center gap-2 rounded-xl bg-brand-soft px-4 text-sm font-medium text-brand"
                  >
                    <Check className="size-4" aria-hidden="true" /> Your current goal · open roadmap
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'setGoal', id: path.id });
                      navigate('/roadmap');
                    }}
                    className="btn-primary h-10 rounded-xl px-4 text-sm font-medium text-white"
                  >
                    Make this my goal
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
