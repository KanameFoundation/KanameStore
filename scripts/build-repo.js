const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const archiver = require("archiver");

const APPS_DIR = path.join(__dirname, "../apps");
const DIST_DIR = path.join(__dirname, "../dist");
const REPO_FILE = path.join(DIST_DIR, "repository.json");

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR);
}

const repository = {
  generatedAt: new Date().toISOString(),
  apps: [],
};

async function buildApp(appName) {
  const appPath = path.join(APPS_DIR, appName);
  const pkgPath = path.join(appPath, "package.json");

  if (!fs.existsSync(pkgPath)) return;

  const pkg = require(pkgPath);
  console.log(`Building ${pkg.name} v${pkg.version}...`);

  try {
    console.log(`  -> Installing dependencies for ${appName}...`);
    execSync("npm install", { cwd: appPath, stdio: "inherit" });
    console.log(`  -> Building ${appName}...`);
    execSync("npm run build", { cwd: appPath, stdio: "inherit" });
  } catch (error) {
    console.error(`  -> Failed to build ${appName}:`, error.message);
    return;
  }

  const zipName = `${pkg.name}-${pkg.version}.wpk`;
  const zipPath = path.join(DIST_DIR, zipName);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      console.log(`  -> Created ${zipName} (${archive.pointer()} bytes)`);

      repository.apps.push({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        category: pkg.kaname?.category || "Uncategorized",
        download: zipName,
        icon: pkg.kaname?.icon,
      });
      resolve();
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // Explicitly add dist folder
    if (fs.existsSync(path.join(appPath, "dist"))) {
      archive.directory(path.join(appPath, "dist"), "dist");
    }

    // Add other files
    archive.glob("**/*", {
      cwd: appPath,
      ignore: [
        "node_modules/**",
        ".git/**",
        "src/**",
        "rspack.config.js",
        "dist/**", // Exclude dist here to avoid duplicates/issues
      ],
    });

    archive.finalize();
  });
}

async function main() {
  if (fs.existsSync(APPS_DIR)) {
    const apps = fs.readdirSync(APPS_DIR);
    for (const app of apps) {
      if (fs.statSync(path.join(APPS_DIR, app)).isDirectory()) {
        await buildApp(app);
      }
    }
  }
  fs.writeFileSync(REPO_FILE, JSON.stringify(repository, null, 2));
  console.log("Repository index generated.");
}

main().catch(console.error);
