import "./styles/About.css";
import { config } from "../config";

const About = () => {
  return (
    <div className="about-section" id="about">
      <div className="about-me">
        <h3 className="title">{config.about.title}</h3>
        {config.about.description.map((paragraph, index) => (
          <p className="para" key={index}>
            {paragraph}
          </p>
        ))}
        <div className="about-stats">
          {config.stats.map((stat) => (
            <div className="about-stat" key={stat.value + stat.label}>
              <span className="about-stat-value">{stat.value}</span>
              <span className="about-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default About;
