import { Children, useEffect, useState, type ReactNode } from 'react';

function columnCount(): number {
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 640px)').matches) return 2;
  return 1;
}

/**
 * Pinterest-style grid. Children are dealt across the columns in order, so the best-ranked
 * tiles sit along the top row instead of all running down the first column.
 */
export function Masonry({ children }: { children: ReactNode }) {
  const [columns, setColumns] = useState(columnCount);
  useEffect(() => {
    const onResize = () => setColumns(columnCount());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const buckets: ReactNode[][] = Array.from({ length: columns }, () => []);
  Children.toArray(children).forEach((child, index) => buckets[index % columns]!.push(child));

  return (
    <div className="flex items-start gap-5">
      {buckets.map((bucket, index) => (
        <div key={index} className="flex min-w-0 flex-1 flex-col gap-5">
          {bucket}
        </div>
      ))}
    </div>
  );
}
