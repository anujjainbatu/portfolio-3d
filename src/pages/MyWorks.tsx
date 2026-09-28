import { useEffect } from "react";
import { Link } from "react-router-dom";
import { config } from "../config";
import FlowCard from "../components/FlowCard";
import "./MyWorks.css";

const MyWorks = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return (
    <div className="myworks-page">
      <div className="myworks-header">
        <Link to="/" className="back-button" data-cursor="disable">
          <img src="/logo-icon.png" alt="" width="24" height="24" />
          <span>← Back to Home</span>
        </Link>
        <h1>
          All <span>Work</span>
        </h1>
        <p>Production systems and current builds, mapped from trigger to outcome</p>
      </div>

      <div className="myworks-grid">
        {config.projects.map((project, index) => {
          const isInternalLink = Boolean(project.link?.startsWith("/"));
          const cardContent = (
            <>
              <div className="myworks-card-number">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="myworks-card-flow">
                <FlowCard
                  flow={project.flow}
                  result={project.result}
                  status={project.status}
                />
              </div>
              <div className="myworks-card-info">
                <h3>{project.title}</h3>
                <p className="myworks-card-category">{project.scale}</p>
                <p className="myworks-card-description">{project.description}</p>
                <p className="myworks-card-tech">{project.technologies}</p>
                {project.link && (
                  <p className="myworks-card-link">
                    {isInternalLink ? "View project" : "Visit website"}
                    <span aria-hidden="true"> ↗</span>
                  </p>
                )}
              </div>
            </>
          );

          if (isInternalLink) {
            return (
              <Link
                className="myworks-card"
                key={project.id}
                data-cursor="disable"
                to={project.link}
              >
                {cardContent}
              </Link>
            );
          }

          if (project.link) {
            return (
              <a
                className="myworks-card"
                key={project.id}
                data-cursor="disable"
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${project.title} website (opens in a new tab)`}
              >
                {cardContent}
              </a>
            );
          }

          return (
            <div className="myworks-card" key={project.id}>
              {cardContent}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyWorks;
