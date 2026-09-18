import { PropsWithChildren } from "react";
import "./styles/Landing.css";
import { config } from "../config";
import Monogram from "./Monogram";

const Landing = ({ children }: PropsWithChildren) => {
  const nameParts = config.developer.fullName.split(" ");
  const firstName = nameParts[0] || config.developer.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  return (
    <>
      <div className="landing-section" id="landingDiv">
        <div className="landing-container">
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
          {/* Shows only on mobile, where the 3D character is not rendered */}
          <div className="mobile-photo">
            <Monogram size={180} />
          </div>
        </div>
        {children}
      </div>
    </>
  );
};

export default Landing;
