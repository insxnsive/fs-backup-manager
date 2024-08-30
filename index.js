const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const readline = require("readline");

const backupDir =
  "C:\\Users\\insxn\\OneDrive\\Documentos\\Bots\\fs-backup\\Backup";
const configFile = "config.json";

let isBackupManagerActive = false;

async function initializeConfig() {
  await fs.mkdir(backupDir, { recursive: true });
  try {
    return JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch {
    const initialConfig = { directories: [] };
    await fs.writeFile(configFile, JSON.stringify(initialConfig));
    return initialConfig;
  }
}

async function backupFile(sourceDir, filename) {
  const sourcePath = path.join(sourceDir, filename);
  const backupPath = path.join(
    backupDir,
    `${path.basename(sourceDir)}_${filename}`,
  );
  try {
    await fs.access(sourcePath, fs.constants.F_OK);
    await fs.copyFile(sourcePath, backupPath);
    console.log(`Backed up file: ${filename} from ${sourceDir}`);
  } catch {
    console.log(
      `File ${filename} in ${sourceDir} no longer exists or couldn't be backed up.`,
    );
  }
}

async function backupAllFiles(sourceDir) {
  try {
    const files = await fs.readdir(sourceDir);
    await Promise.all(files.map((file) => backupFile(sourceDir, file)));
  } catch (error) {
    console.log(`Error backing up files in ${sourceDir}: ${error.message}`);
  }
}

function watchDirectory(sourceDir) {
  backupAllFiles(sourceDir);
  fsSync.watch(
    sourceDir,
    { persistent: true },
    (_, filename) => filename && backupFile(sourceDir, filename),
  );
  console.log(`Monitoring directory: ${sourceDir}`);
}

async function addDirectory(config) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const dir = await new Promise((resolve) =>
    rl.question("Enter the directory path to add: ", resolve),
  );
  rl.close();

  const dirExists = await fs
    .access(dir)
    .then(() => true)
    .catch(() => false);
  if (!dirExists) {
    console.log("Directory does not exist.");
    return showMenu(config);
  }

  if (config.directories.includes(dir)) {
    console.log("Directory is already being monitored.");
    return showMenu(config);
  }

  config.directories.push(dir);
  await fs.writeFile(configFile, JSON.stringify(config, null, 2));
  console.log(`Added directory: ${dir}`);
  isBackupManagerActive && watchDirectory(dir);
  showMenu(config);
}

function activateBackupManager(config) {
  console.log(
    isBackupManagerActive
      ? "Backup manager is already active. Refreshing monitored directories."
      : "Your backup manager is now active and functioning!",
  );
  isBackupManagerActive = true;
  config.directories.forEach(watchDirectory);
  showMenu(config);
}

function showMenu(config) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question(
    `Choose an action:
    (1) Activate backup manager,
    (2) Add new directory,
    (3) Exit:
   `,
    (answer) => {
      rl.close();
      const actions = {
        1: () => activateBackupManager(config),
        2: () => addDirectory(config),
        3: () => {
          console.log("Exiting backup manager...");
          process.exit(0);
        },
      };
      (
        actions[answer] ||
        (() => {
          console.log("Invalid choice. Please try again.");
          showMenu(config);
        })
      )();
    },
  );
}

process.on("SIGINT", () => {
  console.log("\nBackup manager is shutting down...");
  process.exit();
});

console.log("Welcome to the Backup Manager!");
initializeConfig().then(showMenu);
