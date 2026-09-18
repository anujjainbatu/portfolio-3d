import "./styles/FlowCard.css";

interface Props {
  /** Pipeline stages, in order. */
  flow: string[];
  result?: string;
  status?: "live" | "in progress";
}

const Arrow = () => (
  <svg
    className="flow-arrow"
    width="22"
    height="10"
    viewBox="0 0 22 10"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M0 5h18" stroke="currentColor" strokeWidth="1.2" fill="none" />
    <path
      d="M15.5 1.5L20 5l-4.5 3.5"
      stroke="currentColor"
      strokeWidth="1.2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Renders a system as its pipeline. These are client-internal systems with no
 * screenshots to publish, and the architecture is the point anyway.
 *
 * The chain is one image to a screen reader; the individual chips are hidden
 * from it so the arrows don't get read as gaps.
 */
const FlowCard = ({ flow, result, status }: Props) => (
  <div className="flow-card">
    <div
      className="flow-chain"
      role="img"
      aria-label={`Flow: ${flow.join(", then ")}`}
    >
      {flow.map((step, index) => (
        <div className="flow-step" key={step} aria-hidden="true">
          <span className="flow-node">{step}</span>
          {index < flow.length - 1 && <Arrow />}
        </div>
      ))}
    </div>

    {result && <p className="flow-result">{result}</p>}

    {status && (
      <div className={`flow-status flow-status-${status.replace(" ", "-")}`}>
        <span className="flow-dot" />
        {status}
      </div>
    )}
  </div>
);

export default FlowCard;
