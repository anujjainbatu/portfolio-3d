import { MdArrowOutward } from "react-icons/md";
import { Link } from "react-router-dom";
import FlowCard from "./FlowCard";

interface Props {
  flow: string[];
  result?: string;
  status?: "live" | "in progress";
  link?: string;
}

const WorkImage = (props: Props) => {
  const isExternalLink = Boolean(props.link && !props.link.startsWith("/"));
  const card = (
    <FlowCard flow={props.flow} result={props.result} status={props.status} />
  );

  if (!props.link) {
    return (
      <div className="work-image">
        <div className="work-image-in" data-cursor={"disable"}>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div className="work-image">
      {isExternalLink ? (
        <a
          className="work-image-in"
          href={props.link}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor={"disable"}
        >
          <div className="work-link">
            <MdArrowOutward />
          </div>
          {card}
        </a>
      ) : (
        <Link className="work-image-in" to={props.link} data-cursor={"disable"}>
          <div className="work-link">
            <MdArrowOutward />
          </div>
          {card}
        </Link>
      )}
    </div>
  );
};

export default WorkImage;
