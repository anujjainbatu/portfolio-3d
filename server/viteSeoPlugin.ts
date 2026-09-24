import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import {
  buildHead,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildNoscript,
  buildRobots,
  buildSitemap,
  type SeoRoute,
} from "./seo";

const HEAD_MARKER = "<!--seo:head-->";
const BODY_MARKER = "<!--seo:body-->";
const HEAD_BLOCK = /<!--seo:head:start-->[\s\S]*?<!--seo:head:end-->/;
const BODY_BLOCK = /<!--seo:body:start-->[\s\S]*?<!--seo:body:end-->/;

const headBlock = (route: SeoRoute) =>
  `<!--seo:head:start-->\n    ${buildHead(route)}\n    <!--seo:head:end-->`;
const bodyBlock = (route: SeoRoute) =>
  `<!--seo:body:start-->${buildNoscript(route)}<!--seo:body:end-->`;

/**
 * Writes the home page's SEO tags into index.html, then after the build emits
 * a /myworks copy with its own head, plus sitemap, robots and llms.txt files.
 */
export function viteSeoPlugin(): Plugin {
  let outDir = "dist";
  let isBuild = false;

  return {
    name: "portfolio-seo",
    configResolved(resolved) {
      outDir = join(resolved.root, resolved.build.outDir);
      isBuild = resolved.command === "build";
    },
    transformIndexHtml(html) {
      return html
        .replace(HEAD_MARKER, headBlock("/"))
        .replace(BODY_MARKER, bodyBlock("/"));
    },
    closeBundle() {
      // Vite also calls this when the dev server shuts down.
      if (!isBuild) return;
      const indexHtml = readFileSync(join(outDir, "index.html"), "utf8");
      const myworksHtml = indexHtml
        .replace(HEAD_BLOCK, headBlock("/myworks"))
        .replace(BODY_BLOCK, bodyBlock("/myworks"));

      // Served at /myworks by Vercel's cleanUrls and by vite preview.
      writeFileSync(join(outDir, "myworks.html"), myworksHtml);

      const today = new Date().toISOString().slice(0, 10);
      writeFileSync(join(outDir, "sitemap.xml"), buildSitemap(today));
      writeFileSync(join(outDir, "robots.txt"), buildRobots());
      writeFileSync(join(outDir, "llms.txt"), buildLlmsTxt());
      writeFileSync(join(outDir, "llms-full.txt"), buildLlmsFullTxt());
    },
  };
}
