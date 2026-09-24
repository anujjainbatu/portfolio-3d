import { config } from "../shared/publicProfile.js";

/**
 * Build-time SEO output: per-route <head> tags, JSON-LD, a crawlable
 * <noscript> summary, sitemap.xml, robots.txt and llms.txt. Everything is
 * derived from the public profile, so no fact is written twice.
 */

export const SEO_ROUTES = ["/", "/myworks"] as const;
export type SeoRoute = (typeof SEO_ROUTES)[number];

const { site, developer, contact, location, seo } = config;
const PERSON_ID = `${site.url}/#person`;
const WEBSITE_ID = `${site.url}/#website`;

export const absoluteUrl = (path: string) =>
  path === "/" ? `${site.url}/` : `${site.url}${path}`;

const sameAs = [
  contact.github,
  contact.linkedin,
  contact.twitter,
  contact.instagram,
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const escapeXml = escapeHtml;

function routeMeta(route: SeoRoute) {
  return seo.routes[route];
}

function person() {
  const skills = [
    ...config.skills.build.tools,
    ...config.skills.integrate.tools,
  ].join(", ");
  const occupationLocation = {
    "@type": "City",
    name: `${location.city}, ${location.region}, India`,
  };

  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: developer.fullName,
    givenName: "Anuj",
    familyName: "Jain",
    url: absoluteUrl("/"),
    image: absoluteUrl(site.ogImage),
    email: `mailto:${contact.email}`,
    telephone: contact.phone,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "Phone",
        telephone: contact.phone,
        areaServed: "Worldwide",
        availableLanguage: ["English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "WhatsApp",
        url: contact.whatsapp,
        telephone: `+${contact.whatsapp.split("/").pop()}`,
        availableLanguage: ["English"],
      },
    ],
    jobTitle: developer.title,
    description: developer.description,
    disambiguatingDescription: `${developer.title} in ${config.social.location}. Also works as: ${developer.alternateTitles.join(", ")}.`,
    hasOccupation: [developer.title, ...developer.alternateTitles].map(
      (name) => ({
        "@type": "Occupation",
        name,
        occupationLocation,
        skills,
      }),
    ),
    knowsAbout: seo.keywords,
    worksFor: {
      "@type": "Organization",
      name: "Brilliant Brains",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Samrat Ashok Technological Institute",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Vidisha",
        addressRegion: "Madhya Pradesh",
        addressCountry: "IN",
      },
    },
    award: config.recognition
      .filter((item) => item.year)
      .map((item) => `${item.title} ${item.year}: ${item.detail}`),
    address: {
      "@type": "PostalAddress",
      addressLocality: location.city,
      addressRegion: location.region,
      addressCountry: location.country,
    },
    homeLocation: {
      "@type": "Place",
      name: `${location.city}, ${location.region}, India`,
      hasMap: location.mapsUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: location.city,
        addressRegion: location.region,
        addressCountry: location.country,
      },
    },
    sameAs,
  };
}

export function buildJsonLd(route: SeoRoute) {
  const url = absoluteUrl(route);
  const { title, description } = routeMeta(route);
  const website = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: developer.fullName,
    inLanguage: "en-IN",
    publisher: { "@id": PERSON_ID },
  };

  const page =
    route === "/"
      ? {
          "@type": "ProfilePage",
          "@id": `${url}#webpage`,
          url,
          name: title,
          description,
          isPartOf: { "@id": WEBSITE_ID },
          mainEntity: { "@id": PERSON_ID },
          primaryImageOfPage: absoluteUrl(site.ogImage),
        }
      : {
          "@type": "CollectionPage",
          "@id": `${url}#webpage`,
          url,
          name: title,
          description,
          isPartOf: { "@id": WEBSITE_ID },
          about: { "@id": PERSON_ID },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: config.projects.length,
            itemListElement: config.projects.map((project, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "CreativeWork",
                name: project.title,
                description: project.description,
                keywords: project.technologies.split(" · ").join(", "),
                creator: { "@id": PERSON_ID },
                ...(project.link ? { url: project.link } : {}),
              },
            })),
          },
        };

  return {
    "@context": "https://schema.org",
    "@graph": [website, page, person()],
  };
}

export function buildHead(route: SeoRoute) {
  const { title, description } = routeMeta(route);
  const url = absoluteUrl(route);
  const image = absoluteUrl(site.ogImage);
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  // "</" inside a script block would end it early.
  const jsonLd = JSON.stringify(buildJsonLd(route)).replace(/</g, "\\u003c");

  return [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="keywords" content="${escapeHtml(seo.keywords.join(", "))}" />`,
    `<meta name="author" content="${developer.fullName}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="geo.region" content="${location.regionCode}" />`,
    `<meta name="geo.placename" content="${location.city}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:site_name" content="${developer.fullName}" />`,
    `<meta property="og:locale" content="${site.locale}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(site.ogImageAlt)}" />`,
    `<meta property="profile:first_name" content="Anuj" />`,
    `<meta property="profile:last_name" content="Jain" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="${site.twitterHandle}" />`,
    `<meta name="twitter:creator" content="${site.twitterHandle}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(site.ogImageAlt)}" />`,
    ...sameAs.map((href) => `<link rel="me" href="${href}" />`),
    `<link rel="sitemap" type="application/xml" href="/sitemap.xml" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");
}

/** Plain HTML for crawlers that do not run JavaScript. */
export function buildNoscript(route: SeoRoute) {
  const projects = config.projects
    .map((project) => {
      const name = project.link
        ? `<a href="${project.link}">${escapeHtml(project.title)}</a>`
        : escapeHtml(project.title);
      return `<li>${name} (${escapeHtml(project.scale)}): ${escapeHtml(project.description)}</li>`;
    })
    .join("");
  const about =
    route === "/"
      ? config.about.description.map((p) => `<p>${escapeHtml(p)}</p>`).join("")
      : "";

  return `<noscript><main><h1>${developer.fullName}, ${developer.title}</h1><p>${escapeHtml(developer.description)} Based in <a href="${location.mapsUrl}">${config.social.location}</a>.</p>${about}<h2>Roles</h2><p>${[developer.title, ...developer.alternateTitles].join(" · ")}</p><h2>Production systems</h2><ul>${projects}</ul><h2>Contact</h2><p><a href="mailto:${contact.email}">${contact.email}</a> · <a href="tel:${contact.phone}">${contact.phoneDisplay}</a> · <a href="${contact.whatsapp}">WhatsApp ${contact.whatsappDisplay}</a> · <a href="${contact.github}">GitHub</a> · <a href="${contact.linkedin}">LinkedIn</a> · <a href="${contact.twitter}">X</a> · <a href="${contact.instagram}">Instagram</a> · <a href="${contact.resume}">Resume</a></p><p><a href="/">Home</a> · <a href="/myworks">Work</a></p></main></noscript>`;
}

export function buildSitemap(lastmod: string) {
  const image = absoluteUrl(site.ogImage);
  const urls = SEO_ROUTES.map(
    (route) => `  <url>
    <loc>${escapeXml(absoluteUrl(route))}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${route === "/" ? "1.0" : "0.8"}</priority>
    <image:image><image:loc>${image}</image:loc></image:image>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
}

export function buildRobots() {
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "PerplexityBot",
    "Google-Extended",
  ];
  return `User-agent: *
Allow: /
Disallow: /api/

${aiCrawlers.map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /api/`).join("\n\n")}

Sitemap: ${site.url}/sitemap.xml
`;
}

function projectLine(project: (typeof config.projects)[number]) {
  const href = project.link || absoluteUrl("/myworks");
  const result = project.result ? ` Result: ${project.result}.` : "";
  return `- [${project.title}](${href}): ${project.scale}. ${project.technologies}. ${project.description}${result}`;
}

/** llms.txt per https://llmstxt.org: H1, summary blockquote, link sections. */
export function buildLlmsTxt() {
  return `# ${developer.fullName}

> ${seo.routes["/"].description}

${developer.fullName} works at the point where a business's tools (Shopify, WhatsApp, email, ad platforms, CRMs) have to produce a measurable outcome: integration architecture, AI agents, workflow automation, revenue attribution and the API specifications engineering teams build against. Python backend work (FastAPI, Django) since 2023.

## Roles this work maps to

${[developer.title, ...developer.alternateTitles].map((role) => `- ${role}`).join("\n")}

## Production systems

${config.projects.map(projectLine).join("\n")}

## Pages

- [Home](${absoluteUrl("/")}): about, work, career, stack and contact
- [Work](${absoluteUrl("/myworks")}): every production system, with its architecture
- [Resume (PDF)](${absoluteUrl(contact.resume)})
- [Full profile for LLMs](${absoluteUrl("/llms-full.txt")})

## Contact

- Email: ${contact.email}
- Phone: ${contact.phoneDisplay}
- WhatsApp: [${contact.whatsappDisplay}](${contact.whatsapp})
- Location: ${config.social.location} ([map](${location.mapsUrl}))
- [GitHub](${contact.github})
- [LinkedIn](${contact.linkedin})
- [X](${contact.twitter})
- [Instagram](${contact.instagram})
`;
}

export function buildLlmsFullTxt() {
  const experience = config.experiences
    .map(
      (item) =>
        `- **${item.position}**, ${item.company} (${item.period}, ${item.location}): ${item.description}`,
    )
    .join("\n");
  const recognition = config.recognition
    .map(
      (item) =>
        `- ${item.title}${item.year ? ` (${item.year})` : ""}: ${item.detail}`,
    )
    .join("\n");
  const skills = [config.skills.build, config.skills.integrate]
    .map(
      (group) =>
        `### ${group.title}\n\n${group.details}\n\nTools: ${group.tools.join(", ")}`,
    )
    .join("\n\n");

  return `${buildLlmsTxt()}
## About

${config.about.description.join("\n\n")}

## Experience

${experience}

## Recognition

${recognition}

## Skills

${skills}
`;
}
