// Rows, status pills, switches and buttons shared by the sections of the Settings page.
import type { ReactNode } from 'react';

export type Tone = 'on' | 'off' | 'wait' | 'warn';

export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  const style = { on: 'bg-emerald-50 text-emerald-800', off: 'bg-slate-100 text-ink-2', wait: 'bg-brand-soft text-ink-2', warn: 'bg-amber-50 text-amber-800' }[tone];
  const dot = { on: 'bg-emerald-500', off: 'bg-slate-400', wait: 'bg-brand', warn: 'bg-amber-500' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${style}`}>
      <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ActionButton({ primary, children, ...button }: React.ComponentProps<'button'> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={`h-10 shrink-0 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-60 ${
        primary ? 'btn-primary text-white' : 'border border-line bg-white text-ink hover:bg-slate-50'
      }`}
      {...button}
    >
      {children}
    </button>
  );
}

export function Row({ icon, title, text, status, action, children }: { icon: ReactNode; title: string; text: string; status: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand [&>svg]:size-[22px]" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="font-semibold tracking-tight">{title}</h3>
            {status}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{text}</p>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children && <div className="mt-3 sm:pl-[60px]">{children}</div>}
    </li>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition after:absolute after:-inset-2 after:content-[''] disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} aria-hidden="true" />
    </button>
  );
}

export const Note = ({ kind, children }: { kind: 'error' | 'ok'; children: ReactNode }) => (
  <p className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{children}</p>
);
