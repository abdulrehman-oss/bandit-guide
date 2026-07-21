// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Client } = require('ssh2');

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.static(__dirname));
app.get('/', (_req, res) => res.send('bandit-terminal backend is running'));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

const MAX_SESSIONS_PER_IP = 5;
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
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  let sshClient = null;
  let sshStream = null;
  let countedForIp = false;

  socket.on('ssh-connect', (creds) => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }

    const host = creds && creds.host === 'bandit.labs.overthewire.org' ? creds.host : null;
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
      socket.emit('message', '\r\n[!] Too many concurrent sessions from your connection.\r\n');
      socket.disconnect();
      return;
    }

    if (!countedForIp) {
      addSession(ip);
      countedForIp = true;
    }

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
        socket.emit('message', `\r\n[!] SSH error: ${err.message}\r\n`);
        socket.emit('ssh-closed');
        if (countedForIp) {
          removeSession(ip);
          countedForIp = false;
        }
      })
      .on('keyboard-interactive', (_name, _instr, _lang, _prompts, finish) => {
        finish([password]);
      })
      .connect({
        host, port, username, password,
        tryKeyboard: true,
        readyTimeout: 10000,
        connectTimeout: 10000,
        keepaliveInterval: 5000,
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
    if (countedForIp) {
      removeSession(ip);
      countedForIp = false;
    }
  });
});

server.listen(PORT, () => {
  console.log(`bandit-terminal backend listening on :${PORT}`);
});