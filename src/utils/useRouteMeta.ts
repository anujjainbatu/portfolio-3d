import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { config } from "../config";

function setAttribute(selector: string, attribute: string, value: string) {
  document.querySelector(selector)?.setAttribute(attribute, value);
}

/**
 * Keeps the static per-route head (written at build time by viteSeoPlugin)
 * correct when React Router navigates between routes without a page load.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = config.seo.routes[pathname];
    if (!meta) return;
    const url =
      pathname === "/" ? `${config.site.url}/` : `${config.site.url}${pathname}`;

    document.title = meta.title;
    setAttribute('link[rel="canonical"]', "href", url);
    setAttribute('meta[name="description"]', "content", meta.description);
    setAttribute('meta[property="og:url"]', "content", url);
    setAttribute('meta[property="og:title"]', "content", meta.title);
    setAttribute('meta[property="og:description"]', "content", meta.description);
    setAttribute('meta[name="twitter:title"]', "content", meta.title);
    setAttribute('meta[name="twitter:description"]', "content", meta.description);
  }, [pathname]);
}
