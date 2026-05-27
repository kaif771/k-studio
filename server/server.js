import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os'; // Proper ESM Import added here

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

// ============================================================================
// 📁 PERMANENT CLOUD GUARD & WORKSPACE RESOLUTION (ESM SAFE)
// ============================================================================
let rawWorkspace = process.env.WORKSPACE_DIR 
    ? process.env.WORKSPACE_DIR.replace(/^"(.*)"$/, '$1') 
    : null;

let workspaceRoot;

// Check karo kya path real me laptop par moojud hai?
if (rawWorkspace && fs.existsSync(path.resolve(rawWorkspace))) {
    workspaceRoot = path.resolve(rawWorkspace);
} else {
    // Agar cloud (Vercel) par ho toh safe tmp dir use karo
    workspaceRoot = path.join(os.tmpdir(), 'k-studio-workspace');
    if (!fs.existsSync(workspaceRoot)) {
        fs.mkdirSync(workspaceRoot, { recursive: true });
    }
}

console.log(`📁 ACTIVE WORKSPACE ROOT LAYER: ${workspaceRoot}`);

// Startup Validation Check
if (process.env.DISABLE_AUTO_LISTEN !== '1') {
    if (!process.env.WORKSPACE_DIR) {
        console.log("⚠️ process.env.WORKSPACE_DIR is empty. Applying fallback...");
    }
    // Dynamic override variables globally taaki aage koi function crash na ho
    process.env.WORKSPACE_DIR = workspaceRoot;
    console.log(`✅ Startup Validation Passed: Workspace linked safely at: ${workspaceRoot}`);
}

function resolveProjectDirectory(projectName) {
    const normalizedName = projectName.replace(/[\\/]+$/, '');

    // Priority 1: Check if workspace root itself matches the project name
    if (path.basename(workspaceRoot) === normalizedName) {
        return workspaceRoot;
    }

    // Priority 2: Check if project exists as a subdirectory inside workspace
    const candidateInsideWorkspace = path.join(workspaceRoot, normalizedName);
    if (fs.existsSync(candidateInsideWorkspace) && fs.lstatSync(candidateInsideWorkspace).isDirectory()) {
        return candidateInsideWorkspace;
    }

    // Priority 3: Check if project exists as a sibling directory next to the workspace root
    const siblingCandidate = path.join(path.dirname(workspaceRoot), normalizedName);
    if (fs.existsSync(siblingCandidate) && fs.lstatSync(siblingCandidate).isDirectory()) {
        return siblingCandidate;
    }

    // Priority 4: Fallback to workspace root itself
    if (fs.existsSync(workspaceRoot) && fs.lstatSync(workspaceRoot).isDirectory()) {
        return workspaceRoot;
    }

    return candidateInsideWorkspace;
}

function stopProjectLogic(projectName) {
    let stopped = false;
    if (activeProcesses.has(projectName)) {
        console.log(`Killing active process for: ${projectName}`);
        activeProcesses.get(projectName).kill('SIGINT');
        activeProcesses.delete(projectName);
        stopped = true;
    }
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

let genAI = null;
try {
    const key = process.env.GEMINI_API_KEY;
    console.log(`🔑 Initializing SDK with key starting: ${key ? key.substring(0, 4) + '...' : 'undefined'}`);
    genAI = new GoogleGenerativeAI(key);
} catch (initErr) {
    console.error('⚠️ Failed to initialize GoogleGenerativeAI SDK:', initErr && initErr.message ? initErr.message : initErr);
    genAI = null;
}

function fallbackGenerateSchema(projectContext) {
    const header = '# Suggested MongoDB Schema\n\n';
    const users = `## users\n\n- _id: ObjectId\n- email: string (unique)\n- passwordHash: string\n- roles: [string]\n- createdAt: ISODate\n- updatedAt: ISODate\n\nExample:\n\n{\n  "email": "user@example.com",\n  "passwordHash": "$2b$...",\n  "roles": ["user"]\n}\n\n`;
    const projects = `## projects\n\n- _id: ObjectId\n- ownerId: ObjectId (ref users)\n- name: string\n- files: [{ path: string, content: string }]\n- createdAt: ISODate\n\n`;
    const indexes = `## Recommended Indexes\n\n- users: { email: 1 } (unique)\n- projects: { ownerId: 1 }\n\n`;
    return header + users + projects + indexes + '\n// Context summary:\n' + (projectContext ? projectContext.slice(0, 1000) : '(none)');
}

function fallbackGenerateAuth(projectContext) {
    return `# Auth scaffold (fallback)\n\nThis is a deterministic fallback auth scaffold for development and testing. Replace with a production-ready implementation when ready.\n\n## Overview\n- Express routes: /auth/register, /auth/login, /auth/me\n- Storage: MongoDB users collection with password hashes (bcrypt)\n- Session: JWT stored in Authorization header (Bearer)\n\n## Example code snippets\n\n// register (pseudo)\nPOST /auth/register\n{ email, password } -> create user with passwordHash\n\n// login (pseudo)\nPOST /auth/login\n{ email, password } -> verify password, return JWT\n\n// middleware (pseudo)\nfunction authMiddleware(req, res, next) {\n  const token = req.headers.authorization?.split(' ')[1];\n  // verify JWT and attach userId to req.user\n}\n\n// Notes:\n- Use bcrypt for password hashing\n- Use a short-lived access token with refresh tokens if needed\n\n// Context summary:\n${projectContext ? projectContext.slice(0, 1000) : '(none)'}\n`;
}

function isQuotaError(error) {
    return error && (
        error.status === 429 ||
        (error.message && (
            error.message.includes('429') ||
            error.message.toLowerCase().includes('quota') ||
            error.message.toLowerCase().includes('limit') ||
            error.message.toLowerCase().includes('exhausted')
        ))
    );
}

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
    } catch (e) { /* ignore */ }

    if (retryAfterSeconds !== null || status === 429 || isQuotaError(error)) {
        const message = retryAfterSeconds
            ? `Quota exceeded. Please retry in ${retryAfterSeconds}s.`
            : 'Quota exceeded. Please try again later.';

        if (fallbackContent) {
            const payload = { ...fallbackContent, fallback: true, message, retryAfterSeconds };
            return res.status(200).json(payload);
        }

        const payload = { error: message, details: message };
        if (retryAfterSeconds) payload.retryAfterSeconds = retryAfterSeconds;
        return res.status(429).json(payload);
    }

    return res.status(status).json({
        error: "AI Generation Failed",
        details: error && error.message ? error.message : String(error)
    });
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 5000 }));

const normalizeWorkspaceTarget = (targetPath, rootPath = workspaceRoot) => {
    const relativePath = path.normalize(targetPath).replace(/^[\\/]+/, '');
    const resolvedPath = path.resolve(rootPath, relativePath);
    if (!resolvedPath.startsWith(rootPath)) {
        throw new Error('Invalid target path outside workspace');
    }
    return resolvedPath;
};

app.post('/api/workspace/sync-and-build', async (req, res) => {
    try {
        const { targetPath, code, projectName } = req.body || {};
        if (!targetPath || typeof targetPath !== 'string' || typeof code !== 'string') {
            return res.status(400).json({ error: 'targetPath and code are required and must be strings' });
        }

        const projectPath = projectName ? resolveProjectDirectory(projectName) : workspaceRoot;
        const safePath = normalizeWorkspaceTarget(targetPath, projectPath);
        await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
        await fs.promises.writeFile(safePath, code, 'utf8');

        console.log(`📄 Written file to disk: ${safePath}`);

        let buildOutput = null;
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                buildOutput = await new Promise((resolve, reject) => {
                    exec('npm run build', {
                        cwd: projectPath,
                        env: { ...process.env },
                        maxBuffer: 1024 * 1024,
                    }, (error, stdout, stderr) => {
                        if (error) {
                            reject({ error, stdout, stderr });
                        } else {
                            resolve({ stdout, stderr });
                        }
                    });
                });
                console.log(`✅ Workspace build in ${projectName || 'root'} completed successfully`);
            } catch (buildErr) {
                console.warn(`⚠️ npm run build skipped or failed inside ${projectName || 'root'}:`, buildErr.message || buildErr);
            }
        }

        return res.json({ status: 'ok', path: safePath, workspaceRoot: projectPath, buildOutput });
    } catch (error) {
        console.error('❌ /api/workspace/sync-and-build failed:', error);
        const message = error && error.error ? error.error.message || error.message : error.message || String(error);
        return res.status(500).json({ error: 'Sync-and-build failed', details: message });
    }
});

app.post('/api/cache-codebase', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ cacheName: null, message: 'Generative AI SDK not initialized' });
        const { projectFiles } = req.body;

        if (!projectFiles || projectFiles.trim().length === 0) {
            return res.json({ cacheName: null, message: "No project files to cache" });
        }

        try {
            const model = "models/gemini-1.5-flash";
            const cache = await genAI.getGenerativeModel({ model }).createCachedContent({
                model,
                displayName: "Gemini_Architect_Context",
                systemInstruction: "You are a Senior Architect.",
                contents: [{ role: "user", parts: [{ text: projectFiles }] }],
                ttlSeconds: 3600,
            });
            console.log("Cache created successfully:", cache.name);
            return res.json({ cacheName: cache.name });
        } catch (cacheError) {
            console.warn("Caching not available or failed:", cacheError.message);
            return res.json({ cacheName: null, message: "Caching unavailable, will use direct API calls" });
        }
    } catch (error) {
        console.error("Cache endpoint error:", error);
        return res.status(500).json({ error: "Caching failed", details: error.message });
    }
});

app.post('/api/architect', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'Generative AI SDK not initialized' });
        const { prompt, projectContext, image, cacheName, selectedModel } = req.body;
        
        const targetModel = selectedModel ? `models/${selectedModel.replace(/^models\//, '')}` : "models/gemini-2.0-flash";
        const model = genAI.getGenerativeModel({ model: targetModel, cachedContent: cacheName || undefined });
        
        let parts = [{ text: `CONTEXT:\n${projectContext}\n\nUSER REQUEST: ${prompt}` }];
        if (image) {
            const base64Data = image.split(',')[1] || image;
            parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
        }
        
        const result = await model.generateContent({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } });
        return res.json(JSON.parse(result.response.text()));
    } catch (error) {
        return handleGeminiError(error, res);
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'Generative AI SDK not initialized' });
        const { message, history, projectContext, model: requestedModel } = req.body;

        const modelFallbackStack = [
            requestedModel ? `models/${requestedModel.replace(/^models\//, '')}` : "models/gemini-1.5-flash", 
            "models/gemini-1.5-flash",
            "models/gemini-2.0-flash",
            "models/gemini-1.5-pro"
        ];

        const baseSystemInstruction = `You are an advanced AI Code Editor Agent for K-Studio. Your job is to analyze the user's project context, look at any uploaded blueprints/images, and output production-ready code blocks. 
CRITICAL: You must always explicitly label code blocks with the exact target file path in the markdown header format: \`### path/to/file.ext\` followed by a valid code block, so the client-side parser can automatically capture and apply the file drafts.`;

        const fullSystemInstruction = projectContext
            ? `${baseSystemInstruction}\n\nHere is the current workspace project files tree and context:\n${projectContext}`
            : baseSystemInstruction;

        let replyText = null;
        let isExecuted = false;

        for (const modelIdentifier of modelFallbackStack) {
            if (isExecuted) break;
            try {
                console.log(`🤖 [AI Engine] Dispatching request payload to target branch: ${modelIdentifier}`);
                const modelInstance = genAI.getGenerativeModel({ 
                    model: modelIdentifier,
                    systemInstruction: fullSystemInstruction
                });

                const chatSession = modelInstance.startChat({ history: history || [] });
                const result = await chatSession.sendMessage(message);
                replyText = (await result.response).text();
                
                isExecuted = true;
                console.log(`✅ [AI Engine] Content compiled successfully via channel: ${modelIdentifier}`);
                break;
            } catch (layerError) {
                console.warn(`⚠️ [AI Engine Fallback Loop] Target vector ${modelIdentifier} bypassed or rate-limited.`);
            }
        }

        if (isExecuted && replyText) {
            return res.json({ reply: replyText });
        } else {
            throw new Error("All generative orchestration instances on the cluster pool are currently exhausted.");
        }
    } catch (error) {
        console.error("❌ Fatal Error in client context core chat endpoint:", error);
        return res.status(500).json({ error: error.message || "Internal core structural matrix compilation failure." });
    }
});

app.post('/api/generate-mongo-schema', async (req, res) => {
    const { projectContext } = req.body || {};
    if (!genAI) {
        const schema = fallbackGenerateSchema(projectContext || '');
        return res.json({ schema, fallback: true });
    }
    try {
        const modelInstance = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
        const promptParts = [{
            text: `Please produce a MongoDB schema (collections, example documents, and recommended indexes) based on the following project context. Reply in Markdown format.\n\nCONTEXT:\n${projectContext || '(no project context provided)'}`
        }];
        const result = await modelInstance.generateContent({ 
            contents: [{ role: 'user', parts: promptParts }], 
            generationConfig: { responseMimeType: 'text/plain' } 
        });
        return res.json({ schema: result.response.text() });
    } catch (error) {
        const fallbackSchema = fallbackGenerateSchema(projectContext || '');
        return handleGeminiError(error, res, { schema: fallbackSchema });
    }
});

app.post('/api/generate-auth', async (req, res) => {
    const { projectContext } = req.body || {};
    if (!genAI) {
        const auth = fallbackGenerateAuth(projectContext || '');
        return res.json({ auth, fallback: true });
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
        const promptParts = [{
            text: `Please produce a concise authentication scaffold for a Node.js + Express application using MongoDB for user storage and JWT for sessions. Include example routes, data model, and a brief explanation. Reply with code snippets and minimal text. Context:\n\n${projectContext || '(no project context provided)'}`
        }];
        const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }], generationConfig: { responseMimeType: 'text/plain' } });
        return res.json({ auth: result.response.text() });
    } catch (error) {
        const fallbackAuth = fallbackGenerateAuth(projectContext || '');
        return handleGeminiError(error, res, { auth: fallbackAuth });
    }
});

app.post('/api/ai/schema-builder', async (req, res) => {
    try {
        const { entityName, description, fields, targetFile, selectedModel } = req.body || {};
        if (!entityName) return res.status(400).json({ error: 'entityName is required' });

        const fileName = targetFile || `${entityName.toLowerCase()}Schema`;
        const finalFileName = fileName.endsWith('.js') ? fileName : `${fileName}.js`;
        const targetModel = selectedModel ? `models/${selectedModel.replace(/^models\//, '')}` : 'models/gemini-1.5-flash';
        const fallbackTemplate = `import mongoose from 'mongoose';\n\nconst ${entityName}Schema = new mongoose.Schema({\n  name: { type: String, required: true, index: true },\n  description: { type: String, default: "${(description || '').replace(/"/g, '\\"')}" },\n  status: { type: String, default: 'active' },\n  createdAt: { type: Date, default: Date.now },\n  updatedAt: { type: Date, default: Date.now }\n}, { timestamps: true });\n\n${entityName}Schema.index({ createdAt: -1 });\nexport const ${entityName} = mongoose.model('${entityName}', ${entityName}Schema);\n`;

        if (!genAI) return res.json({ success: true, filePath: `models/${finalFileName}`, code: fallbackTemplate, fallback: true });

        try {
            const modelInstance = genAI.getGenerativeModel({ model: targetModel });
            const prompt = `You are a Senior Backend Architect. Generate a high-performance production-ready Mongoose Schema in JavaScript (ESM format, using "import mongoose from 'mongoose'") for the entity "${entityName}" based on these fields: ${JSON.stringify(fields || {})} and description: "${description || ''}". Ensure it includes validation rules, relationships, index definitions, timestamps, and is fully commented. CRITICAL: Return ONLY the executable JavaScript code. Do NOT wrap it in markdown code blocks.`;
            const result = await modelInstance.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'text/plain' } });

            let rawCode = result.response.text().trim();
            if (rawCode.startsWith('```')) {
                rawCode = rawCode.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
            }
            return res.json({ success: true, filePath: `models/${finalFileName}`, code: rawCode.trim() });
        } catch (error) {
            return res.json({ success: true, filePath: `models/${finalFileName}`, code: fallbackTemplate, fallback: true });
        }
    } catch (fatalErr) {
        return res.status(500).json({ error: 'Internal schema runtime server crash.' });
    }
});

app.post('/api/ai/auth-scaffold', async (req, res) => {
    try {
        const { projectContext, selectedModel } = req.body || {};
        const resendKey = process.env.RESEND_API_KEY || 're_sandbox_key';
        const targetModel = selectedModel ? `models/${selectedModel.replace(/^models\//, '')}` : 'models/gemini-1.5-flash';
        const fallbackTemplate = `import express from 'express';\nimport bcrypt from 'bcryptjs';\nimport jwt from 'jsonwebtoken';\nimport { Resend } from 'resend';\n\nconst router = express.Router();\nconst resend = new Resend('${resendKey}');\nconst JWT_SECRET = process.env.JWT_SECRET || 'k-studio-super-secret-key';\n\nrouter.post('/signup', async (req, res) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Required fields missing' }); const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash(password, salt); res.status(201).json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });\nexport default router;`;

        if (!genAI) return res.json({ auth: fallbackTemplate, fallback: true });

        try {
            const modelInstance = genAI.getGenerativeModel({ model: targetModel });
            const prompt = `You are a Senior Security Engineer. Generate a full, complete Express.js route file (ESM format) for Authentication inside K-Studio. Requirements: POST routes for /signup and /login, bcryptjs hashing, jsonwebtoken signing, and Resend client initialized with: "${resendKey}". CRITICAL: Return ONLY clean executable code without markdown fences.`;
            const result = await modelInstance.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'text/plain' } });

            let rawCode = result.response.text().trim();
            if (rawCode.startsWith('```')) {
                rawCode = rawCode.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
            }
            return res.json({ auth: rawCode.trim() });
        } catch (error) {
            return res.json({ auth: fallbackTemplate, fallback: true });
        }
    } catch (fatalErr) {
        return res.status(500).json({ error: 'Internal orchestration server crash.' });
    }
});

app.post('/api/ai/execute-automation', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });

        const { prompt, history, projectContext } = req.body || {};
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const tempGenAI = new GoogleGenerativeAI(apiKey);
        const model = tempGenAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
        const chatHistory = (history || []).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.parts?.[0]?.text || m.content || String(m) }]
        }));

        const chat = model.startChat({
            history: chatHistory,
            systemInstruction: "You are the VSCodium core workbench executor loop..."
        });

        const result = await chat.sendMessage(`PROJECT CONTEXT:\n${projectContext || 'None'}\n\nAUTOMATION TASK: ${prompt}`);
        return res.json({ success: true, output: result.response.text(), message: "Automation loop executed successfully" });
    } catch (error) {
        if (isQuotaError(error)) {
            return res.json({ success: true, output: `## Automation Blueprint Output (Fallback Activated)`, fallback: true });
        }
        return res.status(500).json({ error: "Execute Automation Failed", details: error.message });
    }
});

app.post('/api/detect-project', (req, res) => {
    const { folderName, files } = req.body;
    const projectContext = req.body && req.body.projectContext ? req.body.projectContext : null;

    let port = projectPortMap.has(folderName) ? projectPortMap.get(folderName) : nextAvailablePort++;
    projectPortMap.set(folderName, port);

    const projectPath = resolveProjectDirectory(folderName);
    let type = 'static'; let framework = 'vanilla';

    try {
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };
            if (deps['next']) { type = 'next'; framework = 'nextjs'; }
            else if (deps['vite'] || deps['@tailwindcss/vite']) { type = 'vite'; framework = 'vite'; }
            else { type = 'node'; framework = 'nodejs'; }
        }
    } catch (e) { /* ignore */ }

    return res.json({ type, framework, port });
});

app.post('/api/run-project', async (req, res) => {
    const { projectName, projectType, port } = req.body;
    const projectPath = resolveProjectDirectory(projectName);

    if (activeProcesses.has(projectName) || activeStaticServers.has(projectName)) {
        stopProjectLogic(projectName);
    }

    const isWin = process.platform === 'win32';
    try {
        const { execSync } = await import('child_process');
        if (isWin) execSync(`npx kill-port ${port}`);
        else execSync(`lsof -t -i:${port} | xargs kill -9`);
    } catch (portErr) { /* port free */ }

    await new Promise(resolve => setTimeout(resolve, 500));

    if (projectType === 'static') {
        const staticApp = express();
        staticApp.use(express.static(projectPath));
        const server = staticApp.listen(port, () => console.log(`✅ Static server running safely on port ${port}`));
        activeStaticServers.set(projectName, { server, port });
        return res.json({ status: 'ready', url: `http://localhost:${port}` });
    }

    let command = isWin ? 'npm.cmd' : 'npm';
    let args = ['run', 'dev'];
    let env = { ...process.env, PORT: port.toString(), HOST: '127.0.0.1' };

    if (projectType === 'next') args = ['run', 'dev', '--', '-p', port.toString()];
    else if (projectType === 'vite') args = ['run', 'dev', '--', '--port', port.toString(), '--strictPort'];

    const child = spawn(command, args, { cwd: projectPath, env, shell: isWin });
    activeProcesses.set(projectName, child);

    const isReady = await checkPortReady(port, projectType === 'next' ? 60 : 30);
    return res.json({ status: isReady ? 'ready' : 'starting', url: `http://localhost:${port}` });
});

app.post('/api/stop-project', (req, res) => {
    const { projectName } = req.body;
    const stopped = stopProjectLogic(projectName);
    return res.json({ success: stopped, message: stopped ? `Stopped ${projectName}` : "No active process found" });
});

app.get('/*splat', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    return res.status(404).send('Frontend static assets are not compiled.');
});

const SERVER_PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 8080;
const httpServer = http.createServer(app);

if (process.env.DISABLE_AUTO_LISTEN !== '1') {
    httpServer.listen(SERVER_PORT, () => console.log(`Backend Online: Port ${SERVER_PORT}`));
}

export default app;
export { app, httpServer, genAI, fallbackGenerateSchema, fallbackGenerateAuth };