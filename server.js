<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>bandit :: live terminal</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" />
    <style>
        body {
            background-color: #0a0f0c;
            color: #d1d5db;
            font-family: 'IBM Plex Mono', monospace;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 { color: #22c55e; margin-bottom: 5px; }
        
        .tab-bar {
            width: 85%;
            display: flex;
            gap: 5px;
            margin-bottom: 0;
            background: #111;
            padding: 5px 5px 0 5px;
            border: 1px solid #333;
            border-bottom: none;
            border-radius: 5px 5px 0 0;
        }
        .tab {
            background-color: #222;
            color: #888;
            border: 1px solid #333;
            border-bottom: none;
            padding: 8px 15px;
            cursor: pointer;
            font-family: 'IBM Plex Mono', monospace;
            border-radius: 5px 5px 0 0;
        }
        .tab.active {
            background-color: #000;
            color: #22c55e;
            border-color: #22c55e;
        }
        .add-tab-btn {
            background-color: #1a221d;
            color: #22c55e;
            border: 1px dashed #22c55e;
            padding: 8px 12px;
            cursor: pointer;
            font-family: 'IBM Plex Mono', monospace;
            border-radius: 3px;
            margin-left: auto;
        }
        .add-tab-btn:hover { background-color: #22c55e; color: #000; }

        .term-wrapper {
            width: 85%;
            height: 500px;
            background-color: #000;
            padding: 10px;
            border: 1px solid #22c55e;
            border-radius: 0 0 5px 5px;
            box-shadow: 0 0 15px rgba(0,0,0,0.8);
            display: none;
        }
        .term-wrapper.active { display: block; }

        .back-btn {
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #22c55e;
            color: #000;
            text-decoration: none;
            font-weight: bold;
            border-radius: 3px;
        }
    </style>
</head>
<body>

    <h1>> bandit_terminal_</h1>
    <p>Real-Time OverTheWire SSH Proxy Environment.</p>
    
    <div class="tab-bar" id="tabBar">
        <button class="add-tab-btn" onclick="createNewTab()">+ New Tab</button>
    </div>

    <div id="terminalsContainer"></div>

    <a href="index.html" class="back-btn"><- Back to Guide</a>

    <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
    <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    <script>
        const BACKEND_URL = "https://bandit-guide-production.up.railway.app";
        const passwords = {
            0: "bandit0", 1: "6y2kwnwK6grgvwvpvLaa2T1cpFEKOhNR", 2: "PK8fYLZg2hnHSz83plBL1iEPKdD3QToB",
            3: "7ZZ2LFrykP2zEyvBl4m3clcL7tGYJPME", 4: "xzTXq1rDJQVVAzdv5cHq1TQytTWufAMq", 5: "6C7h9GD8M6ai5nr7wo1RonrzFjj9yIrG",
            6: "pXa26xhMWaC2SvDotA4r9EgZkulOeSBW", 7: "Bmnnvf82KzQlfxgAI2d1zYbr1u9pr3E3", 8: "VR1ljMayciFxbnUokuQmJFw6QC9VKtub",
            9: "EjmOSvuAu7sGAHqHVcBDPirRe9T03kxl", 10: "B0s2khmbT9u0geKuOoVGW3JZKhndE3BG", 11: "pYfOY6HwUsDj5rL9UvyhU7MCmv8vN5Ro",
            12: "GROozWPO8QyN0mGrjUkID0WCYkZiQxrN", 13: "qQYQiHOBPR8zR61qxYqX45quvihF2uzk", 14: "aaWecNkG4FhxJQxz07uiwzVP6bJiYS65",
            15: "pbLYuZtTg4MgaqfJx8jbA9gKKGqM68A7", 16: "kS0Hf0u5HiXFwKMKFqXvPdOTNGGa0X8V", 17: "cd /tmp: cat mykey.key > bandit17.key",
            18: "OQxXZjELndr90zuhOTDYBEomI0SZITXI", 19: "KpsOfPkcP7i1FlIExk2QEjyt6dw8dxZI", 20: "4pIjcunZ0fK2vmp3IwfG8Vf7VhxD6pOA",
            21: "bW9kBv5WC3P4yoDyf12LSdGuNz5ka6hY", 22: "RYVux2rHEm9tiXHmLFzuR7Vhx6AZQMEz", 23: "gKXDTAXnIz3OBxiPjRZ2uqutUlPZrBsw",
            24: "hVQMk3lJNsmQ7VF3ubyrNNBom7BOgVXv", 25: "SoHfqMOEqIX2IYKVciZxvgpR9a2Djx4P", 26: "jHdv2ELQhT22BkprMNDjybZDAkw1zeBJ",
            27: "STJLJBRRphMxKB392CT4iOr5CbzPU9ER", 28: "y8Yd2ssKcpHpud7UvOSOxwamRMzIGIeQ", 29: "Em7eGtqaMySwNFjCpwzzHhLhospOcdt0",
            30: "jq9Dfg2rXsfYsWMgFuKlXhphjdH7USgX", 31: "82NkymblpGBYmIXG6ZQ8YldBYstHpfUf", 32: "pWuj5jBQ6IgV0NXwiH6g1pXRF8S1YvbT",
            33: "u4P2CyPOwPGLe94RdD9Uo2FxFwvnFswM"
        };

        let tabCount = 0;
        let sessions = {};

        function switchTab(id) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.term-wrapper').forEach(tw => tw.classList.remove('active'));
            
            document.getElementById(`tabBtn-${id}`).classList.add('active');
            document.getElementById(`termWrap-${id}`).classList.add('active');
            
            sessions[id].term.focus();
        }

        function createNewTab() {
            tabCount++;
            const id = tabCount;
            
            const socket = io(BACKEND_URL);

            sessions[id] = {
                id: id,
                socket: socket,
                isConnected: false,
                isPasswordMode: false,
                targetLevel: null,
                inputBuffer: '',
                term: null
            };

            const tabBtn = document.createElement('div');
            tabBtn.className = 'tab';
            tabBtn.id = `tabBtn-${id}`;
            tabBtn.innerHTML = `Terminal ${id}`;
            tabBtn.onclick = () => switchTab(id);
            
            const tabBar = document.getElementById('tabBar');
            tabBar.insertBefore(tabBtn, tabBar.lastElementChild);

            const termWrap = document.createElement('div');
            termWrap.className = 'term-wrapper';
            termWrap.id = `termWrap-${id}`;
            document.getElementById('terminalsContainer').appendChild(termWrap);

            const term = new Terminal({
                cursorBlink: true,
                theme: { background: '#000000', foreground: '#00ff00', cursor: '#00ff00' }
            });
            term.open(termWrap);
            sessions[id].term = term;

            term.write(`Web SSH Proxy Active (Session ${id})\r\n`);
            term.write(`To connect, type: ssh bandit0@bandit.labs.overthewire.org\r\n\r\nplayer@linux:~$ `);

            // Backend event handlers
            socket.on('message', (msg) => term.write(msg));

            socket.on('terminal-data', (data) => {
                term.write(data);
            });

            term.onData(e => {
                let session = sessions[id];
                if (session.isConnected) {
                    // Direct stream to real SSH server
                    socket.emit('terminal-input', e);
                } else {
                    handleLocalInput(id, e);
                }
            });

            switchTab(id);
        }

        function handleLocalInput(id, e) {
            let session = sessions[id];
            let term = session.term;

            if (e === '\r') {
                let cmd = session.inputBuffer.trim();
                session.inputBuffer = '';

                if (session.isPasswordMode) {
                    term.write('\r\n');
                    // Send credentials to backend SSH connection
                    session.socket.emit('ssh-connect', {
                        host: 'bandit.labs.overthewire.org',
                        port: 2220,
                        username: `bandit${session.targetLevel}`,
                        password: cmd
                    });
                    session.isConnected = true;
                    session.isPasswordMode = false;
                    document.getElementById(`tabBtn-${id}`).innerHTML = `bandit${session.targetLevel}`;
                } else if (cmd.startsWith('ssh bandit')) {
                    let match = cmd.match(/ssh\s+bandit(\d+)/);
                    if (match) {
                        session.targetLevel = parseInt(match[1]);
                        session.isPasswordMode = true;
                        term.write(`\r\nbandit${session.targetLevel}@bandit.labs.overthewire.org's password: `);
                    } else {
                        term.write('\r\nInvalid format. Example: ssh bandit0@bandit.labs.overthewire.org\r\nplayer@linux:~$ ');
                    }
                } else {
                    term.write('\r\nUse "ssh bandit0@bandit.labs.overthewire.org" to start real SSH session.\r\nplayer@linux:~$ ');
                }
            } else if (e === '\u007F') {
                if (session.inputBuffer.length > 0) {
                    session.inputBuffer = session.inputBuffer.slice(0, -1);
                    if (!session.isPasswordMode) term.write('\b \b');
                }
            } else {
                session.inputBuffer += e;
                if (!session.isPasswordMode) term.write(e);
            }
        }

        createNewTab();
    </script>
</body>
</html>