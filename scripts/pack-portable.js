const path = require("path");
const packager = require("electron-packager");

function shouldIgnore(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/");
  return (
    normalized.includes("/.git/") ||
    normalized.includes("/.vscode/") ||
    normalized.includes("/release/") ||
    normalized.includes("/data/") ||
    normalized.includes("/node_modules/.cache/")
  );
}

(async () => {
  const rootDir = path.resolve(__dirname, "..");
  const outputDir = path.join(rootDir, "release");

  const appPaths = await packager({
    dir: rootDir,
    out: outputDir,
    overwrite: true,
    platform: "win32",
    arch: "x64",
    name: "Pingle",
    prune: true,
    ignore: shouldIgnore,
  });

  console.log("Portable build created:");
  appPaths.forEach((item) => console.log(item));
})();
