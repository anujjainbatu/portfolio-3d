/**
 * The hero robot's head, drawn small.
 *
 * Inline SVG rather than a bitmap: it is sharp at any size, costs no request,
 * and its fills are CSS custom properties, so it re-themes with the rest of the
 * panel instead of drifting the way a baked render does. (public/robot-chat-
 * avatar.png is exactly that drift — a render of the robot before the titanium
 * recolour, still lit with the old purple rim.)
 *
 * Colours match the three materials on RobotExpressive.glb after the recolour
 * in components/Character/utils/character.ts, so the avatar and the hero are
 * recognisably the same machine.
 */
const RobotAvatar = () => (
  <span className="portfolio-chat__avatar" aria-hidden="true">
    <span className="portfolio-chat__avatar-ring" />
    <svg viewBox="0 0 48 48" className="portfolio-chat__avatar-svg">
      {/* Skull: the trapezoid head, wider at the brow than the jaw. */}
      <path
        d="M9 17.5 A2.5 2.5 0 0 1 11.2 15 L36.8 15 A2.5 2.5 0 0 1 39 17.5 L37 32.5
           A2.5 2.5 0 0 1 34.6 34.6 L13.4 34.6 A2.5 2.5 0 0 1 11 32.5 Z"
        className="portfolio-chat__avatar-shell"
      />
      {/* Brow and jaw bands — the graphite panels. */}
      <path d="M9.6 19.4 L38.4 19.4 L38.0 22.6 L10.0 22.6 Z" className="portfolio-chat__avatar-panel" />
      <path d="M10.6 29.2 L37.4 29.2 L37.0 32.4 L11.0 32.4 Z" className="portfolio-chat__avatar-panel" />
      {/* Antenna nubs, silver. */}
      <rect x="14" y="12.4" width="7.5" height="2.2" rx="1.1" className="portfolio-chat__avatar-trim" />
      <rect x="26.5" y="12.4" width="7.5" height="2.2" rx="1.1" className="portfolio-chat__avatar-trim" />
      {/* Eyes. These carry the glow. */}
      <circle cx="18.6" cy="26" r="3.6" className="portfolio-chat__avatar-eye" />
      <circle cx="29.4" cy="26" r="3.6" className="portfolio-chat__avatar-eye" />
    </svg>
    {/* Four particles that drift outward once, as the panel opens. */}
    <span className="portfolio-chat__avatar-spark" />
    <span className="portfolio-chat__avatar-spark" />
    <span className="portfolio-chat__avatar-spark" />
    <span className="portfolio-chat__avatar-spark" />
  </span>
);

export default RobotAvatar;
