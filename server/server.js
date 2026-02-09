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

// Global error handlers to surface uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

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
let genAI = null;
try {
    // SDK initialization may throw synchronously if keys are invalid or missing.
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} catch (initErr) {
    console.error('⚠️ Failed to initialize GoogleGenerativeAI SDK:', initErr && initErr.message ? initErr.message : initErr);
    genAI = null;
}

// Local deterministic fallback generators for dev/test when SDK is unavailable or quota limited
function fallbackGenerateSchema(projectContext) {
    const header = '# Suggested MongoDB Schema\n\n';
    const users = `## users\n\n- _id: ObjectId\n- email: string (unique)\n- passwordHash: string\n- roles: [string]\n- createdAt: ISODate\n- updatedAt: ISODate\n\nExample:\n\n{\n  \"email\": \"user@example.com\",\n  \"passwordHash\": \"$2b$...\",\n  \"roles\": [\"user\"]\n}\n\n`;
    const projects = `## projects\n\n- _id: ObjectId\n- ownerId: ObjectId (ref users)\n- name: string\n- files: [{ path: string, content: string }]\n- createdAt: ISODate\n\n`;
    const indexes = `## Recommended Indexes\n\n- users: { email: 1 } (unique)\n- projects: { ownerId: 1 }\n\n`;
    return header + users + projects + indexes + '\n// Context summary:\n' + (projectContext ? projectContext.slice(0, 1000) : '(none)');
}

function fallbackGenerateAuth(projectContext) {
    return `# Auth scaffold (fallback)\n\nThis is a deterministic fallback auth scaffold for development and testing. Replace with a production-ready implementation when ready.\n\n## Overview\n- Express routes: /auth/register, /auth/login, /auth/me\n- Storage: MongoDB users collection with password hashes (bcrypt)\n- Session: JWT stored in Authorization header (Bearer)\n\n## Example code snippets\n\n// register (pseudo)\nPOST /auth/register\n{ email, password } -> create user with passwordHash\n\n// login (pseudo)\nPOST /auth/login\n{ email, password } -> verify password, return JWT\n\n// middleware (pseudo)\nfunction authMiddleware(req, res, next) {\n  const token = req.headers.authorization?.split(' ')[1];\n  // verify JWT and attach userId to req.user\n}\n\n// Notes:\n- Use bcrypt for password hashing\n- Use a short-lived access token with refresh tokens if needed\n\n// Context summary:\n${projectContext ? projectContext.slice(0, 1000) : '(none)'}\n`;
}

// Helper to handle Gemini errors consistently
function handleGeminiError(error, res, fallbackContent = null) {
    console.error('Gemini API Error:', error && error.message ? error.message : error);

    const status = error && error.status ? error.status : 500;
    let retryAfterSeconds = null;

    try {
        if (error && Array.isArray(error.errorDetails)) {
            for (const d of error.errorDetails) {
                if (d && (d['@type'] || '').includes('RetryInfo') && d.retryDelay) {
                    const m = String(d.retryDelay).match(/([0-9]+)(?:\.\d+)?s/);
                    if (m) retryAfterSeconds = parseInt(m[1], 10);
                }
            }
        }
    } catch (e) { /* ignore parsing errors */ }

    // If quota/retry info is present, or 429, handle gracefully
    if (retryAfterSeconds !== null || status === 429) {
        const message = retryAfterSeconds
            ? `Quota exceeded. Please retry in ${retryAfterSeconds}s.`
            : 'Quota exceeded. Please try again later.';

        // If we have fallback content (e.g. for schema/auth), return it with a warning
        if (fallbackContent) {
            const payload = { ...fallbackContent, fallback: true, message, retryAfterSeconds };
            return res.status(200).json(payload);
        }

        // Otherwise return 429 error
        const payload = { error: message, details: message };
        if (retryAfterSeconds) payload.retryAfterSeconds = retryAfterSeconds;
        return res.status(429).json(payload);
    }

    // Standard error
    return res.status(status).json({
        error: "AI Generation Failed",
        details: error && error.message ? error.message : String(error)
    });
}

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 5000 }));

// ... [Existing Endpoints: cache-codebase, architect, chat] ...

app.post('/api/cache-codebase', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ cacheName: null, message: 'Generative AI SDK not initialized' });
        const { projectFiles } = req.body;

        if (!projectFiles || projectFiles.trim().length === 0) {
            return res.json({ cacheName: null, message: "No project files to cache" });
        }

        // Note: Caching API may not be available in all SDK versions
        // This is an optional optimization feature
        try {
            const model = "gemini-2.0-flash";
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
        if (!genAI) return res.status(503).json({ error: 'Generative AI SDK not initialized' });
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
        handleGeminiError(error, res);
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'Generative AI SDK not initialized' });
        const { message, history } = req.body;
        // Use gemini-2.0-flash for consistency and availability
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        res.json({ reply: (await result.response).text() });
    } catch (error) {
        handleGeminiError(error, res);
    }
});

// Generate MongoDB schema using Gemini (returns markdown string)
app.post('/api/generate-mongo-schema', async (req, res) => {
    const { projectContext } = req.body || {};
    // Use fallback generator when SDK isn't available
    if (!genAI) {
        console.warn('Generative SDK not initialized; returning fallback MongoDB schema.');
        const schema = fallbackGenerateSchema(projectContext || '');
        return res.json({ schema, fallback: true });
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const promptParts = [{
            text: `Please produce a MongoDB schema (collections, example documents, and recommended indexes) based on the following project context. Reply in Markdown format.

CONTEXT:
${projectContext || '(no project context provided)'}
` }];

        const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }], generationConfig: { responseMimeType: 'text/plain' } });
        const text = result.response.text();
        res.json({ schema: text });

    } catch (error) {
        const fallbackSchema = fallbackGenerateSchema(projectContext || '');
        handleGeminiError(error, res, { schema: fallbackSchema });
    }
});

// Generate authentication scaffold (express + JWT) using Gemini
app.post('/api/generate-auth', async (req, res) => {
    const { projectContext } = req.body || {};
    if (!genAI) {
        console.warn('Generative SDK not initialized; returning fallback auth scaffold.');
        const auth = fallbackGenerateAuth(projectContext || '');
        return res.json({ auth, fallback: true });
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const promptParts = [{
            text: `Please produce a concise authentication scaffold for a Node.js + Express application using MongoDB for user storage and JWT for sessions. Include example routes, data model, and a brief explanation. Reply with code snippets and minimal text. Context:

${projectContext || '(no project context provided)'}
` }];

        const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }], generationConfig: { responseMimeType: 'text/plain' } });
        const text = result.response.text();
        res.json({ auth: text });

    } catch (error) {
        const fallbackAuth = fallbackGenerateAuth(projectContext || '');
        handleGeminiError(error, res, { auth: fallbackAuth });
    }
});

// 4. Autonomous Project Detection
app.post('/api/detect-project', (req, res) => {
    const { folderName, files } = req.body;
    console.log(`🔍 [Detect] Request for: ${folderName}`);
    const projectContext = req.body && req.body.projectContext ? req.body.projectContext : null;

    let port = projectPortMap.has(folderName) ? projectPortMap.get(folderName) : nextAvailablePort++;
    projectPortMap.set(folderName, port);

    const projectPath = path.join(desktopPath, folderName);
    console.log(`   - Resolved Path: ${projectPath}`);

    let type = 'static';
    let framework = 'vanilla';

    try {
        // Prefer projectContext heuristics if provided (client-scanned file contents).
        if (projectContext && typeof projectContext === 'string' && projectContext.length > 0) {
            const ctx = projectContext.toLowerCase();
            if (ctx.includes('next') || ctx.includes('next.config') || ctx.includes('@next')) {
                type = 'next';
                framework = 'nextjs';
            } else if (ctx.includes('vite') || ctx.includes('vite.config')) {
                type = 'vite';
                framework = 'vite';
            } else if (ctx.includes('react-scripts') || ctx.includes('create-react-app') || ctx.includes('react-dom')) {
                type = 'cra';
                framework = 'react';
            } else if (ctx.includes('@remix-run') || ctx.includes('remix.config')) {
                type = 'remix';
                framework = 'remix';
            } else if (ctx.includes('package.json')) {
                // fallback: attempt to parse package.json snippet
                try {
                    const match = projectContext.match(/\{[\s\S]*?\}/);
                    if (match) {
                        const pkg = JSON.parse(match[0]);
                        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                        if (deps && deps['next']) {
                            type = 'next'; framework = 'nextjs';
                        } else if (deps && deps['vite']) {
                            type = 'vite'; framework = 'vite';
                        } else if (deps && deps['react-scripts']) {
                            type = 'cra'; framework = 'react';
                        }
                    }
                } catch (e) {
                    // ignore parse errors
                }
            } else {
                // Heuristic fallback: if many .tsx/.jsx files present, treat as React/node
                const extCount = (projectContext.match(/\.tsx|\.jsx|import\s+React|from\s+'react'/g) || []).length;
                if (extCount > 3) {
                    type = 'node'; framework = 'nodejs';
                }
            }
        } else {
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
        }
    } catch (e) {
        console.error(`   - Error during detection: ${e && e.message ? e.message : e}`);
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

        // Ensure we log child lifecycle events so the server doesn't silently
        // stop or leave stale state when a dev server process exits.
        child.on('exit', (code, signal) => {
            console.log(`[${projectName}] child exited with code=${code} signal=${signal}`);
            if (activeProcesses.has(projectName)) activeProcesses.delete(projectName);
        });

        child.on('error', (err) => {
            console.error(`[${projectName}] child process error:`, err);
        });

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

// Allow server port override via env (useful for dev) and create HTTP server explicitly
const SERVER_PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 5000;
// Create HTTP server explicitly so we can attach an error handler before calling listen
const httpServer = http.createServer(app);

httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${SERVER_PORT} already in use (EADDRINUSE). Another process is listening on this port.`);
        console.error(`   - Run ` + "netstat -ano | findstr " + SERVER_PORT + "` to find the PID, then `tasklist /FI \"PID eq <pid>\"` to inspect the process.");
        // When running tests, we allow the import to proceed even if port is busy.
        if (process.env.DISABLE_AUTO_LISTEN === '1') {
            console.warn('DISABLE_AUTO_LISTEN=1; skipping exit on EADDRINUSE to allow test harness to start ephemeral servers.');
            return;
        }
        process.exit(1);
    }
    console.error('HTTP server error:', err && err.stack ? err.stack : err);
});

httpServer.on('close', () => {
    console.log('HTTP server closed event emitted');
});

// Only auto-listen when not disabled (allows tests to import app without binding ports)
// if (process.env.DISABLE_AUTO_LISTEN !== '1') {
//     httpServer.listen(SERVER_PORT, () => console.log(`Backend Online: Port ${SERVER_PORT}`));
// } else {
//     console.log('Auto-listen disabled (DISABLE_AUTO_LISTEN=1). Server exported for testing.');
// }

export default app;

// Export app and httpServer for test harnesses or programmatic control
export { app, httpServer, genAI, fallbackGenerateSchema, fallbackGenerateAuth };

process.on('beforeExit', (code) => {
    console.log(`process beforeExit event with code: ${code}`);
});

process.on('exit', (code) => {
    console.log(`process exit event with code: ${code}`);
});

// Debug endpoint to check runtime state without causing side-effects
app.get('/api/debug', (req, res) => {
    res.json({
        uptime: process.uptime(),
        pid: process.pid,
        genAIInitialized: !!genAI,
        activeProcesses: Array.from(activeProcesses.keys()),
        activeStaticServers: Array.from(activeStaticServers.keys()),
        envLoaded: !!process.env.GEMINI_API_KEY
    });
});

// Graceful shutdown: stop child processes and static servers before exiting.
const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    try {
        for (const [name, child] of activeProcesses.entries()) {
            try {
                console.log(`   - Killing child process for ${name}`);
                child.kill('SIGINT');
            } catch (e) {
                console.warn(`   - Failed to kill child for ${name}:`, e && e.message ? e.message : e);
            }
        }
        activeProcesses.clear();

        for (const [name, entry] of activeStaticServers.entries()) {
            try {
                console.log(`   - Closing static server for ${name}`);
                entry.server.close();
            } catch (e) {
                console.warn(`   - Failed to close static server for ${name}:`, e && e.message ? e.message : e);
            }
        }
        activeStaticServers.clear();

        if (httpServer && typeof httpServer.close === 'function') {
            httpServer.close(() => {
                console.log('HTTP server closed. Exiting process.');
                process.exit(0);
            });
            // Force exit after timeout
            setTimeout(() => {
                console.warn('Forcing exit after timeout.');
                process.exit(1);
            }, 5000).unref();
        } else {
            process.exit(0);
        }
    } catch (e) {
        console.error('Error during graceful shutdown:', e);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));