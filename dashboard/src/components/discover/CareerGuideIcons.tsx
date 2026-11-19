// The career guide's four part icons. The drawings live in src/assets/icons/career-guide-*.svg
// (drawn in Figma, "BearRok career guide icons") on a 256 grid with 16-unit round strokes, the
// weight of the dock's Phosphor icons. They draw in currentColor, so the tab's text color tints them.
import basics from '../../assets/icons/career-guide-basics.svg?raw';
import interview from '../../assets/icons/career-guide-interviews.svg?raw';
import start from '../../assets/icons/career-guide-how-to-start.svg?raw';
import voices from '../../assets/icons/career-guide-people-say.svg?raw';
import type { SectionId } from '../../lib/discover/guide.ts';

const icons: Record<SectionId, string> = { basics, voices, start, interview };

export function PartIcon({ id }: { id: SectionId }) {
  // The files are the app's own drawings, so inserting their markup is safe.
  return <span className="dc-part-icon" dangerouslySetInnerHTML={{ __html: icons[id] }} />;
}
