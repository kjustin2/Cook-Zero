const { app, BrowserWindow, shell } = require('electron');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    show: false,
    backgroundColor: '#06070b',
    title: 'Sizzle Rush',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadFile('index.html');

  // Surface renderer load failures in the terminal instead of a silent blank
  // window. Costs nothing when everything works; saves a blind debugging session
  // if a file goes missing or a module throws on load.
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[Sizzle Rush] renderer failed to load: ${desc} (${code}) ${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Sizzle Rush] renderer process gone:', details.reason);
  });
  // Opt-in DevTools for debugging: `SIZZLE_DEV=1 npm start`. Off by default so
  // a normal launch is just the game.
  if (process.env.SIZZLE_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
