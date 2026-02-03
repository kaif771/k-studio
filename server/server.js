import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Backend Port Allocation Management
const activeProcesses = new Map();
const activeStaticServers = new Map(); // ProjectName -> { server, port }
const projectPortMap = new Map(); // ProjectName -> Assigned Port
let nextAvailablePort = 3002;

const desktopPath = path.resolve('C:/Users/Mohideen A Kader/OneDrive/Desktop');

function stopProjectLogic(projectName) {
    let stopped = false;
    // 1. Kill dev server process
    if (activeProcesses.has(projectName)) {
        console.log(`Killing active process for: ${projectName}`);
        activeProcesses.get(projectName).kill('SIGINT');
        activeProcesses.delete(projectName);
        stopped = true;
    }
    // 2. Close static server
    if (activeStaticServers.has(projectName)) {
        console.log(`Closing static server for: ${projectName}`);
        const { server } = activeStaticServers.get(projectName);
        server.close();
        activeStaticServers.delete(projectName);
        stopped = true;
    }
    return stopped;
}

// Helper function to check if a port is ready using TCP connection
function checkPortReady(port, maxAttempts = 30) {
    return new Promise((resolve) => {
        let attempts = 0;
        const check = () => {
            const socket = new net.Socket();
            socket.setTimeout(1000);

            socket.on('connect', () => {
                socket.destroy();
                console.log(`✅ Port ${port} is reachable via TCP!`);
                resolve(true);
            });

            socket.on('error', () => {
                socket.destroy();
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 1000);
                } else {
                    console.log(`❌ Port ${port} timeout after ${maxAttempts} attempts`);
                    resolve(false);
                }
            });

            socket.on('timeout', () => {
                socket.destroy();
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, 1000);
                } else {
                    resolve(false);
                }
            });

            socket.connect(port, '127.0.0.1');
        };
        check();
    });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 5000 }));

// ... [Existing Endpoints: cache-codebase, architect, chat] ...

app.post('/api/cache-codebase', async (req, res) => {
    try {
        const { projectFiles } = req.body;

        if (!projectFiles || projectFiles.trim().length === 0) {
            return res.json({ cacheName: null, message: "No project files to cache" });
        }

        // Note: Caching API may not be available in all SDK versions
        // This is an optional optimization feature
        try {
            const model = "gemini-1.5-flash-001";
            const cache = await genAI.getGenerativeModel({ model }).createCachedContent({
                model,
                displayName: "Gemini_Architect_Context",
                systemInstruction: "You are a Senior Architect.",
                contents: [{ role: "user", parts: [{ text: projectFiles }] }],
                ttlSeconds: 3600,
            });
            console.log("Cache created successfully:", cache.name);
            res.json({ cacheName: cache.name });
        } catch (cacheError) {
            // Caching failed, but this is non-critical - return null and continue
            console.warn("Caching not available or failed:", cacheError.message);
            res.json({ cacheName: null, message: "Caching unavailable, will use direct API calls" });
        }
    } catch (error) {
        console.error("Cache endpoint error:", error);
        res.status(500).json({ error: "Caching failed", details: error.message });
    }
});

app.post('/api/architect', async (req, res) => {
    try {
        const { prompt, projectContext, image, cacheName } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", cachedContent: cacheName || undefined });
        let parts = [{ text: `CONTEXT:\n${projectContext}\n\nUSER REQUEST: ${prompt}` }];
        if (image) {
            const base64Data = image.split(',')[1] || image;
            parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
        }
        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } });
        res.json(JSON.parse(result.response.text()));
    } catch (error) {
        res.status(500).json({ error: "Architect failed", details: error.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        res.json({ reply: (await result.response).text() });
    } catch (error) {
        res.status(500).json({ error: "Chat failed", details: error.message });
    }
});

// 4. Autonomous Project Detection
app.post('/api/detect-project', (req, res) => {
    const { folderName, files } = req.body;
    console.log(`🔍 [Detect] Request for: ${folderName}`);

    let port = projectPortMap.has(folderName) ? projectPortMap.get(folderName) : nextAvailablePort++;
    projectPortMap.set(folderName, port);

    const projectPath = path.join(desktopPath, folderName);
    console.log(`   - Resolved Path: ${projectPath}`);

    let type = 'static';
    let framework = 'vanilla';

    try {
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['next']) {
                type = 'next';
                framework = 'nextjs';
            } else if (deps['vite']) {
                type = 'vite';
                framework = 'vite';
            } else if (deps['react-scripts']) {
                type = 'cra';
                framework = 'react';
            } else if (deps['@remix-run/dev']) {
                type = 'remix';
                framework = 'remix';
            } else {
                type = 'node';
                framework = 'nodejs';
            }
        }
    } catch (e) {
        console.error(`   - Error during detection: ${e.message}`);
    }

    console.log(`   - Detected: ${type} (${framework}), Port: ${port}`);
    res.json({ type, framework, port });
});

// 5. Autonomous Project Execution with Readiness Check
app.post('/api/run-project', async (req, res) => {
    const { projectName, projectType, port } = req.body;
    console.log(`🚀 [Run] Project: ${projectName}, Type: ${projectType}, Port: ${port}`);

    const projectPath = path.join(desktopPath, projectName);
    console.log(`   - Working Directory: ${projectPath}`);

    // Ensure stale processes are cleaned up first
    if (activeProcesses.has(projectName) || activeStaticServers.has(projectName)) {
        console.log(`   - cleaning up previous instance of ${projectName}...`);
        stopProjectLogic(projectName);
    }

    try {
        if (projectType === 'static') {
            console.log(`   - Starting static server on port ${port}...`);
            const staticApp = express();
            staticApp.use(express.static(projectPath));
            const server = staticApp.listen(port, () => console.log(`   - Static server: ${projectName} on ${port}`));
            activeStaticServers.set(projectName, { server, port });
            return res.json({ status: 'ready', url: `http://localhost:${port}` });
        }

        // Dependency Check
        if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
            console.warn(`   - ⚠️ node_modules missing for: ${projectName}`);
            return res.json({ status: 'needs_install', message: "Missing node_modules. Please run 'npm install'." });
        }

        // Framework specific commands and environment
        const isWin = process.platform === 'win32';
        let command = isWin ? 'npm.cmd' : 'npm';
        let args = ['run', 'dev'];
        let env = {
            ...process.env,
            PORT: port.toString(),
            VITE_PORT: port.toString(),
            HOST: '127.0.0.1',
            VITE_HOST: '127.0.0.1',
            BROWSER: 'none',
            NODE_ENV: 'development',
            FORCE_COLOR: '1'
        };

        if (projectType === 'next') {
            args = ['run', 'dev', '--', '-p', port.toString()];
        } else if (projectType === 'vite') {
            args = ['run', 'dev', '--', '--port', port.toString(), '--strictPort'];
        }

        console.log(`   - Spawning: ${command} ${args.join(' ')}`);
        const child = spawn(command, args, {
            cwd: projectPath,
            shell: true,
            env: env
        });

        // Diagnostic Logging: Show the first few lines of output
        child.stdout.on('data', (d) => {
            const msg = d.toString();
            console.log(`[${projectName}:stdout] ${msg.trim()}`);
        });

        child.stderr.on('data', (d) => {
            const msg = d.toString();
            console.error(`[${projectName}:stderr] ${msg.trim()}`);
        });

        activeProcesses.set(projectName, child);

        // Wait for the server to be ready before responding
        console.log(`   - Waiting for port ${port} check...`);
        const isReady = await checkPortReady(port, projectType === 'next' ? 60 : 30); // Frameworks are slower

        if (isReady) {
            console.log(`   - ✅ ${projectName} is ready on port ${port}`);
            res.json({ status: 'ready', url: `http://localhost:${port}` });
        } else {
            console.log(`   - ⚠️ ${projectName} started but port check failed/timed out`);
            res.json({ status: 'starting', url: `http://localhost:${port}` });
        }
    } catch (error) {
        console.error(`   - ❌ Execution Error: ${error.message}`);
        res.status(500).json({ error: "Failed to run", details: error.message });
    }
});

// 6. Project Stop/Cleanup
app.post('/api/stop-project', (req, res) => {
    const { projectName } = req.body;
    const stopped = stopProjectLogic(projectName);
    res.json({ success: stopped, message: stopped ? `Stopped ${projectName}` : "No active process found" });
});

app.listen(5000, () => console.log('Backend Online: Port 5000'));