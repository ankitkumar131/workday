import { build } from "esbuild";
import fs from "fs";
import path from "path";

async function buildExtensionScripts() {
  const distDir = path.resolve("dist");
  fs.mkdirSync(distDir, { recursive: true });

  // Bundle Manifest V3 background service worker
  await build({
    entryPoints: ["src/background/service-worker.ts"],
    bundle: true,
    outfile: "dist/service-worker.js",
    format: "esm",
    target: "es2022",
    platform: "browser",
    sourcemap: false,
  });

  // Bundle Manifest V3 content script as self-contained IIFE
  await build({
    entryPoints: ["src/content/content-script.ts"],
    bundle: true,
    outfile: "dist/content-script.js",
    format: "iife",
    target: "es2022",
    platform: "browser",
    sourcemap: false,
  });

  // Copy manifest.json into dist/
  fs.copyFileSync(
    path.resolve("manifest.json"),
    path.resolve("dist/manifest.json")
  );

  // Ensure icons exist in dist/icons/
  const srcIcons = path.resolve("public/icons");
  const destIcons = path.resolve("dist/icons");
  if (fs.existsSync(srcIcons)) {
    fs.mkdirSync(destIcons, { recursive: true });
    for (const file of fs.readdirSync(srcIcons)) {
      fs.copyFileSync(path.join(srcIcons, file), path.join(destIcons, file));
    }
  }

  console.log("Successfully built extension scripts and manifest in dist/");
}

buildExtensionScripts().catch((err) => {
  console.error("Failed to build extension scripts:", err);
  process.exit(1);
});
