const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const archiver = require("archiver");

const APPS_DIR = path.join(__dirname, "../apps");
const DIST_DIR = path.join(__dirname, "../dist");
const REPO_FILE = path.join(DIST_DIR, "repository.json");

const ICONS_DIR = path.join(DIST_DIR, "icons");

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR);
}
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR);
}

const repository = {
  generatedAt: new Date().toISOString(),
  apps: [],
};

async function buildApp(appName) {
  const appPath = path.join(APPS_DIR, appName);
  const pkgPath = path.join(appPath, "package.json");
  const metadataPath = path.join(appPath, "metadata.json");

  if (!fs.existsSync(pkgPath)) return;

  const pkg = require(pkgPath);
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = require(metadataPath);
    } catch (e) {
      console.warn(`Failed to read metadata for ${appName}`);
    }
  }

  // Display name from metadata, ID from package.json
  const displayName = metadata.name || pkg.name;

  console.log(`Building ${displayName} (${pkg.name}) v${metadata.version}...`);

  // Handle Icon
  let iconPath = null;
  const iconSource =
    pkg.kaname?.icon ||
    metadata.icon ||
    (pkg.kaname && pkg.kaname.icon)

  // Try to find the icon file
  const possibleIconPaths = [
    path.join(appPath, iconSource),
    path.join(appPath, iconSource + ".png"),
    path.join(appPath, "icon.png"),
  ];

  let foundIcon = null;
  for (const p of possibleIconPaths) {
    if (fs.existsSync(p)) {
      foundIcon = p;
      break;
    }
  }

  if (foundIcon) {
    const iconExt = path.extname(foundIcon);
    const iconDestName = `${pkg.name}${iconExt}`;
    fs.copyFileSync(foundIcon, path.join(ICONS_DIR, iconDestName));
    iconPath = `icons/${iconDestName}`;
  }

  // Determine Title
  const title =
    (metadata.title && metadata.title.en_EN) ||
    metadata.name ||
    pkg.kaname?.title ||
    pkg.description ||
    pkg.name;

  try {
    console.log(`  -> Installing dependencies for ${appName}...`);
    execSync("npm install", { cwd: appPath, stdio: "inherit" });
    console.log(`  -> Building ${appName}...`);
    execSync("npm run build", { cwd: appPath, stdio: "inherit" });
  } catch (error) {
    console.error(`  -> Failed to build ${appName}:`, error.message);
    return;
  }

  const zipName = `${pkg.name}-${metadata.version}.wpk`;
  const zipPath = path.join(DIST_DIR, zipName);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on("close", () => {
      console.log(`  -> Created ${zipName} (${archive.pointer()} bytes)`);

      repository.apps.push({
        name: metadata.name || pkg.name, // ID from metadata.json (matches OS registration)
        title: title, // Display name from metadata
        version: metadata.version,
        description: pkg.description,
        category: pkg.kaname?.category || metadata.category || "Uncategorized",
        download: zipName,
        icon: iconPath,
        iconName: metadata.icon || pkg.kaname?.icon,
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
  // Get app names from command line arguments
  const appsToBuild = process.argv.slice(2);

  if (appsToBuild.length > 0) {
    // Build only specified apps
    console.log(`Building specific apps: ${appsToBuild.join(", ")}`);
    for (const app of appsToBuild) {
      const appPath = path.join(APPS_DIR, app);
      if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
        await buildApp(app);
      } else {
        console.warn(`⚠ App '${app}' not found in ${APPS_DIR}`);
      }
    }

    // Load existing repository.json if it exists
    if (fs.existsSync(REPO_FILE)) {
      const existingRepo = JSON.parse(fs.readFileSync(REPO_FILE, "utf-8"));
      // Keep apps that weren't rebuilt
      const builtAppNames = repository.apps.map((a) => a.name);
      const unchangedApps = existingRepo.apps.filter(
        (a) => !builtAppNames.includes(a.name)
      );
      repository.apps = [...unchangedApps, ...repository.apps];
    }
  } else {
    // Build all apps (default behavior)
    console.log("Building all apps...");
    if (fs.existsSync(APPS_DIR)) {
      const apps = fs.readdirSync(APPS_DIR);
      for (const app of apps) {
        if (fs.statSync(path.join(APPS_DIR, app)).isDirectory()) {
          await buildApp(app);
        }
      }
    }
  }

  fs.writeFileSync(REPO_FILE, JSON.stringify(repository, null, 2));
  console.log(
    `✓ Repository index generated with ${repository.apps.length} app(s).`
  );
}

main().catch(console.error);
