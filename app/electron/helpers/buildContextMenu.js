// electron/helpers/menu.js
const { Menu } = require('electron');

function baseOrigin(win, isDev) {
  try {
    const url = new URL(win.webContents.getURL());
    return isDev ? `http://localhost:3000` : `${url.origin}`;
  } catch {
    return `http://localhost:3000`;
  }
}

function buildAppMenu(win, isDev, modulos = []) {
  const origin = baseOrigin(win, isDev);
  const template = [{
    label: 'Menú',
    submenu: [
      ...modulos.map(m => ({
        label: m.nombre,
        click: () => win && !win.isDestroyed() && win.loadURL(`${origin}${m.link}?modulo=${encodeURIComponent(m.nombre)}`)
      })),
      { type: 'separator' },
      { label: 'Inicio', click: () => win && !win.isDestroyed() && win.loadURL(`${origin}/Index`) },
      { type: 'separator' },
      { label: 'Reload', accelerator: 'F5', click: () => win && !win.isDestroyed() && win.reload() },
      ...(isDev ? [{ label: 'DevTools', accelerator: 'F12', click: () => win && !win.isDestroyed() && win.webContents.toggleDevTools() }] : []),
      { type: 'separator' },
      { role: 'quit', label: 'Salir', accelerator: 'Esc' },
    ],
  }];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function buildContextMenu(win, isDev, modulos = []) {
  const origin = baseOrigin(win, isDev);
  const template = [
    ...modulos.map(m => ({
      label: m.nombre,
      click: () => win && !win.isDestroyed() && win.loadURL(`${origin}${m.link}?modulo=${encodeURIComponent(m.nombre)}`)
    })),
    { type: 'separator' },
    { label: 'Inicio', click: () => win && !win.isDestroyed() && win.loadURL(`${origin}/Index`) },
    { type: 'separator' },
    { label: 'Recargar', click: () => win && !win.isDestroyed() && win.reload() },
    ...(isDev ? [{ label: 'DevTools', click: () => win && !win.isDestroyed() && win.webContents.toggleDevTools() }] : []),
    { type: 'separator' },
    { label: 'Salir', role: 'quit' },
  ];
  return Menu.buildFromTemplate(template);
}

module.exports = { buildAppMenu, buildContextMenu };
