import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("PWA Configuration & Offline Support", () => {
  it("vérifie que manifest.json est présent, valide et configuré en standalone", () => {
    const manifestPath = path.resolve(process.cwd(), "public/manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    expect(content.name).toContain("Regex Genius");
    expect(content.display).toBe("standalone");
    expect(content.start_url).toBe("./");
    expect(content.icons.length).toBeGreaterThan(0);
  });

  it("vérifie que le Service Worker sw.js gère le cache et les requêtes offline", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf8");
    expect(swContent).toContain("CACHE_NAME");
    expect(swContent).toContain("addEventListener(\"install\"");
    expect(swContent).toContain("addEventListener(\"activate\"");
    expect(swContent).toContain("addEventListener(\"fetch\"");
    expect(swContent).toContain("caches.match");
  });

  it("vérifie la présence de l'icône vectorielle PWA icon.svg", () => {
    const iconPath = path.resolve(process.cwd(), "public/icon.svg");
    expect(fs.existsSync(iconPath)).toBe(true);
    const iconContent = fs.readFileSync(iconPath, "utf8");
    expect(iconContent).toContain("<svg");
  });
});
