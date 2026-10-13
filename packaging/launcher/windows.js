// 设计台 Windows 启动 / 停止：由“启动设计台.bat”“停止设计台.bat”调用。
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = 4180;
const url = `http://127.0.0.1:${port}`;
const data = path.join(os.homedir(), "Documents", "设计台数据");
const pidFile = path.join(data, "运行中.pid");
fs.mkdirSync(data, { recursive: true });

const alive = () => new Promise((resolve) => {
  const request = http.get(url, (response) => { response.resume(); resolve(true); });
  request.on("error", () => resolve(false));
  request.setTimeout(1500, () => { request.destroy(); resolve(false); });
});
const openBrowser = () => {
  const child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => console.log(`请手动在浏览器打开：${url}`));
  child.unref();
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 第一次启动时在桌面放一个“设计台”快捷方式，以后从桌面双击就行。
function desktopShortcut() {
  const target = path.join(root, "启动设计台.bat");
  const script = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\设计台.lnk');$s.TargetPath='${target.replace(/'/g, "''")}';$s.WorkingDirectory='${root.replace(/'/g, "''")}';$s.WindowStyle=7;$s.Save()`;
  execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true }, () => undefined);
}

async function start() {
  if (await alive()) {
    openBrowser();
    console.log("设计台已经在运行，已在浏览器打开。这个窗口可以关掉。");
    return;
  }
  const log = fs.openSync(path.join(data, "运行日志.txt"), "a");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(root, "app"),
    env: { ...process.env, DESIGN_DESK_DATA_DIR: data, PORT: String(port), HOSTNAME: "127.0.0.1" },
    detached: true, stdio: ["ignore", log, log], windowsHide: true,
  });
  fs.writeFileSync(pidFile, String(child.pid));
  child.unref();
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    if (await alive()) {
      openBrowser();
      desktopShortcut();
      console.log(`设计台已启动：${url}`);
      console.log(`数据保存在：${data}`);
      console.log("桌面上已放好“设计台”快捷方式。这个窗口可以关掉，设计台会继续运行。");
      return;
    }
  }
  console.log(`启动失败。请把这个文件截图发给 Claude：${path.join(data, "运行日志.txt")}`);
}

function stop() {
  try {
    const pid = Number(fs.readFileSync(pidFile, "utf8"));
    process.kill(pid);
    fs.rmSync(pidFile, { force: true });
    console.log("设计台已停止。");
  } catch {
    console.log("设计台没有在运行。");
  }
}

process.argv[2] === "stop" ? stop() : start();
