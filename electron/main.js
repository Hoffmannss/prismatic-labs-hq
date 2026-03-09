const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');

// ============================================
// CONFIGURAÇÕES
// ============================================
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 3456;

let mainWindow;
let splashWindow;
let backendProcess;
let tray;

// ============================================
// SPLASH SCREEN
// ============================================
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// ============================================
// JANELA PRINCIPAL
// ============================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Vendedor IA — Prismatic Labs'
  });

  waitForBackend().then(() => {
    mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    
    mainWindow.once('ready-to-show', () => {
      if (splashWindow) {
        splashWindow.destroy();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'win32') {
        new Notification({
          title: 'Vendedor IA',
          body: 'App minimizado na bandeja. Clique no ícone para abrir.',
          silent: true
        }).show();
      }
    }
  });
}

// ============================================
// BACKEND
// ============================================
function startBackend() {
  const backendScript = path.join(__dirname, '../src/services/dashboard-api.js');
  
  backendProcess = spawn('node', [backendScript], {
    env: { ...process.env, PORT: BACKEND_PORT },
    stdio: isDev ? 'inherit' : 'pipe'
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Backend error:', err);
  });

  backendProcess.on('exit', (code) => {
    if (code !== 0 && !app.isQuitting) {
      console.error(`❌ Backend crashed (code ${code}). Restarting...`);
      setTimeout(startBackend, 2000);
    }
  });
}

async function waitForBackend(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${BACKEND_PORT}/api/stats`);
      if (res.ok) return;
    } catch (e) {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Backend não iniciou em 15s');
}

// ============================================
// SYSTEM TRAY
// ============================================
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '📊 Abrir Dashboard', 
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    { 
      label: '🚀 Disparar Autopilot', 
      click: () => mainWindow.webContents.send('trigger-autopilot')
    },
    { type: 'separator' },
    { 
      label: '🔄 Reiniciar App', 
      click: () => {
        app.relaunch();
        app.exit();
      }
    },
    { 
      label: '❌ Sair', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Vendedor IA — Rodando');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ============================================
// AUTO-UPDATE
// ============================================
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Checa updates a cada 10min
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 600000);

  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checando atualizações...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update disponível:', info.version);
    mainWindow.webContents.send('update-status', {
      type: 'downloading',
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✅ App atualizado');
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    mainWindow.webContents.send('update-progress', percent);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update baixado:', info.version);
    
    mainWindow.webContents.send('update-status', {
      type: 'ready',
      version: info.version
    });

    new Notification({
      title: 'Atualização Pronta',
      body: `Versão ${info.version} será instalada ao fechar o app.`,
      silent: false
    }).show();
  });

  autoUpdater.on('error', (err) => {
    console.error('❌ Erro no auto-update:', err);
  });
}

// ============================================
// IPC HANDLERS
// ============================================
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
ipcMain.handle('minimize-to-tray', () => mainWindow.hide());
ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit();
});

// ============================================
// LIFECYCLE
// ============================================
app.whenReady().then(() => {
  createSplash();
  createTray();
  startBackend();
  createMainWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) backendProcess.kill();
});

// Previne múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}