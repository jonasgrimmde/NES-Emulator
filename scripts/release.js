const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const packagePath = path.join(rootDir, "package.json");
const lockPath = path.join(rootDir, "package-lock.json");
const apiVersion = "2026-03-10";
const useColor = process.stdout.isTTY || process.env.FORCE_COLOR;
const colorCodes = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function color(name, value) {
  if (!useColor) {
    return String(value);
  }
  return `${colorCodes[name]}${value}${colorCodes.reset}`;
}

function formatDuration(startedAt) {
  const seconds = (Date.now() - startedAt) / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1)}s`
    : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function logHeader(text) {
  console.log("");
  console.log(color("bold", color("cyan", `== ${text} ==`)));
}

function logStep(text) {
  console.log(`${color("blue", ">")} ${text}`);
}

function logSuccess(text) {
  console.log(`${color("green", "OK")} ${text}`);
}

function logInfo(label, value) {
  console.log(`${color("dim", label.padEnd(14))} ${value}`);
}

function logProgress(label, current, total, lastText) {
  const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const barWidth = 24;
  const filled = Math.round((percent / 100) * barWidth);
  const bar = `${"#".repeat(filled)}${"-".repeat(barWidth - filled)}`;
  const text = `${label} ${color("cyan", `[${bar}]`)} ${percent.toFixed(1).padStart(5)}% ${formatBytes(current)} / ${formatBytes(total)}`;
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${text}`);
    return text;
  }
  if (text !== lastText) {
    console.log(text);
  }
  return text;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
function commandForSpawn(command) {
  if (process.platform !== "win32") return command;
  if (command === "npm" || command === "npx") {
    return `${command}.cmd`;
  }
  return command;
}
function run(command, args, options = {}) {
  const startedAt = Date.now();
  logStep(`${command} ${args.join(" ")}`);
  const result = spawnSync(commandForSpawn(command), args, {
    cwd: rootDir,
    stdio: "inherit",
    shell:
      process.platform === "win32" && (command === "npm" || command === "npx"),
    env: Object.assign({}, process.env, options.env || {}),
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
  logSuccess(`${command} finished in ${formatDuration(startedAt)}`);
}

function runCapture(command, args) {
  const result = spawnSync(commandForSpawn(command), args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function runStatus(command, args, options = {}) {
  return spawnSync(commandForSpawn(command), args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    env: Object.assign({}, process.env, options.env || {}),
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    bump: "minor",
    draft: false,
    prerelease: false,
  };
  for (const arg of args) {
    if (arg === "--no-bump") options.bump = "none";
    if (arg === "--patch") options.bump = "patch";
    if (arg === "--minor") options.bump = "minor";
    if (arg === "--major") options.bump = "major";
    if (arg === "--draft") options.draft = true;
    if (arg === "--prerelease") options.prerelease = true;
    if (arg.startsWith("--version="))
      options.version = arg.slice("--version=".length);
  }
  return options;
}

function bumpVersion(version, bump) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Version ${version} does not match the 26.x.x schema.`);
  }
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (major !== 26) {
    major = 26;
    minor = 1;
    patch = 0;
  } else if (bump === "major") {
    minor += 1;
    patch = 0;
  } else if (bump === "minor") {
    minor += 1;
    patch = 0;
  } else if (bump === "patch") {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function updatePackageVersion(version) {
  const pkg = readJson(packagePath);
  pkg.version = version;
  writeJson(packagePath, pkg);

  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    lock.version = version;
    if (lock.packages && lock.packages[""]) {
      lock.packages[""].version = version;
    }
    writeJson(lockPath, lock);
  }
}

function fileHash(filePath, algorithm) {
  return crypto
    .createHash(algorithm)
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function fileHashBase64(filePath, algorithm) {
  return crypto
    .createHash(algorithm)
    .update(fs.readFileSync(filePath))
    .digest("base64");
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function createLatestManifest({ pkg, setupPath, version, owner, repo }) {
  const setupName = path.basename(setupPath);
  const tag = `v${version}`;
  const releaseDate = new Date().toISOString();
  const downloadUrl = `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(setupName)}`;
  const size = fs.statSync(setupPath).size;
  const sha256 = fileHash(setupPath, "sha256");
  const sha512 = fileHashBase64(setupPath, "sha512");
  const manifest = [
    `version: ${yamlQuote(version)}`,
    `releaseDate: ${yamlQuote(releaseDate)}`,
    `repo: ${yamlQuote(`${owner}/${repo}`)}`,
    `path: ${yamlQuote(setupName)}`,
    `url: ${yamlQuote(downloadUrl)}`,
    `sha256: ${yamlQuote(sha256)}`,
    `sha512: ${yamlQuote(sha512)}`,
    `size: ${size}`,
    `productName: ${yamlQuote(pkg.build && pkg.build.productName ? pkg.build.productName : "NES Emulator")}`,
    "",
  ].join("\n");
  const manifestPath = path.join(rootDir, "dist", "installer", "latest.yml");
  fs.writeFileSync(manifestPath, manifest, "utf8");
  return {
    manifestPath,
    setupName,
    tag,
    downloadUrl,
    sha256,
    sha512,
    size,
    releaseDate,
  };
}

function createInstallerUploadCopy(setupPath) {
  const uploadPath = path.join(
    rootDir,
    "dist",
    "installer",
    "NES-Emulator-Windows-Setup.exe",
  );

  fs.rmSync(uploadPath, { force: true });
  fs.copyFileSync(setupPath, uploadPath);

  logSuccess(`Created upload installer ${path.relative(rootDir, uploadPath)}`);
  logInfo(
    "Installer",
    `${path.relative(rootDir, uploadPath)} (${formatBytes(fs.statSync(uploadPath).size)})`,
  );

  return uploadPath;
}
function find7Zip() {
  const candidates = [
    "7z",
    "7z.exe",
    path.join(process.env.ProgramFiles || "", "7-Zip", "7z.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "7-Zip", "7z.exe"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["i"], {
      encoding: "utf8",
      shell: candidate === "7z" || candidate === "7z.exe",
    });

    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function createPortableArchive() {
  logHeader("Portable archive");

  const unpackedPath = path.join(rootDir, "dist", "win-unpacked");
  const archivePath = path.join(
    rootDir,
    "dist",
    "installer",
    "NES-Emulator-Windows.7z",
  );

  if (!fs.existsSync(unpackedPath)) {
    throw new Error(`Unpacked app folder not found: ${unpackedPath}`);
  }

  fs.rmSync(archivePath, { force: true });

  const sevenZip = find7Zip();
  if (!sevenZip) {
    throw new Error(
      "7-Zip was not found. Install 7-Zip or add 7z.exe to PATH.",
    );
  }

  const startedAt = Date.now();
  logStep(`Create ${path.relative(rootDir, archivePath)}`);

  const result = spawnSync(sevenZip, ["a", "-t7z", "-mx=5", archivePath, "."], {
    cwd: unpackedPath,
    stdio: "inherit",
    shell: sevenZip === "7z" || sevenZip === "7z.exe",
  });

  if (result.status !== 0) {
    throw new Error("Creating portable 7z archive failed.");
  }

  logSuccess(
    `Created ${path.relative(rootDir, archivePath)} in ${formatDuration(startedAt)}`,
  );
  logInfo(
    "Portable",
    `${path.relative(rootDir, archivePath)} (${formatBytes(fs.statSync(archivePath).size)})`,
  );

  return archivePath;
}
function getGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  return runCapture("gh", ["auth", "token"]);
}

async function githubRequest(token, url, options = {}) {
  const headers = Object.assign(
    {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": apiVersion,
      "User-Agent": "nes-emulator-release-script",
    },
    options.headers || {},
  );
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, Object.assign({}, options, { headers }));
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function getOrCreateRelease({
  token,
  owner,
  repo,
  tag,
  version,
  draft,
  prerelease,
}) {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    return await githubRequest(
      token,
      `${apiBase}/releases/tags/${encodeURIComponent(tag)}`,
    );
  } catch (error) {
    if (error.status !== 404) {
      throw error;
    }
  }

  return githubRequest(token, `${apiBase}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      name: `NES Emulator ${version}`,
      body: `Automated release for NES Emulator ${version}.`,
      draft,
      prerelease,
    }),
  });
}

async function deleteExistingAsset(token, release, assetName) {
  const asset = (release.assets || []).find(
    (entry) => entry.name === assetName,
  );
  if (!asset) {
    return;
  }
  logStep(`Delete existing asset ${assetName}`);
  await githubRequest(token, asset.url, { method: "DELETE" });
  logSuccess(`Deleted ${assetName}`);
}

async function uploadAsset(token, release, filePath, contentType) {
  const assetName = path.basename(filePath);
  await deleteExistingAsset(token, release, assetName);
  const uploadUrl = release.upload_url.replace(/\{.*$/, "");
  const url = `${uploadUrl}?name=${encodeURIComponent(assetName)}`;
  const size = fs.statSync(filePath).size;
  logStep(`Upload ${assetName} (${formatBytes(size)})`);
  const startedAt = Date.now();
  const data = await uploadAssetWithProgress({
    token,
    url,
    filePath,
    contentType,
    label: `Upload ${assetName}`,
    size,
  });
  if (process.stdout.isTTY) {
    process.stdout.write("\n");
  }
  logSuccess(`Uploaded ${assetName} in ${formatDuration(startedAt)}`);
  return data;
}

function commitVersionFiles(version) {
  logHeader("Git commit");
  const insideGit = runStatus("git", ["rev-parse", "--is-inside-work-tree"]);
  if (insideGit.status !== 0) {
    logStep("Skip commit because this folder is not a Git repository.");
    return;
  }

  const unstagedChanges = runStatus("git", [
    "diff",
    "--quiet",
    "--",
    "package.json",
    "package-lock.json",
  ]);
  const stagedChanges = runStatus("git", [
    "diff",
    "--cached",
    "--quiet",
    "--",
    "package.json",
    "package-lock.json",
  ]);
  const untrackedFiles = runCapture("git", [
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "package.json",
    "package-lock.json",
  ]);
  if (
    unstagedChanges.status === 0 &&
    stagedChanges.status === 0 &&
    !untrackedFiles
  ) {
    logStep(
      "Skip commit because package.json and package-lock.json did not change.",
    );
    return;
  }

  const addResult = runStatus("git", [
    "add",
    "--",
    "package.json",
    "package-lock.json",
  ]);
  if (addResult.status !== 0) {
    const details = (addResult.stderr || addResult.stdout || "").trim();
    throw new Error(`Git add failed.${details ? ` ${details}` : ""}`);
  }

  logStep("Commit package.json and package-lock.json");
  const result = runStatus("git", [
    "commit",
    "--only",
    "package.json",
    "package-lock.json",
    "-m",
    `chore: release ${version}`,
  ]);
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(`Git commit failed.${details ? ` ${details}` : ""}`);
  }
  logSuccess(`Committed version files for ${version}`);
}

function uploadAssetWithProgress({
  token,
  url,
  filePath,
  contentType,
  label,
  size,
}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const request = https.request(
      {
        method: "POST",
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": contentType,
          "Content-Length": String(size),
          "X-GitHub-Api-Version": apiVersion,
          "User-Agent": "nes-emulator-release-script",
        },
      },
      (response) => {
        let responseText = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseText += chunk;
        });
        response.on("end", () => {
          let data = null;
          if (responseText) {
            try {
              data = JSON.parse(responseText);
            } catch (error) {
              reject(
                new Error(
                  `GitHub returned invalid JSON while uploading ${path.basename(filePath)}.`,
                ),
              );
              return;
            }
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            const message =
              data && data.message ? data.message : response.statusMessage;
            reject(
              new Error(
                `Upload ${path.basename(filePath)} failed: ${response.statusCode} ${message}`,
              ),
            );
            return;
          }
          resolve(data);
        });
      },
    );

    request.on("error", reject);

    let uploaded = 0;
    let lastProgressAt = 0;
    let lastText = "";
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      uploaded += chunk.length;
      const now = Date.now();
      if (now - lastProgressAt > 150 || uploaded === size) {
        lastText = logProgress(label, uploaded, size, lastText);
        lastProgressAt = now;
      }
    });
    stream.on("error", reject);
    stream.pipe(request);
  });
}

async function main() {
  const releaseStartedAt = Date.now();
  logHeader("NES Emulator release");
  const options = parseArgs();
  const pkgBefore = readJson(packagePath);
  const owner =
    process.env.GITHUB_OWNER || (pkgBefore.release && pkgBefore.release.owner);
  const repo =
    process.env.GITHUB_REPO || (pkgBefore.release && pkgBefore.release.repo);
  if (!owner || !repo) {
    throw new Error("Missing release.owner/release.repo in package.json.");
  }

  const nextVersion =
    options.version || bumpVersion(pkgBefore.version, options.bump);
  logInfo("Repository", `${owner}/${repo}`);
  logInfo("Version", `${pkgBefore.version} -> ${nextVersion}`);
  logInfo(
    "Mode",
    `${options.draft ? "draft" : "published"}${options.prerelease ? ", prerelease" : ""}`,
  );

  logHeader("Prepare files");
  logStep("Update package version");
  updatePackageVersion(nextVersion);
  logSuccess(`package.json/package-lock.json set to ${nextVersion}`);
  const pkg = readJson(packagePath);

  logHeader("Build");
  run("npm", ["run", "clean"]);
  run("npm", ["run", "pack"]);
  run("npm", ["run", "setup"]);

  const portablePath = createPortableArchive();

  const setupPath = path.join(
    rootDir,
    "dist",
    "installer",
    `NES-Emulator-Setup-${nextVersion}.exe`,
  );
  if (!fs.existsSync(setupPath)) {
    throw new Error(`Setup file not found: ${setupPath}`);
  }
  logInfo(
    "Setup",
    `${path.relative(rootDir, setupPath)} (${formatBytes(fs.statSync(setupPath).size)})`,
  );

  const setupUploadPath = createInstallerUploadCopy(setupPath);

  logHeader("Manifest");
  const manifest = createLatestManifest({
    pkg,
    setupPath: setupUploadPath,
    version: nextVersion,
    owner,
    repo,
  });
  logSuccess(`Created ${path.relative(rootDir, manifest.manifestPath)}`);
  logInfo("SHA256", manifest.sha256);

  logHeader("GitHub");
  logStep("Resolve GitHub token");
  const token = getGitHubToken();
  if (!token) {
    throw new Error(
      "GitHub auth missing. Run `gh auth login` once, or set GH_TOKEN/GITHUB_TOKEN.",
    );
  }
  logSuccess("GitHub auth available");

  logStep(`Create or reuse release ${manifest.tag}`);
  const release = await getOrCreateRelease({
    token,
    owner,
    repo,
    tag: manifest.tag,
    version: nextVersion,
    draft: options.draft,
    prerelease: options.prerelease,
  });
  logSuccess(`Release ready: ${release.html_url || manifest.tag}`);

  await uploadAsset(
    token,
    release,
    setupUploadPath,
    "application/vnd.microsoft.portable-executable",
  );
  await uploadAsset(
    token,
    release,
    portablePath,
    "application/x-7z-compressed",
  );
  await uploadAsset(
    token,
    release,
    manifest.manifestPath,
    "application/x-yaml",
  );

  commitVersionFiles(nextVersion);

  logHeader("Done");
  console.log("");
  logSuccess(
    `Released NES Emulator ${nextVersion} in ${formatDuration(releaseStartedAt)}`,
  );
  logInfo("Tag", manifest.tag);
  logInfo("Setup", manifest.setupName);
  logInfo("Portable", path.basename(portablePath));
  logInfo("SHA256", manifest.sha256);
}

main().catch((error) => {
  console.error("");
  console.error(`${color("red", "FAILED")} ${error.message || error}`);
  process.exit(1);
});
