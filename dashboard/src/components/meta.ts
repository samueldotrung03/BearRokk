import {
  BookOpen,
  Briefcase,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  Hammer,
  Send,
  Ticket,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Format, MatchLevel, OpportunityType, StepKind } from '../types.ts';

export const typeMeta: Record<OpportunityType, { label: string; plural: string; icon: LucideIcon; tint: string }> = {
  internship: { label: 'Internship', plural: 'Internships', icon: Briefcase, tint: 'bg-blue-50 text-blue-700' },
  event: { label: 'Event', plural: 'Events', icon: CalendarDays, tint: 'bg-violet-50 text-violet-700' },
  club: { label: 'Club', plural: 'Clubs', icon: Users, tint: 'bg-teal-50 text-teal-700' },
  hackathon: { label: 'Competition', plural: 'Competitions', icon: Trophy, tint: 'bg-amber-50 text-amber-700' },
  research: { label: 'Research', plural: 'Research', icon: FlaskConical, tint: 'bg-indigo-50 text-indigo-700' },
  scholarship: { label: 'Scholarship', plural: 'Scholarships', icon: GraduationCap, tint: 'bg-rose-50 text-rose-700' },
};

export const formatLabel: Record<Format, string> = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
};

export const stepMeta: Record<StepKind, { label: string; icon: LucideIcon }> = {
  learn: { label: 'Learn', icon: BookOpen },
  build: { label: 'Build', icon: Hammer },
  join: { label: 'Join', icon: Users },
  attend: { label: 'Attend', icon: Ticket },
  apply: { label: 'Apply', icon: Send },
};

export const matchMeta: Record<MatchLevel, { label: string; tint: string }> = {
  strong: { label: 'Strong match', tint: 'bg-emerald-50 text-emerald-700' },
  good: { label: 'Good match', tint: 'bg-blue-50 text-blue-700' },
  explore: { label: 'Worth exploring', tint: 'bg-slate-100 text-slate-600' },
};
