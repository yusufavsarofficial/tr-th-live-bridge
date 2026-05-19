const fs = require("fs");
const path = require("path");
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const { createChatServer } = require(path.join(__dirname, "..", "server.js"));

let chatServer;
let mainWindow;
let shuttingDown = false;

const WINDOW_STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

function loadWindowState() {
  try {
    if (!fs.existsSync(WINDOW_STATE_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(WINDOW_STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveWindowState(windowInstance) {
  try {
    const bounds = windowInstance.getBounds();
    fs.mkdirSync(path.dirname(WINDOW_STATE_FILE), { recursive: true });
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(bounds, null, 2) + "\n", "utf8");
  } catch {}
}

function createMenu() {
  const template = [
    {
      label: "Pingle",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Open Data Folder",
          click: () => {
            shell.openPath(app.getPath("userData"));
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createMainWindow(port) {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width || 1180,
    height: windowState.height || 820,
    x: Number.isFinite(windowState.x) ? windowState.x : undefined,
    y: Number.isFinite(windowState.y) ? windowState.y : undefined,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#0b1828",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on("resize", () => saveWindowState(mainWindow));
  mainWindow.on("move", () => saveWindowState(mainWindow));
}

async function startApp() {
  createMenu();

  const port = Number(process.env.PORT) || 3000;
  const dataFile = path.join(app.getPath("userData"), "data", "chat-history.json");

  chatServer = createChatServer({ port, dataFile });
  await chatServer.start();
  createMainWindow(chatServer.config.port);
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

app.whenReady().then(startApp).catch((error) => {
  dialog.showErrorBox("Pingle Startup Error", error.message);
  app.exit(1);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && chatServer) {
    createMainWindow(chatServer.config.port);
  }
});

app.on("before-quit", (event) => {
  if (!chatServer || shuttingDown) {
    return;
  }

  shuttingDown = true;
  event.preventDefault();

  chatServer
    .stop()
    .catch(() => {})
    .finally(() => {
      chatServer = null;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
