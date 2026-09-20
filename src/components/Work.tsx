import "./styles/Work.css";
import WorkImage from "./WorkImage";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";
import { config } from "../config";
import { Link } from "react-router-dom";

gsap.registerPlugin(ScrollTrigger);

const Work = () => {
  useEffect(() => {
    // Disable pinning on mobile to allow scrolling
    if (window.innerWidth <= 768) return;

    let translateX: number = 0;

    /** Pinned scroll left over once the rule's tip reaches centre, so it can be
     *  seen sliding out from under the character before he drops. */
    const LIP_OVERSHOOT_PX = 400;

    function setTranslateX() {
      const box = document.getElementsByClassName("work-box");
      if (box.length === 0) return;
      const flex = box[0].parentElement as HTMLElement;
      const rect = box[0].getBoundingClientRect();
      const padding: number =
        parseInt(window.getComputedStyle(box[0]).padding) / 2;

      // The rule under the heading is .work-flex::before, and .work-flex is
      // only as wide as its container (the boxes overflow it), so the rule
      // cannot size itself off the flex — 100% there would cover just the first
      // screenful. Publish the real content width for the CSS to use.
      const contentWidth = rect.width * box.length + padding;
      flex.style.setProperty("--work-line-w", `${contentWidth}px`);

      // Scroll until the rule's tip has passed the middle of the screen, where
      // the character is standing, plus the overshoot that walks it past him.
      const lineRight = flex.getBoundingClientRect().left + contentWidth;
      translateX = lineRight - window.innerWidth / 2 + LIP_OVERSHOOT_PX;
    }

    setTranslateX();

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".work-section",
        start: "top top",
        // Function form so a refresh re-reads it. The box width drops from
        // 600px to 350px below 1400, so a resize across that breakpoint used to
        // leave both the pin length and the rule measured for the old layout.
        end: () => `+=${translateX}`,
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        id: "work",
        invalidateOnRefresh: true,
      },
    });

    timeline.to(".work-flex", {
      x: () => -translateX,
      ease: "none",
    });

    // Re-measure before every refresh, which includes window resizes, so the
    // rule length and the pin distance follow the breakpoint.
    const remeasure = () => setTranslateX();
    ScrollTrigger.addEventListener("refreshInit", remeasure);

    // Refresh ScrollTrigger after layout settles
    ScrollTrigger.refresh();

    // Clean up
    return () => {
      ScrollTrigger.removeEventListener("refreshInit", remeasure);
      timeline.kill();
      ScrollTrigger.getById("work")?.kill();
    };
  }, []);
  return (
    <div className="work-section" id="work">
      <div className="work-container section-container">
        <h2>
          Systems in <span>production</span>
        </h2>
        <div className="work-flex">
          {config.projects.slice(0, 5).map((project, index) => (
            <div className="work-box" key={project.id}>
              <div className="work-info">
                <div className="work-title">
                  <h3>0{index + 1}</h3>

                  <div>
                    <h4>{project.title}</h4>
                    <p>{project.scale}</p>
                  </div>
                </div>
                <h4>Built on</h4>
                <p>{project.technologies}</p>
              </div>
              <WorkImage
                flow={project.flow}
                result={project.result}
                status={project.status}
                link={project.link}
              />
            </div>
          ))}
          {/* See All Works Button */}
          <div className="work-box work-box-cta">
            <div className="see-all-works">
              <h3>There is more.</h3>
              <p>Every system I have shipped, with the architecture behind it</p>
              <Link to="/myworks" className="see-all-btn" data-cursor="disable">
                See All Work →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Work;
