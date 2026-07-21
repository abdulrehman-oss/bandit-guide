// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Client } = require('ssh2');

const PORT = process.env.PORT || 3000;

// Dynamic CORS: Agar environment variable set na ho toh '*' (sabko allow karega) taaki live app par error na aaye
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const ALLOWED_ORIGINS = allowedOriginsEnv ? allowedOriginsEnv.split(',').map(s => s.trim()) : '*';

const app = express();

// Trust proxy for live hosting platforms (Railway, Render, Heroku etc.)
app.set('trust proxy', 1);

app.use(cors({ 
  origin: ALLOWED_ORIGINS,
  credentials: true 
}));

app.use(express.static(__dirname));

app.get('/', (_req, res) => res.send('bandit-terminal backend is running'));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ALLOWED_ORIGINS, 
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const MAX_SESSIONS_PER_IP = 10; // Live environment ke liye thoda limit increase kiya gaya hai
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
  // Get real IP safely behind proxies
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown';
  let sshClient = null;
  let sshStream = null;
  let countedForIp = false;

  socket.on('ssh-connect', (creds) => {
    if (sshClient) {
      sshClient.end();
      sshClient = null;
    }

    const host = creds && creds.host === 'bandit.labs.overthewire.org' ? creds.host : 'bandit.labs.overthewire.org';
    const port = Number(creds && creds.port) || 2220;
    const username = String(creds && creds.username || '').trim();
    const password = String(creds && creds.password || '');
    const cols = Number(creds && creds.cols) || 80;
    const rows = Number(creds && creds.rows) || 24;

    if (!username.startsWith('bandit')) {
      socket.emit('message', '\r\n[!] Invalid username. Must be a bandit account.\r\n');
      return;
    }

    if ((sessionsByIp.get(ip) || 0) >= MAX_SESSIONS_PER_IP) {
      socket.emit('message', '\r\n[!] Too many concurrent sessions from your connection.\r\n');
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
            sshClient.end();
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
        host, 
        port, 
        username, 
        password,
        tryKeyboard: true,
        readyTimeout: 15000,
        connectTimeout: 15000,
        keepaliveInterval: 10000,
      });
  });

  socket.on('terminal-input', (data) => {
    if (sshStream) sshStream.write(data);
  });

  socket.on('terminal-resize', ({ cols, rows }) => {
    if (sshStream && cols && rows) {
      try {
        sshStream.setWindow(rows, cols, 0, 0);
      } catch (e) {
        // Ignore resize errors if stream is closing
      }
    }
  });

  socket.on('disconnect', () => {
    if (sshStream) {
      try { sshStream.end(); } catch (e) {}
    }
    if (sshClient) {
      try { sshClient.end(); } catch (e) {}
    }
    if (countedForIp) {
      removeSession(ip);
      countedForIp = false;
    }
  });
});

server.listen(PORT, () => {
  console.log(`bandit-terminal backend listening on port ${PORT}`);
});