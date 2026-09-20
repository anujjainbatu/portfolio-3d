import { useEffect, useRef } from "react";
import "./styles/WhatIDo.css";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { config } from "../config";

const WhatIDo = () => {
  const containerRef = useRef<(HTMLDivElement | null)[]>([]);
  const innerRef = useRef<(HTMLDivElement | null)[]>([]);
  const setRef = (el: HTMLDivElement | null, index: number) => {
    containerRef.current[index] = el;
  };
  const setInnerRef = (el: HTMLDivElement | null, index: number) => {
    innerRef.current[index] = el;
  };
  /**
   * A card only traps the wheel while it actually has something to scroll.
   * data-lenis-prevent tells Lenis to keep its hands off a subtree, but if we
   * set it unconditionally the page would freeze whenever the cursor sat over
   * a card whose copy already fits — and the cards are large and centred, so
   * that is most of the time. The card grows and shrinks on hover, so the
   * overflow test is re-run from a ResizeObserver rather than just on mount.
   */
  useEffect(() => {
    const inners = innerRef.current.filter(Boolean) as HTMLDivElement[];
    if (inners.length === 0) return;

    const sync = (el: HTMLDivElement) => {
      if (el.scrollHeight > el.clientHeight + 1) {
        el.setAttribute("data-lenis-prevent", "");
      } else {
        el.removeAttribute("data-lenis-prevent");
        el.scrollTop = 0;
      }
    };
    const syncAll = () => inners.forEach(sync);

    const observer = new ResizeObserver(syncAll);
    inners.forEach((el) => {
      sync(el);
      observer.observe(el);
    });
    window.addEventListener("resize", syncAll);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncAll);
    };
  }, []);

  useEffect(() => {
    if (ScrollTrigger.isTouch) {
      containerRef.current.forEach((container) => {
        if (container) {
          container.classList.remove("what-noTouch");
          container.addEventListener("click", () => handleClick(container));
        }
      });
    }
    return () => {
      containerRef.current.forEach((container) => {
        if (container) {
          container.removeEventListener("click", () => handleClick(container));
        }
      });
    };
  }, []);
  return (
    <div className="whatIDO">
      <div className="what-box">
        <h2 className="title">
          W<span className="hat-h2">HAT</span>
          <div>
            &nbsp;I<span className="do-h2"> DO</span>
          </div>
        </h2>
      </div>
      <div className="what-box">
        <div className="what-box-in">
          <div className="what-border2">
            <svg width="100%">
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="100%"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="7,7"
              />
              <line
                x1="100%"
                y1="0"
                x2="100%"
                y2="100%"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="7,7"
              />
            </svg>
          </div>
          <div
            className="what-content what-noTouch"
            ref={(el) => setRef(el, 0)}
          >
            <div className="what-border1">
              <svg height="100%">
                <line
                  x1="0"
                  y1="0"
                  x2="100%"
                  y2="0"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
                <line
                  x1="0"
                  y1="100%"
                  x2="100%"
                  y2="100%"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
              </svg>
            </div>
            <div className="what-corner"></div>

            <div
              className="what-content-in"
              ref={(el) => setInnerRef(el, 0)}
            >
              <h3>{config.skills.build.title}</h3>
              <h4>{config.skills.build.description}</h4>
              <p>
                {config.skills.build.details}
              </p>
              <h5>Skillset & tools</h5>
              <div className="what-content-flex">
                {config.skills.build.tools.map((tool, index) => (
                  <div key={index} className="what-tags">{tool}</div>
                ))}
              </div>
              <div className="what-arrow"></div>
            </div>
          </div>
          <div
            className="what-content what-noTouch"
            ref={(el) => setRef(el, 1)}
          >
            <div className="what-border1">
              <svg height="100%">
                <line
                  x1="0"
                  y1="100%"
                  x2="100%"
                  y2="100%"
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
              </svg>
            </div>
            <div className="what-corner"></div>
            <div
              className="what-content-in"
              ref={(el) => setInnerRef(el, 1)}
            >
              <h3>{config.skills.integrate.title}</h3>
              <h4>{config.skills.integrate.description}</h4>
              <p>
                {config.skills.integrate.details}
              </p>
              <h5>Skillset & tools</h5>
              <div className="what-content-flex">
                {config.skills.integrate.tools.map((tool, index) => (
                  <div key={index} className="what-tags">{tool}</div>
                ))}
              </div>
              <div className="what-arrow"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIDo;

function handleClick(container: HTMLDivElement) {
  container.classList.toggle("what-content-active");
  container.classList.remove("what-sibling");
  if (container.parentElement) {
    const siblings = Array.from(container.parentElement.children);

    siblings.forEach((sibling) => {
      if (sibling !== container) {
        sibling.classList.remove("what-content-active");
        sibling.classList.toggle("what-sibling");
      }
    });
  }
}
