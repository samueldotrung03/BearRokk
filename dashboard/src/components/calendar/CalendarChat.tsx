// The box docked under the calendar: the student says what to add in their own words ("Stripe
// phone screen Friday 2 to 2:45") and the agents' model turns it into an event, which goes on the
// calendar and on their Google Calendar. When something is missing it asks back.
import { ArrowUp, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLive } from '../../state/live.tsx';

export interface ChatEvent {
  title: string;
  day: string;
  time: string | null;
  endTime: string | null;
  note: string;
}

export function CalendarChat({ today, onAdd }: { today: string; onAdd: (event: ChatEvent) => void }) {
  const live = useLive();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const said = text.trim();
    if (!said || busy) return;
    setBusy(true);
    setReply(null);
    try {
      const res = await live.request('/calendar/ask', {
        method: 'POST',
        body: JSON.stringify({ text: said, today, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const body = (await res.json()) as { ok: boolean; reply: string; event?: ChatEvent };
      if (body.ok && body.event) {
        onAdd(body.event);
        setText('');
      }
      setReply({ ok: body.ok, text: body.reply });
    } catch {
      setReply({ ok: false, text: 'The agents cannot be reached right now. Use the + button to add it.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cx-chat-wrap">
      <form className="cx-chat" onSubmit={send}>
        <Sparkles className="size-5 shrink-0 text-brand" aria-hidden="true" />
        <label htmlFor="cx-chat-input" className="sr-only">
          Tell BearRok what to add
        </label>
        <input
          id="cx-chat-input"
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tell BearRok what to add: Stripe phone screen Friday 2 to 2:45pm"
          autoComplete="off"
        />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Add to calendar" className="cx-chat-send">
          <ArrowUp className={`size-5 ${busy ? 'animate-pulse' : ''}`} aria-hidden="true" />
        </button>
      </form>
      {(busy || reply) && (
        <p className="cx-chat-reply" data-ok={reply?.ok ?? true} aria-live="polite">
          {busy ? 'Adding it…' : reply?.text}
        </p>
      )}
    </div>
  );
}
