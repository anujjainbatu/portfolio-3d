import { useEffect, useRef, useState } from "react";
import { FiPlay } from "react-icons/fi";
import "./styles/DesktopWalkthrough.css";

/**
 * What a phone visitor does not get to see.
 *
 * Below 1025px MainContainer never mounts the Three.js character and
 * GsapScroll gates tl1/tl2 behind the same width, so the whole scroll journey
 * — the rope, the run along the Work platform, the drop into the funnel —
 * simply does not exist here. This section shows it as a recording instead.
 *
 * Copy lives in this file rather than in config/publicProfile on purpose: that
 * module is the chat assistant's knowledge base (server/chatPolicy.ts answers
 * from it), and UI chrome added there would end up in what the assistant says
 * about Anuj.
 */

const POSTER = "/desktop-walkthrough-poster.jpg";

const DesktopWalkthrough = () => {
  const [posterVisible, setPosterVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /* Hold the poster back until the section is near the viewport. Same pattern
     as the tech stack's canvas gate. */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPosterVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "25% 0px" },
    );
    io.observe(frame);
    return () => io.disconnect();
  }, []);

  /* The video carries preload="none", so nothing is fetched until this runs. */
  const play = () => {
    setPlaying(true);
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // A refused play leaves the poster and the button in place rather than
      // stranding the visitor on a dead frame.
      setPlaying(false);
    });
  };

  return (
    <section
      className="walkthrough-section section-container"
      aria-labelledby="walkthrough-title"
    >
      <h2 id="walkthrough-title">
        What you missed <span>on phone</span>
      </h2>
      <p className="walkthrough-lead">
        The desktop build runs a rigged 3D character through the whole page: a
        scroll-driven Three.js scene with GSAP timelines and a camera synced to
        your scroll position. None of it renders at this width.
      </p>

      <div
        className={`walkthrough-frame${playing ? " is-playing" : ""}`}
        ref={frameRef}
      >
        <video
          ref={videoRef}
          className="walkthrough-video"
          poster={posterVisible ? POSTER : undefined}
          preload="none"
          muted
          loop
          playsInline
          controls={playing}
        >
          <source src="/video/desktop-walkthrough.webm" type="video/webm" />
          <source src="/video/desktop-walkthrough.mp4" type="video/mp4" />
        </video>

        {!playing && (
          <button
            type="button"
            className="walkthrough-play"
            onClick={play}
            aria-label="Play the desktop walkthrough, 35 seconds, no sound"
          >
            <span className="walkthrough-play-icon" aria-hidden="true">
              <FiPlay />
            </span>
            <span className="walkthrough-play-label">
              Watch the walkthrough
              <small>35s · no sound</small>
            </span>
          </button>
        )}
      </div>

      <p className="walkthrough-note">
        Open this site on a desktop browser to try it yourself.
      </p>
    </section>
  );
};

export default DesktopWalkthrough;
