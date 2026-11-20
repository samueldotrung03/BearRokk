import { Bookmark, Heart, ThumbsDown } from 'lucide-react';
import type { Opportunity } from '../data/opportunities.ts';
import { useStudent } from '../state/student.tsx';

export function useChoice(id: string) {
  const student = useStudent();
  return {
    saved: student.savedSet.has(id),
    reaction: student.reactions[id] ?? null,
    toggleSaved: () => student.toggleSaved(id),
    like: () => student.react(id, 'like'),
    dislike: () => student.react(id, 'dislike'),
  };
}

export function RowActions({ opportunity }: { opportunity: Opportunity }) {
  const choice = useChoice(opportunity.id);
  return (
    <div className="row-actions">
      <button type="button" aria-pressed={choice.saved} onClick={choice.toggleSaved}>
        <Bookmark aria-hidden="true" fill={choice.saved ? 'currentColor' : 'none'} />
        {choice.saved ? 'Saved' : 'Save'}
      </button>
      <button type="button" data-tone="like" aria-pressed={choice.reaction === 'like'} onClick={choice.like}>
        <Heart aria-hidden="true" fill={choice.reaction === 'like' ? 'currentColor' : 'none'} />
        {choice.reaction === 'like' ? 'Liked' : 'Like'}
      </button>
      <button type="button" data-tone="dislike" aria-pressed={choice.reaction === 'dislike'} onClick={choice.dislike}>
        <ThumbsDown aria-hidden="true" fill={choice.reaction === 'dislike' ? 'currentColor' : 'none'} />
        Dislike
      </button>
    </div>
  );
}
