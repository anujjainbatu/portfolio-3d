import "./styles/Monogram.css";

interface Props {
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

/**
 * "AJ" mark. Stands in wherever the layout wants a portrait —
 * the mobile hero and the chess opponent avatar.
 */
const Monogram = ({ size = 120, className = "" }: Props) => (
  <div
    className={`monogram ${className}`}
    style={{ width: size, height: size, fontSize: size * 0.34 }}
    role="img"
    aria-label="Anuj Jain"
  >
    <span>AJ</span>
  </div>
);

export default Monogram;
