import { useEffect, useState } from "react";
import "./styles/Loading.css";
import { useLoading } from "../context/LoadingProvider";
import { config } from "../config";

import Marquee from "react-fast-marquee";

/** ms at 100% before the gate reports itself cleared. */
const CLEAR_DELAY = 600;
/** ms the cleared readout is held before the doors start moving. */
const HOLD_DELAY = 1000;
/**
 * ms the doors get to travel before this component unmounts.
 *
 * Was 900, which was enough for the old circle wipe. The gate has further to
 * go: two panels clearing the viewport while the whole assembly scales past the
 * camera. Cut it short and the doors vanish mid-slide.
 */
const OPEN_DURATION = 1400;

const Loading = ({ percent }: { percent: number }) => {
  const { setIsLoading } = useLoading();
  const [loaded, setLoaded] = useState(false);
  const [opening, setOpening] = useState(false);
  /**
   * Latched, deliberately: once 100 has been seen the gate is committed.
   *
   * The percentage can go BACKWARDS. StrictMode double-invokes the Scene
   * effect, so two setProgress intervals exist and the discarded one keeps
   * writing its slow count over the live one's ramp to 100. Keying the
   * sequence on `percent` directly meant its cleanup cancelled the pending
   * timers every time that happened, and the loader never opened at all.
   */
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    if (percent >= 100) setCleared(true);
  }, [percent]);

  // Staged in an effect, not during render. The previous version called
  // setTimeout inline in the component body, so every re-render at 100%
  // scheduled another pair of timers; it survived only because the state
  // writes happened to be idempotent. The gate hangs a longer sequence off
  // this, and it is what gates the whole site appearing.
  useEffect(() => {
    if (!cleared) return;
    let open: ReturnType<typeof setTimeout>;
    const clear = setTimeout(() => {
      setLoaded(true);
      open = setTimeout(() => setOpening(true), HOLD_DELAY);
    }, CLEAR_DELAY);
    return () => {
      clearTimeout(clear);
      clearTimeout(open);
    };
  }, [cleared]);

  useEffect(() => {
    if (!opening) return;
    let done: ReturnType<typeof setTimeout>;
    // initialFX fires WITH the doors, not after them. It adds .main-active,
    // which drops the page to opacity 0 and fades it back over a second — run
    // after the reveal that would blank the site exactly as it came into view.
    // Overlapped, the page brightens as the gap widens.
    import("./utils/initialFX").then((module) => {
      module.initialFX?.();
      done = setTimeout(() => setIsLoading(false), OPEN_DURATION);
    });
    return () => clearTimeout(done);
  }, [opening, setIsLoading]);

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const { currentTarget: target } = e;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    target.style.setProperty("--mouse-x", `${x}px`);
    target.style.setProperty("--mouse-y", `${y}px`);
  }

  return (
    <>
      <div className="loading-header">
        <a href="/#" className="loader-title" data-cursor="disable">
          {config.developer.fullName.replace(" ", "")}
        </a>
        {/* The old bouncing-ball easter egg, reframed as a hull scanner. Same
            DOM and same keyframes; only the dressing in the stylesheet moved. */}
        <div className={`loaderGame ${opening && "loader-out"}`}>
          <div className="loaderGame-container">
            <div className="loaderGame-in">
              {[...Array(27)].map((_, index) => (
                <div className="loaderGame-line" key={index}></div>
              ))}
            </div>
            <div className="loaderGame-ball"></div>
          </div>
        </div>
      </div>
      <div className="loading-screen">
        <div
          className={`hangar ${opening ? "hangar-open" : ""}`}
          // Progress reaches the stylesheet as a number, so the seam can light
          // up with it without any of this needing extra React state.
          style={{ "--p": percent } as React.CSSProperties}
        >
          <div className="hangar-door is-left" aria-hidden="true"></div>
          <div className="hangar-door is-right" aria-hidden="true"></div>
          <div className="hangar-glow" aria-hidden="true"></div>
          <div className="hangar-seam" aria-hidden="true"></div>

          <div className="hangar-frame">
            <div className="hangar-crawl">
              <Marquee>
                {[...Array(2)].map((_, i) =>
                  config.developer.roles.map((role) => (
                    <span key={`${i}-${role}`}>&nbsp; {role} &nbsp;</span>
                  ))
                )}
              </Marquee>
            </div>
            <div
              className={`loading-wrap ${opening && "loading-clicked"}`}
              onMouseMove={(e) => handleMouseMove(e)}
            >
              <div className="loading-hover"></div>
              <div className={`loading-button ${loaded && "loading-complete"}`}>
                <div className="loading-container">
                  <div className="loading-content">
                    <div className="loading-content-in">
                      Loading <span>{percent}%</span>
                    </div>
                  </div>
                  <div className="loading-box"></div>
                </div>
                <div className="loading-content2">
                  <span>Welcome</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Loading;

export const setProgress = (setLoading: (value: number) => void) => {
  let percent: number = 0;

  let interval = setInterval(() => {
    if (percent <= 50) {
      const rand = Math.round(Math.random() * 5);
      percent = percent + rand;
      setLoading(percent);
    } else {
      clearInterval(interval);
      interval = setInterval(() => {
        percent = percent + Math.round(Math.random());
        setLoading(percent);
        if (percent > 91) {
          clearInterval(interval);
        }
      }, 2000);
    }
  }, 100);

  function clear() {
    clearInterval(interval);
    setLoading(100);
  }

  /**
   * Stop counting without reporting completion.
   *
   * clear() jumps to 100, which is right for "we are done" and wrong for "this
   * loader is being thrown away" — the case StrictMode creates every mount,
   * where the discarded instance would otherwise keep writing over the live
   * one's percentage for the rest of the page's life.
   */
  function stop() {
    clearInterval(interval);
  }

  function loaded() {
    return new Promise<number>((resolve) => {
      clearInterval(interval);
      interval = setInterval(() => {
        if (percent < 100) {
          percent++;
          setLoading(percent);
        } else {
          resolve(percent);
          clearInterval(interval);
        }
      }, 2);
    });
  }
  return { loaded, percent, clear, stop };
};
