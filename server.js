// backend/server.js
//
// This is the piece that was missing from your setup: a real backend that
// opens an actual SSH session to bandit.labs.overthewire.org and streams
// it to the browser over socket.io. Without this, the frontend can only
// ever fake a shell — it can never really log a student into bandit.
//
// SECURITY NOTE: students type their real OverTheWire password into this
// server. This code does NOT log, store, or persist passwords anywhere —
// they are held only in memory for the lifetime of the socket connection
// and forwarded straight to the SSH library. Do not add logging of the
// `ssh-connect` payload. Always deploy this behind HTTPS/WSS in production
// (Railway does this for you automatically).

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Client } = require('ssh2');

const PORT = process.env.PORT || 3000;

// Set this to your real frontend origin(s) in production, e.g.
// ALLOWED_ORIGINS=https://your-site.com,https://your-site.netlify.app
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim());

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.get('/', (_req, res) => res.send('bandit-terminal backend is running'));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

// Basic per-IP connection limiter so one visitor can't open unlimited
// SSH sessions to OverTheWire through your server.
const MAX_SESSIONS_PER_IP = 3;
const sessionsByIp = new Map();

function addSession(ip) {
  sessionsByIp.set(ip, (sessionsByIp.get(ip) || 0) + 1);
}
function removeSession(ip) {
  const n = (sessionsByIp.get(ip) || 1) - 1;
  if (n <= 0) sessionsByIp.delete(ip);
  else sessionsByIp.set(ip, n);
}

io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  let sshClient = null;
  let sshStream = null;
  let countedForIp = false;

  socket.on('ssh-connect', (creds) => {
    // Basic validation — this proxy is scoped to the bandit wargame only.
    const host = creds && creds.host === 'bandit.labs.overthewire.org'
      ? creds.host
      : null;
    const port = Number(creds && creds.port) || 2220;
    const username = String(creds && creds.username || '').trim();
    const password = String(creds && creds.password || '');
    const cols = Number(creds && creds.cols) || 80;
    const rows = Number(creds && creds.rows) || 24;

    if (!host || !/^bandit\d+(-git)?$/.test(username)) {
      socket.emit('message', '\r\n[!] Only bandit.labs.overthewire.org bandit accounts are allowed here.\r\n');
      socket.disconnect();
      return;
    }

    if ((sessionsByIp.get(ip) || 0) >= MAX_SESSIONS_PER_IP) {
      socket.emit('message', '\r\n[!] Too many concurrent sessions from your connection. Close a tab and try again.\r\n');
      socket.disconnect();
      return;
    }
    addSession(ip);
    countedForIp = true;

    sshClient = new Client();

    sshClient
      .on('ready', () => {
        socket.emit('message', '\r\n*** SSH connection established ***\r\n\r\n');
        sshClient.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
          if (err) {
            socket.emit('message', `\r\n[!] Could not open shell: ${err.message}\r\n`);
            socket.disconnect();
            return;
          }
          sshStream = stream;

          stream.on('data', (data) => socket.emit('terminal-data', data.toString('utf-8')));
          stream.stderr.on('data', (data) => socket.emit('terminal-data', data.toString('utf-8')));

          stream.on('close', () => {
            socket.emit('message', '\r\n\r\n*** Session closed ***\r\n');
            socket.emit('ssh-closed');
            sshClient.end();
          });
        });
      })
      .on('error', (err) => {
        // Wrong password, unreachable host, etc.
        socket.emit('message', `\r\n[!] SSH error: ${err.message}\r\n`);
        socket.emit('ssh-closed');
      })
      .on('keyboard-interactive', (_name, _instr, _lang, _prompts, finish) => {
        finish([password]);
      })
      .connect({
        host,
        port,
        username,
        password,
        tryKeyboard: true,
        readyTimeout: 20000,
        // keepalive so long idle bandit sessions (e.g. while a student
        // reads a level) don't get silently dropped
        keepaliveInterval: 15000,
      });
  });

  socket.on('terminal-input', (data) => {
    if (sshStream) sshStream.write(data);
  });

  socket.on('terminal-resize', ({ cols, rows }) => {
    if (sshStream && cols && rows) sshStream.setWindow(rows, cols, 0, 0);
  });

  socket.on('disconnect', () => {
    if (sshStream) sshStream.end();
    if (sshClient) sshClient.end();
    if (countedForIp) removeSession(ip);
  });
});

server.listen(PORT, () => {
  console.log(`bandit-terminal backend listening on :${PORT}`);
});