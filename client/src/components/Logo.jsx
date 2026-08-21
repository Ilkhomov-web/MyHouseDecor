/**
 * Brand mark. The asset is a transparent PNG of a black glyph, so on the dark
 * theme it is inverted to white by CSS (see .brand-logo in global.css) rather
 * than shipping a second file.
 */
export default function Logo({ size = 40, className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="My House decor"
      width={size}
      height={size}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
