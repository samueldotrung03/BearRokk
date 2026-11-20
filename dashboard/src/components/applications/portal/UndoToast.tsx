// A short message at the bottom of the screen with an Undo button, used instead of asking
// "are you sure?" before a part is deleted.
import { X } from 'lucide-react';

export function UndoToast({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) {
  return (
    <div className="pt-toast" role="status">
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <button type="button" className="pt-toast-undo" onClick={onUndo}>
        Undo
      </button>
      <button type="button" className="pt-toast-close" onClick={onClose} aria-label="Dismiss">
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
