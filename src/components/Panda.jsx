/**
 * Budgy's logo mark.
 *
 * Drawn by hand from circles and ellipses so every fill is a CSS variable —
 * the mark re-themes with the rest of the app rather than being a fixed asset
 * that looks wrong in one mode.
 *
 * Proportions lean babylike on purpose: a near-round face, large eyes set low,
 * and a single mouth curve that survives being shrunk to 40px in the sidebar.
 */
export default function Panda({ size = 96, className = '' }) {
  return (
    <svg
      className={`panda ${className}`}
      width={size}
      height={size * 0.94}
      viewBox="0 0 120 113"
      role="img"
      aria-label="Budgy"
      focusable="false"
    >
      {/* ears — pushed out and down so the head reads as a circle */}
      <circle cx="24" cy="36" r="16" className="panda-dark" />
      <circle cx="96" cy="36" r="16" className="panda-dark" />
      <circle cx="24" cy="36" r="7.5" className="panda-ear-inner" />
      <circle cx="96" cy="36" r="7.5" className="panda-ear-inner" />

      {/* face — wider than it is tall, for a chubby read */}
      <ellipse cx="60" cy="65" rx="48" ry="43" className="panda-face" />

      {/* eye patches, tilted inward */}
      <ellipse cx="39" cy="61" rx="15" ry="17" className="panda-dark"
        transform="rotate(-14 39 61)" />
      <ellipse cx="81" cy="61" rx="15" ry="17" className="panda-dark"
        transform="rotate(14 81 61)" />

      {/* eyes — large, with a catchlight in each */}
      <circle cx="41" cy="60" r="7.5" className="panda-eye" />
      <circle cx="79" cy="60" r="7.5" className="panda-eye" />
      <circle cx="42" cy="61" r="4.2" className="panda-pupil" />
      <circle cx="80" cy="61" r="4.2" className="panda-pupil" />
      <circle cx="43.6" cy="58.6" r="1.7" className="panda-eye" />
      <circle cx="81.6" cy="58.6" r="1.7" className="panda-eye" />

      {/* nose and a single smile */}
      <ellipse cx="60" cy="80" rx="6.5" ry="4.6" className="panda-dark" />
      <path d="M49 88q11 9 22 0" className="panda-stroke" />
    </svg>
  )
}
