const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");

const backupDir = "D:\\Bots\\Backups from Backup Bot";
const configFile = "config.json";
const cacheFile = "backup_cache.json";

let fileCache = {};
let cacheModified = false;

async function loadCache() {
  try {
    const cacheData = await fs.readFile(cacheFile, "utf8");
    fileCache = JSON.parse(cacheData);
    console.log("Cache loaded successfully.");
    console.log(`Cache contains ${Object.keys(fileCache).length} entries.`);
  } catch (error) {
    console.log(
      "No cache file found or error reading cache. Creating a new one.",
    );
    fileCache = {};
  }
}

async function saveCache() {
  if (cacheModified) {
    await fs.writeFile(cacheFile, JSON.stringify(fileCache, null, 2));
    cacheModified = false;
    console.log("Cache saved successfully.");
    console.log(`Cache now contains ${Object.keys(fileCache).length} entries.`);
  }
}

async function initializeConfig() {
  await fs.mkdir(backupDir, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch {
    console.log(
      "Config file not found. Please create a config.json file with a 'directories' array.",
    );
    process.exit(1);
  }
}

async function backupItem(sourcePath, backupBasePath, sourceRootDir) {
  const relativePath = path.relative(sourceRootDir, sourcePath);
  const backupPath = path.join(backupBasePath, relativePath);

  if (path.basename(sourcePath) === path.basename(cacheFile)) {
    return;
  }

  try {
    const sourceStats = await fs.stat(sourcePath);

    if (sourceStats.isDirectory()) {
      await fs.mkdir(backupPath, { recursive: true });
      const items = await fs.readdir(sourcePath);
      for (const item of items) {
        await backupItem(
          path.join(sourcePath, item),
          backupBasePath,
          sourceRootDir,
        );
      }
    } else {
      if (!fileCache[sourcePath]) {
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.copyFile(sourcePath, backupPath);
        console.log(`Backed up new file: ${relativePath}`);
        fileCache[sourcePath] = sourceStats.mtime.getTime();
        cacheModified = true;
      } else {
        console.log(`File already backed up (skipped): ${relativePath}`);
      }
    }
  } catch (error) {
    console.log(`Error processing ${relativePath}: ${error.message}`);
  }
}

async function backupAllItems(sourceDir) {
  const backupBasePath = path.join(backupDir, path.basename(sourceDir));
  await fs.mkdir(backupBasePath, { recursive: true });
  await backupItem(sourceDir, backupBasePath, sourceDir);
  await saveCache();
}

function watchDirectory(sourceDir) {
  backupAllItems(sourceDir);
  fsSync.watch(sourceDir, { recursive: true }, (eventType, filename) => {
    if (filename && path.basename(filename) !== path.basename(cacheFile)) {
      const fullPath = path.join(sourceDir, filename);
      const backupBasePath = path.join(backupDir, path.basename(sourceDir));
      backupItem(fullPath, backupBasePath, sourceDir).then(saveCache);
    }
  });
  console.log(`Monitoring directory: ${sourceDir}`);
}

async function startBackupManager() {
  console.log("Starting Backup Manager...");
  await loadCache();
  const config = await initializeConfig();

  if (!config.directories || config.directories.length === 0) {
    console.log(
      "No directories configured for backup. Please add directories to config.json.",
    );
    process.exit(1);
  }

  config.directories.forEach(watchDirectory);
  console.log("Backup Manager is now active and functioning!");
}

process.on("SIGINT", async () => {
  console.log("\nBackup manager is shutting down...");
  await saveCache();
  process.exit();
});

startBackupManager();
