import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./styles/TechStackNew.css";

type Category = "code" | "automation" | "ai" | "infra";

interface TechItem {
  name: string;
  url: string;
  cat: Category;
  /** 3 = headline tool, 1 = supporting. Drives the label size. */
  weight: 1 | 2 | 3;
}

const filters: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "code", label: "Languages & Web" },
  { id: "automation", label: "Automation" },
  { id: "ai", label: "AI & Data" },
  { id: "infra", label: "Infra & Tools" },
];

const techStack: TechItem[] = [
  // Languages and the web layer
  { name: "Python", url: "https://python.org", cat: "code", weight: 3 },
  { name: "TypeScript", url: "https://typescriptlang.org", cat: "code", weight: 3 },
  { name: "React", url: "https://react.dev", cat: "code", weight: 3 },
  { name: "JavaScript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", cat: "code", weight: 2 },
  { name: "SQL", url: "https://www.postgresql.org/docs/current/sql.html", cat: "code", weight: 2 },
  { name: "FastAPI", url: "https://fastapi.tiangolo.com", cat: "code", weight: 2 },
  { name: "Node.js", url: "https://nodejs.org", cat: "code", weight: 2 },
  { name: "Next.js", url: "https://nextjs.org", cat: "code", weight: 2 },
  { name: "Django", url: "https://djangoproject.com", cat: "code", weight: 1 },
  { name: "Tailwind", url: "https://tailwindcss.com", cat: "code", weight: 1 },
  { name: "HTML", url: "https://developer.mozilla.org/en-US/docs/Web/HTML", cat: "code", weight: 1 },
  { name: "CSS", url: "https://developer.mozilla.org/en-US/docs/Web/CSS", cat: "code", weight: 1 },
  // The automation and integration layer, the actual day job
  { name: "n8n", url: "https://n8n.io", cat: "automation", weight: 3 },
  { name: "Zapier", url: "https://zapier.com", cat: "automation", weight: 3 },
  { name: "Shopify", url: "https://shopify.dev", cat: "automation", weight: 3 },
  { name: "WhatsApp / Email", url: "https://developers.facebook.com/docs/whatsapp", cat: "automation", weight: 2 },
  { name: "Meta Ads", url: "https://developers.facebook.com/docs/marketing-apis", cat: "automation", weight: 2 },
  { name: "Google Ads", url: "https://developers.google.com/google-ads/api/docs/start", cat: "automation", weight: 2 },
  { name: "Stripe", url: "https://stripe.com/docs", cat: "automation", weight: 1 },
  { name: "Mailchimp", url: "https://mailchimp.com/developer/", cat: "automation", weight: 1 },
  { name: "Postman", url: "https://postman.com", cat: "automation", weight: 1 },
  { name: "Swagger", url: "https://swagger.io", cat: "automation", weight: 1 },
  // Models, agents and the data tooling around them
  { name: "OpenAI", url: "https://platform.openai.com/docs", cat: "ai", weight: 3 },
  { name: "Anthropic", url: "https://docs.anthropic.com", cat: "ai", weight: 3 },
  { name: "Gemini", url: "https://ai.google.dev", cat: "ai", weight: 2 },
  { name: "LangChain", url: "https://python.langchain.com", cat: "ai", weight: 2 },
  { name: "ElevenLabs", url: "https://elevenlabs.io/docs", cat: "ai", weight: 1 },
  { name: "HuggingFace", url: "https://huggingface.co", cat: "ai", weight: 1 },
  { name: "Pandas", url: "https://pandas.pydata.org", cat: "ai", weight: 2 },
  { name: "NumPy", url: "https://numpy.org", cat: "ai", weight: 1 },
  // Data stores, infrastructure and everyday tools
  { name: "PostgreSQL", url: "https://postgresql.org", cat: "infra", weight: 3 },
  { name: "Docker", url: "https://docker.com", cat: "infra", weight: 3 },
  { name: "AWS", url: "https://aws.amazon.com", cat: "infra", weight: 2 },
  { name: "MySQL", url: "https://mysql.com", cat: "infra", weight: 1 },
  { name: "NGINX", url: "https://nginx.org", cat: "infra", weight: 1 },
  { name: "Linux", url: "https://linux.org", cat: "infra", weight: 2 },
  { name: "Git", url: "https://git-scm.com", cat: "infra", weight: 2 },
  { name: "GitHub", url: "https://github.com", cat: "infra", weight: 2 },
  { name: "Actions", url: "https://docs.github.com/actions", cat: "infra", weight: 1 },
  { name: "Vercel", url: "https://vercel.com", cat: "infra", weight: 2 },
  { name: "VS Code", url: "https://code.visualstudio.com", cat: "infra", weight: 1 },
  { name: "Claude", url: "https://claude.com/claude-code", cat: "infra", weight: 2 },
];

/** Below this stage width the longest labels outgrow the sphere; show a list. */
const FLAT_BELOW_PX = 560;
/** Idle spin, in radians per frame. */
const SPIN_X = 0.0012;
const SPIN_Y = 0.0028;
/** A press that travels further than this is a drag, not a link click. */
const DRAG_SLOP_PX = 5;
/**
 * Perspective pushes tags outward past the raw radius: with focal length
 * f = 1.9r a projected point can land as far out as 1.175r. Clamping the
 * radius so 1.2r fits on both axes keeps the sphere from being sliced by the
 * stage's overflow.
 */
const PROJECTION_REACH = 1.2;
/** A little wider than tall, so the ball fills a landscape stage. */
const OVAL = 1.18;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const TechStackNew = () => {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [flat, setFlat] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const tags = Array.from(stage.querySelectorAll<HTMLElement>(".ts-tag"));
    const n = tags.length;

    // Fibonacci sphere: even spacing with no clumping at the poles.
    const points = tags.map((el, i) => {
      const phi = Math.acos(-1 + (2 * i + 1) / n);
      const theta = Math.sqrt(n * Math.PI) * phi;
      return {
        el,
        x: Math.cos(theta) * Math.sin(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(phi),
      };
    });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const idleX = reduceMotion ? 0 : SPIN_X;
    const idleY = reduceMotion ? 0 : SPIN_Y;

    const s = {
      rx: 200,
      ry: 200,
      angleX: -0.25,
      angleY: 0,
      velX: idleX,
      velY: idleY,
      flat: false,
      onScreen: false,
    };

    const size = () => {
      const w = stage.clientWidth;
      const nextFlat = w < FLAT_BELOW_PX;
      if (nextFlat !== s.flat) {
        s.flat = nextFlat;
        setFlat(nextFlat);
        if (nextFlat) for (const p of points) p.el.removeAttribute("style");
      }
      if (s.flat) return;
      // The widest label decides how far the sphere may spread before one
      // is clipped at the stage edge.
      const maxHalf = Math.max(...tags.map((t) => t.offsetWidth)) / 2;
      const roomX = (w / 2 - maxHalf - 8) / (PROJECTION_REACH * OVAL);
      const roomY = (stage.clientHeight / 2 - 16) / PROJECTION_REACH;
      const rad = Math.max(110, Math.min(w * 0.36, roomX, roomY));
      s.rx = rad * OVAL;
      s.ry = rad;
    };

    const render = () => {
      if (!s.onScreen || s.flat) return;
      const cx = stage.clientWidth / 2;
      const cy = stage.clientHeight / 2;
      // A short focal length exaggerates near/far size, which is what makes
      // the eye read a ball rather than a flat scatter.
      const fov = s.rx * 1.9;

      if (!drag.active) {
        s.angleY += s.velY;
        s.angleX += s.velX;
        // Let a flick coast, then settle back to the idle spin.
        s.velY = lerp(s.velY, idleY, 0.02);
        s.velX = lerp(s.velX, idleX, 0.02);
      }

      const cosY = Math.cos(s.angleY);
      const sinY = Math.sin(s.angleY);
      const cosX = Math.cos(s.angleX);
      const sinX = Math.sin(s.angleX);

      for (const p of points) {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const scale = fov / (fov + z2 * s.rx);
        const X = cx + x1 * s.rx * scale;
        const Y = cy + y2 * s.ry * scale;

        p.el.style.transform = `translate3d(${X.toFixed(1)}px, ${Y.toFixed(
          1
        )}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        p.el.style.zIndex = String(Math.round(scale * 200));
        // Dimmed tags keep the filter's opacity from the stylesheet.
        if (p.el.classList.contains("dim")) {
          p.el.style.opacity = "";
        } else {
          const depth = clamp01((scale - 0.5) / 0.85);
          p.el.style.opacity = (0.12 + 0.88 * depth * depth).toFixed(3);
        }
      }
    };

    const drag = {
      active: false,
      id: -1,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      moved: false,
    };

    const onDown = (e: PointerEvent) => {
      if (s.flat || e.button !== 0) return;
      drag.id = e.pointerId;
      drag.startX = drag.lastX = e.clientX;
      drag.startY = drag.lastY = e.clientY;
      drag.moved = false;
      drag.active = true;
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.active || e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (
          Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) <
          DRAG_SLOP_PX
        )
          return;
        drag.moved = true;
        // Captured only once it is a real drag: capturing on press would
        // retarget the click to the stage and stop the tag links working.
        stage.setPointerCapture(e.pointerId);
        stage.classList.add("dragging");
      }
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      s.angleY += dx * 0.005;
      s.angleX -= dy * 0.005;
      s.velY = dx * 0.0016;
      s.velX = -dy * 0.0016;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      drag.active = false;
      stage.classList.remove("dragging");
    };
    // A drag that happens to end on a tag must not open it.
    const onClick = (e: MouseEvent) => {
      if (drag.moved) {
        e.preventDefault();
        drag.moved = false;
      }
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("click", onClick, true);

    const io = new IntersectionObserver(
      ([entry]) => {
        s.onScreen = entry.isIntersecting;
      },
      { rootMargin: "15% 0px" }
    );
    io.observe(stage);
    const ro = new ResizeObserver(size);
    ro.observe(stage);
    size();

    gsap.ticker.add(render);

    return () => {
      gsap.ticker.remove(render);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <div className="techstack-new">
      {/* Video Background */}
      <div className="techstack-video-container">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="techstack-video"
        >
          <source src="/video/video.webm" type="video/webm" />
        </video>
        {/* Dark Overlay */}
        <div className="techstack-overlay"></div>
      </div>

      {/* Content */}
      <div className="techstack-content">
        <h2>Tech Stack</h2>

        <div className="ts-filters" role="group" aria-label="Filter tech stack">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ts-filter${filter === f.id ? " active" : ""}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              data-cursor="disable"
            >
              {f.id !== "all" && <span className="ts-dot" data-cat={f.id} />}
              {f.label}
            </button>
          ))}
        </div>

        <div
          ref={stageRef}
          className={`ts-stage${flat ? " flat" : ""}`}
          data-cursor="disable"
        >
          {techStack.map((tech) => {
            const state =
              filter === "all" ? "" : filter === tech.cat ? " match" : " dim";
            return (
              <a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`ts-tag${state}`}
                data-cat={tech.cat}
                data-weight={tech.weight}
                draggable={false}
              >
                {tech.name}
              </a>
            );
          })}
        </div>

        {!flat && <p className="ts-hint">Drag to spin</p>}
      </div>
    </div>
  );
};

export default TechStackNew;
