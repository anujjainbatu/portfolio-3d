import "./styles/Career.css";
import { config } from "../config";

// Always the start year. Two roles run concurrently and are both "Present", so
// "NOW" on each would tell the reader nothing; the current dot carries that.
const getDisplayYear = (period: string) => period.split(" - ")[0];

const Career = () => {
  return (
    <div className="career-section section-container">
      <div className="career-container">
        <h2>
          My career <span>&</span>
          <br /> experience
        </h2>
        <div className="career-info">
          <div className="career-timeline">
            <div className="career-dot"></div>
          </div>
          {config.experiences.map((exp, index) => (
            <div key={index} className="career-info-box">
              <div className="career-info-in">
                <div className="career-role">
                  <h4>
                    {exp.position}
                    {exp.current && (
                      <span className="career-current" title="Current">
                        <span className="career-current-dot" />
                        now
                      </span>
                    )}
                  </h4>
                  <h5>{exp.company}</h5>
                </div>
                <h3>{getDisplayYear(exp.period)}</h3>
              </div>
              <p>{exp.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Career;
