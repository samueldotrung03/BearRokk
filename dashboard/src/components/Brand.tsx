/** The "b." mark from the pitch site. `light` is for use on the blue header. */
export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <span className="brand-mark" data-tone={light ? 'light' : 'dark'} aria-hidden="true">
      b.
    </span>
  );
}
