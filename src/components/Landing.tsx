import { PropsWithChildren } from "react";
import { FaGithub, FaLinkedinIn } from "react-icons/fa6";
import { MdMailOutline } from "react-icons/md";
import { TbArrowRight, TbChevronDown } from "react-icons/tb";
import "./styles/Landing.css";
import { config } from "../config";
import { useChat } from "../chat/ChatContext";

const Landing = ({ children }: PropsWithChildren) => {
  const { openChat } = useChat();
  const nameParts = config.developer.fullName.split(" ");
  const firstName = nameParts[0] || config.developer.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  return (
    <>
      <div className="landing-section" id="landingDiv">
        <div className="landing-container">
          {/* Mobile only: sits above the name */}
          <p className="landing-mobile-eyebrow">
            <span className="landing-mobile-dot" aria-hidden="true" />
            {config.social.location}
          </p>
          <div className="landing-intro">
            <h2>Hello! I'm</h2>
            <h1>
              {firstName.toUpperCase()}
              {' '}
              <br />
              {lastName && <span>{lastName.toUpperCase()}</span>}
            </h1>
          </div>
          <div className="landing-info">
            <h3>An</h3>
            <h2 className="landing-info-h2">
              <div className="landing-h2-1">{config.developer.roles[0]}</div>
            </h2>
            <h2>
              <div className="landing-h2-info">{config.developer.roles[1]}</div>
            </h2>
          </div>
          {/* Mobile only, where the 3D character is not rendered */}
          <div className="landing-mobile">
            <p className="landing-mobile-desc">{config.developer.description}</p>
            <div className="landing-mobile-ctas">
              <button
                type="button"
                className="landing-mobile-btn landing-mobile-btn--primary"
                onClick={openChat}
              >
                Let's talk
                <TbArrowRight aria-hidden="true" />
              </button>
              <a
                className="landing-mobile-btn landing-mobile-btn--ghost"
                href={config.contact.resume}
                target="_blank"
                rel="noopener noreferrer"
              >
                Resume
              </a>
            </div>
            <div className="landing-mobile-social">
              <a href={config.contact.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FaGithub />
              </a>
              <a href={config.contact.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <FaLinkedinIn />
              </a>
              <a href={`mailto:${config.contact.email}`} aria-label="Email">
                <MdMailOutline />
              </a>
            </div>
          </div>
          <a className="landing-mobile-scroll" href="#about" aria-label="Scroll to About">
            <TbChevronDown aria-hidden="true" />
          </a>
        </div>
        {children}
      </div>
    </>
  );
};

export default Landing;
