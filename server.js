const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('ssh2');
const cors = require('cors');

// 1. Server aur CORS Setup
const app = express();
app.use(cors()); // CORS allow karta hai ke aapki GitHub Pages website is server se connect ho sake

const server = http.createServer(app);

// 2. WebSocket (Socket.io) Initialization
const io = new Server(server, {
    cors: {
        origin: "*", // Yahan aap baad mein apna GitHub Pages ka exact URL daal sakte hain security ke liye
        methods: ["GET", "POST"]
    }
});

// 3. Jab bhi koi user website khol kar terminal se connect karega
io.on('connection', (socket) => {
    console.log(`[+] New Web Client Connected: ${socket.id}`);
    
    // Har user ke liye ek naya SSH client banega
    let sshClient = new Client();

    // Jab frontend se 'ssh-connect' ka signal aaye (user command aur password dale)
    socket.on('ssh-connect', (credentials) => {
        console.log(`[~] Attempting SSH connection to ${credentials.host} as ${credentials.username}`);
        
        socket.emit('message', '\r\n\x1b[33mConnecting to server...\x1b[0m\r\n');

        sshClient.on('ready', () => {
            console.log(`[+] SSH Connection Ready for ${credentials.username}`);
            
            // Interactive Shell (PTY) start karein taake hamesha zinda rahe
            sshClient.shell({ term: 'xterm-color' }, (err, stream) => {
                if (err) {
                    socket.emit('message', '\r\n\x1b[31m*** Error starting interactive shell ***\x1b[0m\r\n');
                    return;
                }

                socket.emit('message', '\r\n\x1b[32m*** Connected to OverTheWire! ***\x1b[0m\r\n');

                // A. Jab SSH Server se koi output aaye, toh usko website (Frontend) par bhejo
                stream.on('data', (data) => {
                    socket.emit('terminal-data', data.toString('utf-8'));
                });

                // B. Jab website (Frontend) se user kuch type kare, toh usko SSH Server ko bhejo
                socket.on('terminal-input', (data) => {
                    stream.write(data);
                });

                // C. Jab SSH connection close ho jaye
                stream.on('close', () => {
                    socket.emit('message', '\r\n\x1b[31m*** SSH Connection Closed ***\x1b[0m\r\n');
                    sshClient.end();
                });
            });

        }).on('error', (err) => {
            // Agar password galat ho ya server down ho
            console.error(`[-] SSH Error: ${err.message}`);
            socket.emit('message', `\r\n\x1b[31m*** Connection Error: ${err.message} ***\x1b[0m\r\n`);
        
        }).connect({
            host: credentials.host,
            port: credentials.port || 2220, // Bandit labs ka port 2220 hai
            username: credentials.username,
            password: credentials.password,
            keepaliveInterval: 10000 // Connection ko zinda rakhne ke liye ping
        });
    });

    // Jab user website band kar de ya tab close kar de
    socket.on('disconnect', () => {
        console.log(`[-] Web Client Disconnected: ${socket.id}`);
        // Memory leak se bachne ke liye SSH connection kill karna zaroori hai
        sshClient.end(); 
    });
});

// 4. Server Start Karein
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Proxy Server is running on port ${PORT}`);
    console.log(`Waiting for frontend connections...`);
});