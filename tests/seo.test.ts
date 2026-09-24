import { describe, expect, it } from "vitest";
import {
  buildHead,
  buildJsonLd,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildNoscript,
  buildRobots,
  buildSitemap,
  SEO_ROUTES,
} from "../server/seo";

type Node = Record<string, unknown>;
const graph = (route: (typeof SEO_ROUTES)[number]) =>
  buildJsonLd(route)["@graph"] as Node[];
const findType = (route: (typeof SEO_ROUTES)[number], type: string) =>
  graph(route).find((node) => node["@type"] === type);

describe("SEO output", () => {
  it("gives each route its own absolute canonical and og:url", () => {
    expect(buildHead("/")).toContain(
      '<link rel="canonical" href="https://anujjain.in/" />',
    );
    expect(buildHead("/myworks")).toContain(
      '<link rel="canonical" href="https://anujjain.in/myworks" />',
    );
    expect(buildHead("/myworks")).toContain(
      '<meta property="og:url" content="https://anujjain.in/myworks" />',
    );
    expect(buildHead("/")).toContain(
      'content="https://anujjain.in/og-image.png"',
    );
  });

  it("embeds JSON-LD that parses back to the same graph", () => {
    const script = buildHead("/").match(
      /<script type="application\/ld\+json">(.*)<\/script>/,
    );
    expect(script).not.toBeNull();
    expect(JSON.parse(script![1])).toEqual(buildJsonLd("/"));
  });

  it("describes the person with location, socials and similar roles", () => {
    const person = findType("/", "Person")!;
    expect(person.sameAs).toHaveLength(4);
    expect(person.address).toMatchObject({
      addressLocality: "Hyderabad",
      addressCountry: "IN",
    });
    const roles = (person.hasOccupation as Node[]).map((role) => role.name);
    expect(roles).toContain("Forward Deployed Engineer");
    expect(roles).not.toContain("ML Engineer");
  });

  it("lists every project on /myworks", () => {
    const page = findType("/myworks", "CollectionPage")!;
    const list = page.mainEntity as Node;
    expect(list.itemListElement).toHaveLength(8);
    expect(findType("/", "ProfilePage")).toBeDefined();
  });

  it("builds a sitemap with both routes and robots pointing to it", () => {
    const sitemap = buildSitemap("2026-09-24");
    expect(sitemap.match(/<loc>/g)).toHaveLength(2);
    expect(sitemap).toContain("<loc>https://anujjain.in/myworks</loc>");
    expect(buildRobots()).toContain(
      "Sitemap: https://anujjain.in/sitemap.xml",
    );
    expect(buildRobots()).toContain("Disallow: /api/");
  });

  it("writes llms.txt in the llmstxt.org shape", () => {
    const llms = buildLlmsTxt();
    expect(llms.startsWith("# Anuj Jain\n\n> ")).toBe(true);
    expect(llms).toContain("## Production systems");
    expect(llms).toContain("(https://unicareglobalhospitals.com)");
    expect(buildLlmsFullTxt()).toContain("## Experience");
  });

  it("publishes phone and WhatsApp in schema and llms.txt", () => {
    const person = findType("/", "Person")!;
    expect(person.telephone).toBe("+918305117236");
    expect(buildLlmsTxt()).toContain("https://wa.me/918897817236");
    expect(buildNoscript("/")).toContain('href="tel:+918305117236"');
  });

  it("keeps private facts out of every generated file", () => {
    const output = [
      ...SEO_ROUTES.flatMap((route) => [buildHead(route), buildNoscript(route)]),
      buildLlmsFullTxt(),
    ].join("\n");
    for (const secret of ["Milkvilla", "One Science Nutrition"]) {
      expect(output).not.toContain(secret);
    }
  });
});
