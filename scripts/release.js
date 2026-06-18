const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const packagePath = path.join(rootDir, "package.json");
const lockPath = path.join(rootDir, "package-lock.json");
const apiVersion = "2026-03-10";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: Object.assign({}, process.env, options.env || {}),
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    bump: "patch",
    draft: false,
    prerelease: false,
  };
  for (const arg of args) {
    if (arg === "--no-bump") options.bump = "none";
    if (arg === "--minor") options.bump = "minor";
    if (arg === "--major") options.bump = "major";
    if (arg === "--draft") options.draft = true;
    if (arg === "--prerelease") options.prerelease = true;
    if (arg.startsWith("--version=")) options.version = arg.slice("--version=".length);
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
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("hex");
}

function fileHashBase64(filePath, algorithm) {
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest("base64");
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
    `minimumVersion: ${yamlQuote("26.1.0")}`,
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

function getGitHubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  return runCapture("gh", ["auth", "token"]);
}

async function githubRequest(token, url, options = {}) {
  const headers = Object.assign({
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": apiVersion,
    "User-Agent": "nes-emulator-release-script",
  }, options.headers || {});
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

async function getOrCreateRelease({ token, owner, repo, tag, version, draft, prerelease }) {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    return await githubRequest(token, `${apiBase}/releases/tags/${encodeURIComponent(tag)}`);
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
  const asset = (release.assets || []).find((entry) => entry.name === assetName);
  if (!asset) {
    return;
  }
  await githubRequest(token, asset.url, { method: "DELETE" });
}

async function uploadAsset(token, release, filePath, contentType) {
  const assetName = path.basename(filePath);
  await deleteExistingAsset(token, release, assetName);
  const uploadUrl = release.upload_url.replace(/\{.*$/, "");
  const url = `${uploadUrl}?name=${encodeURIComponent(assetName)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": contentType,
      "Content-Length": String(fs.statSync(filePath).size),
      "X-GitHub-Api-Version": apiVersion,
      "User-Agent": "nes-emulator-release-script",
    },
    body: fs.readFileSync(filePath),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    throw new Error(`Upload ${assetName} failed: ${response.status} ${message}`);
  }
  return data;
}

async function main() {
  const options = parseArgs();
  const pkgBefore = readJson(packagePath);
  const owner = process.env.GITHUB_OWNER || (pkgBefore.release && pkgBefore.release.owner);
  const repo = process.env.GITHUB_REPO || (pkgBefore.release && pkgBefore.release.repo);
  if (!owner || !repo) {
    throw new Error("Missing release.owner/release.repo in package.json.");
  }

  const nextVersion = options.version || bumpVersion(pkgBefore.version, options.bump);
  updatePackageVersion(nextVersion);
  const pkg = readJson(packagePath);

  run("npm", ["run", "clean"]);
  run("npm", ["run", "pack"]);
  run("npm", ["run", "setup"]);

  const setupPath = path.join(rootDir, "dist", "installer", `NES-Emulator-Setup-${nextVersion}.exe`);
  if (!fs.existsSync(setupPath)) {
    throw new Error(`Setup file not found: ${setupPath}`);
  }

  const manifest = createLatestManifest({
    pkg,
    setupPath,
    version: nextVersion,
    owner,
    repo,
  });

  const token = getGitHubToken();
  if (!token) {
    throw new Error("GitHub auth missing. Run `gh auth login` once, or set GH_TOKEN/GITHUB_TOKEN.");
  }

  const release = await getOrCreateRelease({
    token,
    owner,
    repo,
    tag: manifest.tag,
    version: nextVersion,
    draft: options.draft,
    prerelease: options.prerelease,
  });

  await uploadAsset(token, release, setupPath, "application/vnd.microsoft.portable-executable");
  await uploadAsset(token, release, manifest.manifestPath, "application/x-yaml");

  console.log("");
  console.log(`Released NES Emulator ${nextVersion}`);
  console.log(`Tag: ${manifest.tag}`);
  console.log(`Setup: ${manifest.setupName}`);
  console.log(`SHA256: ${manifest.sha256}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
