/**
 * Build-time SEO for a client-rendered app:
 *  - absolute Open Graph/Twitter/canonical/JSON-LD tags in index.html (need the public site URL);
 *  - a static, readable copy of the landing page inside #root for crawlers without JavaScript
 *    (Bing, messengers…); React replaces it on start, JS users never see it;
 *  - robots.txt and sitemap.xml generated for the same URL.
 * The site URL comes from VITE_SITE_URL (production: the FRONTEND_URL of the server).
 */
import { readFileSync } from "node:fs";

import type { Plugin } from "vite";

interface Landing {
  needHelpTitle: string;
  needHelpText: string;
  canHelpTitle: string;
  canHelpText: string;
  how: string;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  notMarketplace: string;
  trustTitle: string;
  trust: string[];
  join: string;
  login: string;
}

const PUBLIC_PAGES = ["/", "/privacy", "/terms"];
const PRIVATE_PREFIXES = [
  "/help/",
  "/chats/",
  "/chat/",
  "/profile/",
  "/settings",
  "/notifications",
  "/onboarding",
  "/auth/",
  "/share/",
  "/support",
  "/api/",
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function seo(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, "");
  const uk = JSON.parse(readFileSync(new URL("./src/i18n/locales/uk.json", import.meta.url), "utf8")) as {
    app: { slogan: string };
    landing: Landing;
    emergency: { short: string };
  };
  const l = uk.landing;
  const title = `Poruch — ${uk.app.slogan.toLowerCase()}`;
  const description =
    "Попроси про допомогу людей поруч або допоможи сам: розряджений акумулятор, важкі речі, загублена тварина. Без оплат і комісій.";

  const head = `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${site}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Poruch" />
    <meta property="og:locale" content="uk_UA" />
    <meta property="og:url" content="${site}/" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${site}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Poruch — допомога від людей поруч" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${site}/og-image.png" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Poruch",
      url: `${site}/`,
      description,
      applicationCategory: "SocialNetworkingApplication",
      operatingSystem: "Android, iOS, Windows, macOS, Linux (PWA)",
      inLanguage: ["uk", "en", "es", "de", "fr", "pl", "pt", "it", "tr", "ja", "ko", "zh", "hi"],
      offers: { "@type": "Offer", price: "0", priceCurrency: "UAH" },
    })}</script>`;

  // Same content as the React landing page (from uk.json), plain semantic HTML.
  const fallback = `<div class="seo-fallback">
      <header><strong>Poruch</strong> — <em>${esc(uk.app.slogan)}</em></header>
      <main>
        <h1>${esc(title)}</h1>
        <section><h2>${esc(l.needHelpTitle)}</h2><p>${esc(l.needHelpText)}</p></section>
        <section><h2>${esc(l.canHelpTitle)}</h2><p>${esc(l.canHelpText)}</p></section>
        <p><a href="/auth/register">${esc(l.join)}</a> · <a href="/auth/login">${esc(l.login)}</a></p>
        <section><h2>${esc(l.how)}</h2><ol>${[l.step1, l.step2, l.step3, l.step4].map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
        <p>${esc(l.notMarketplace)}</p>
        <section><h2>${esc(l.trustTitle)}</h2><ul>${l.trust.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>
        <p>${esc(uk.emergency.short.replace("{{numbers}}", "112 / 101 / 102 / 103"))}</p>
      </main>
      <footer><a href="/privacy">Політика конфіденційності</a> · <a href="/terms">Умови використання</a></footer>
    </div>`;

  const robots = [
    "User-agent: *",
    "Allow: /$",
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_PAGES.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;

  return {
    name: "poruch-seo",
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, "")
        .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
        .replace("</head>", `${head}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root">${fallback}</div>`);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/robots.txt" || req.url === "/sitemap.xml") {
          res.setHeader("Content-Type", req.url === "/robots.txt" ? "text/plain" : "application/xml");
          res.end(req.url === "/robots.txt" ? robots : sitemap);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
    },
  };
}
