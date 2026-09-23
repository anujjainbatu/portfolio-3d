/**
 * Canonical public profile used by both the website and the server-side
 * portfolio assistant. Only information that is safe to publish belongs here.
 *
 * Rules this file is written under (see STORY.md):
 *  - Only real work. Nothing aspirational stated as if it already happened.
 *  - No client names. Describe them: "a D2C nutrition brand", "a large hospital".
 *  - No salary, no phone number, no mention of job searching.
 *  - Dates as years only.
 */

export interface Stat {
  value: string;
  label: string;
}

export interface Experience {
  position: string;
  company: string;
  period: string;
  location: string;
  description: string;
  current?: boolean;
}

export interface Project {
  id: number;
  title: string;
  /** Shown under the title — how far the system reaches. */
  scale: string;
  /** What it is built on, as one line. */
  technologies: string;
  /** The pipeline, rendered as a flow diagram on the card. */
  flow: string[];
  description: string;
  /** The outcome, when there is one worth naming. */
  result?: string;
  status: "live" | "in progress";
  /** Public URL, or "" when the system is client-internal. */
  link: string;
}

export interface Recognition {
  year: string;
  title: string;
  detail: string;
}

export interface SkillGroup {
  title: string;
  description: string;
  details: string;
  tools: string[];
}

export const config = {
  developer: {
    name: "Anuj",
    fullName: "Anuj Jain",
    title: "AI Solutions Engineer",
    /** The two lines that animate in the hero, and the loader marquee. */
    roles: ["AI Solutions Engineer", "Commerce Automation"],
    description:
      "AI solutions engineer working across Shopify, WhatsApp, n8n and AI agents. Integration architecture, revenue attribution and internal tooling.",
  },

  social: {
    github: "anujjainbatu",
    email: "anujjainbatu@gmail.com",
    location: "Hyderabad, India",
  },

  about: {
    title: "About Me",
    description: [
      "I connect the tools a business already pays for, so they finally produce the outcome it bought them for.",
      "I spent college trying to become an ML engineer, and did the things that are supposed to work: second of 88,221 teams at Smart India Hackathon, Amazon ML Summer School, Technical Lead at Google Developer Group, backend work on Fiverr the whole way through. The offers didn't come, and the last door, an Applied Scientist interview at Amazon, closed too.",
      "So in 2026 I stopped chasing the title I wanted and started learning automation instead. Within a month I had an offer, and the work turned out to suit me better than the job I had been aiming at. Almost none of my best work since then was assigned. Something breaks that nobody owns, I am the one who is there, and it ends up a system nobody has to think about again.",
    ],
  },

  stats: [
    { value: "20+", label: "client environments running my systems" },
    { value: "25+", label: "backend solutions delivered independently" },
    { value: "2nd", label: "of 88,221 teams, Smart India Hackathon 2024" },
  ] as Stat[],

  experiences: [
    {
      position: "AI Solutions Engineer",
      company: "Brilliant Brains",
      period: "2026 - Present",
      location: "Hyderabad, India",
      description:
        "Hired for WhatsApp marketing automation. Now spanning automation, integrations, web development, internal tooling and pre-sales.",
      current: true,
    },
    {
      position: "Python Backend Engineer",
      company: "Independent / Fiverr",
      period: "2023 - Present",
      location: "Remote",
      description:
        "25+ production backend solutions in FastAPI and Django for clients worldwide. Standardised issue documentation that cut repeat problems by 60%.",
      current: true,
    },
    {
      position: "B.Tech, Internet of Things",
      company: "Samrat Ashok Technological Institute, Vidisha",
      period: "2022 - 2026",
      location: "Vidisha, India",
      description:
        "CGPA 7.95 / 10, with freelance client work running concurrently throughout the degree.",
    },
  ] as Experience[],

  /**
   * Six systems in production. The first five feed the home page carousel;
   * all six appear on /myworks.
   */
  projects: [
    {
      id: 1,
      title: "WhatsApp commerce platform",
      scale: "8 Shopify stores",
      technologies: "Shopify · Interakt · n8n · AI agents",
      flow: ["Shopify", "n8n", "AI agent", "WhatsApp", "Revenue"],
      description:
        "Customer segmentation and lifecycle journeys: abandoned-cart recovery, repeat purchase, post-purchase engagement and retention. Built on Shopify, Interakt and n8n, with AI agents handling the conversation.",
      result: "~₹15L/month in attributed revenue for a D2C nutrition brand",
      status: "live",
      link: "",
    },
    {
      id: 2,
      title: "Revenue intelligence & attribution",
      scale: "14 clients",
      technologies: "Google Ads API · Meta Ads API · Shopify · SQL",
      flow: ["Google Ads", "Meta Ads", "Shopify", "Pipeline", "Dashboard"],
      description:
        "Ad spend, revenue and customer metrics unified into dashboards through reusable reporting pipelines, replacing manual reporting. For a subscription commerce brand with a recharge model that nobody knew how to measure, I defined the attribution framework from scratch and wrote the API specifications the engineering team built against.",
      result: "Ad spend → customer → revenue, finally measurable",
      status: "live",
      link: "",
    },
    {
      id: 3,
      title: "AI lead qualification & sales",
      scale: "6 hospitals and clinics",
      technologies: "Meta Lead Forms · n8n · ElevenLabs · Interakt · Zapier",
      flow: ["Lead form", "n8n", "Voice AI", "WhatsApp", "CRM", "Sales alert"],
      description:
        "A lead arrives, an AI voice agent calls and qualifies it, WhatsApp follows up, a meeting gets scheduled, the CRM is updated and sales are alerted live. What used to be manual chasing now runs end to end.",
      status: "live",
      link: "",
    },
    {
      id: 4,
      title: "Google Ads balance forecaster",
      scale: "Every managed account",
      technologies: "Google Ads API · n8n · Scheduled jobs",
      flow: ["Ads API", "Forecast", "Friday alert"],
      description:
        "Client ad budgets kept running dry over the weekend and campaigns stopped with nobody watching. Every Friday this answers one question per client: does the balance last until Monday? Plus threshold alerts whenever a balance runs low.",
      result: "Weekend outages caught before they happen",
      status: "live",
      link: "",
    },
    {
      id: 5,
      title: "Internal task manager",
      scale: "Company-wide",
      technologies: "Next.js · PostgreSQL · AI-assisted build",
      flow: ["Tasks", "Credentials", "Audit log"],
      description:
        "We were paying around $300 a month for a tool that was heavier than a small team needed. I built ours instead, and it has stayed a continuous project. The newest piece is a credential manager that logs who revealed which password, and when.",
      result: "Replaced a ~$300/month subscription",
      status: "live",
      link: "",
    },
    {
      id: 6,
      title: "Websites, shipped with AI",
      scale: "Primary web developer",
      technologies: "Next.js · WordPress migration · AI-assisted development",
      flow: ["Brief", "AI-assisted build", "Launch"],
      description:
        "A 45-page site for a large multi-specialty hospital, and every non-Shopify site the company ships. Currently migrating three hospital sites from WordPress to Next.js. I use AI to write code and say so; the interesting part was never who typed it.",
      status: "in progress",
      link: "",
    },
  ] as Project[],

  recognition: [
    {
      year: "2024",
      title: "Smart India Hackathon",
      detail: "2nd among 88,221 teams, for a scalable backend solution",
    },
    {
      year: "2025",
      title: "Amazon ML Summer School",
      detail: "Selected from 60,000+ applicants",
    },
    {
      year: "—",
      title: "Google Developer Group",
      detail:
        "Technical Lead: workshops and live demos on Python, API design and AI for 250+ members",
    },
    {
      year: "—",
      title: "Certifications",
      detail:
        "Machine Learning Specialisation (Stanford & DeepLearning.AI) · Python (IIT Madras, NPTEL)",
    },
  ] as Recognition[],

  contact: {
    email: "anujjainbatu@gmail.com",
    github: "https://github.com/anujjainbatu",
    linkedin: "https://linkedin.com/in/anujjainbatu",
    resume: "/anuj-jain-resume.pdf",
  },

  skills: {
    build: {
      title: "AI & AUTOMATION",
      description: "Systems that run without anyone watching",
      details:
        "AI agents and workflow automation wired into the tools a business already runs — lead qualification, lifecycle messaging, reporting that writes itself. Built on n8n, Python and the major model APIs, with structured logging, retries and error recovery so they hold up in production.",
      tools: [
        "n8n",
        "Python",
        "OpenAI",
        "Anthropic",
        "Gemini",
        "ElevenLabs",
        "FastAPI",
        "Django",
        "Zapier",
        "AI agents",
      ],
    } as SkillGroup,
    integrate: {
      title: "COMMERCE & INTEGRATION",
      description: "Making the tools talk to each other",
      details:
        "Shopify, WhatsApp and the ad platforms joined into one system, with the attribution to prove it worked. REST contracts, webhooks and API specifications written for the engineering teams that build against them.",
      tools: [
        "Shopify",
        "WhatsApp Business API",
        "Interakt",
        "Payment gateways",
        "Meta Ads",
        "Google Ads",
        "REST APIs",
        "Webhooks",
        "Postman",
        "Attribution",
      ],
    } as SkillGroup,
  },
};

/**
 * Public-safe context that is useful in conversation but does not need a
 * dedicated section on the visual portfolio. Empty collections are deliberate:
 * the assistant must say it does not know rather than invent personal facts.
 */
export const chatProfile = {
  assistant: {
    name: "Anuj's AI assistant",
    disclosure:
      "I’m Anuj’s AI assistant. I answer from the public profile he approved.",
  },
  careerPivot: [
    "Anuj spent college aiming for machine-learning roles while building production Python backends on Fiverr.",
    "After Smart India Hackathon, Amazon ML Summer School, and an Applied Scientist interview did not lead to the role he expected, he changed direction toward automation in 2026.",
    "The pivot suited his strengths in integration architecture, API design, customer discovery, and shipping production systems.",
  ],
  workStyle: [
    "He takes ownership of gaps that do not yet have a clear owner.",
    "He solves a problem manually first, then turns the solution into a reusable system.",
    "When success cannot be measured, he defines the measurement before optimising it.",
    "He uses AI-assisted development openly, while taking responsibility for architecture, review, deployment, and outcomes.",
  ],
  values: [
    "Plain, specific communication without hype.",
    "Honesty about unknowns and the limits of his experience.",
    "Production reliability through logging, retries, monitoring, and error recovery.",
    "Useful integrations that connect tools to measurable business outcomes.",
  ],
  approvedInterests: [] as string[],
};

export type PublicProfile = typeof config;
export type ChatProfile = typeof chatProfile;
