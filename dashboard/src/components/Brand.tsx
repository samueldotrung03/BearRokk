import logo from '../assets/logo.png';

/**
 * The BearRok logo: a bear over a shield with a rising arrow, in blue and gold. It is the team's
 * own artwork with the background removed. The same picture is `public/favicon.png` and, padded
 * to a square, `electron/icon.png` (the desktop app icon).
 */
export function BrandMark() {
  return <img className="brand-mark" src={logo} alt="" />;
}
