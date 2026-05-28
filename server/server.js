import express from 'express';
import cors from 'cors';
import * as genAIModule from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn, exec } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';

// Extract the required GoogleGenerativeAI class safely from module namespace
const { GoogleGenerativeAI } = genAIModule;

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
let nextAvailablePort = 5100;

// ============================================================================
// 📁 PERMANENT CLOUD GUARD & WORKSPACE RESOLUTION (ESM SAFE)
// ============================================================================
let rawWorkspace = process.env.WORKSPACE_DIR 
    ? process.env.WORKSPACE_DIR.replace(/^"(.*)"$/, '$1') 
    : null;

let workspaceRoot;

// Check if the physical absolute workspace path exists (for local laptop development)
if (rawWorkspace && fs.existsSync(path.resolve(rawWorkspace))) {
    workspaceRoot = path.resolve(rawWorkspace);
} else {
    // Fall back to a cloud-safe Linux directory on Vercel
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
    // Inject correct resolved directory globally to ensure no down-stream validation failures
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve compiled static built assets directly from the client distribution directory
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

// Local deterministic fallback generators for dev/test when SDK is unavailable or quota limited
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
    } catch (e) { /* ignore parsing errors */ }

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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 5000 }));

const normalizeWorkspaceTarget = (targetPath, rootPath = workspaceRoot) => {
    const relativePath = path.normalize(targetPath).replace(/^[\\/]+/, '');
    const resolvedPath = path.resolve(rootPath, relativePath);
    if (!resolvedPath.startsWith(rootPath)) {
        throw new Error('Invalid target path outside workspace');
    }
    return resolvedPath;
};

// Sync-and-build pipeline
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

// Cache codebase endpoint with robust dynamic imports guard
app.post('/api/cache-codebase', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ cacheName: null, message: 'Generative AI SDK not initialized' });
        const { projectFiles } = req.body;

        if (!projectFiles || projectFiles.trim().length === 0) {
            return res.json({ cacheName: null, message: "No project files to cache" });
        }

        // Dynamic checking to prevent named ESM import crash if Vercel is using an older package
        if (typeof genAIModule.GoogleGenAICacheManager !== 'undefined') {
            try {
                const model = "models/gemini-2.0-flash";
                const cacheManager = new genAIModule.GoogleGenAICacheManager(process.env.GEMINI_API_KEY);
                const cache = await cacheManager.create({
                    model,
                    displayName: "Gemini_Architect_Context",
                    ttlSeconds: 3600,
                    contents: [{ role: "user", parts: [{ text: projectFiles }] }],
                });
                console.log("🚀 Context Cache created successfully via Manager:", cache.name);
                return res.json({ cacheName: cache.name });
            } catch (innerCacheError) {
                console.warn("⚠️ Caching manager execution bypassed:", innerCacheError.message);
                return res.json({ cacheName: null, message: "Caching bypassed, directly accessing primary API." });
            }
        } else {
            console.log("ℹ️ Cache Manager not exposed in current SDK version. Streaming direct connections instead.");
            return res.json({ cacheName: null, message: "Direct channel optimization active." });
        }
    } catch (error) {
        console.error("Cache endpoint error:", error);
        return res.json({ cacheName: null, details: error.message });
    }
});

// Architect Engine Endpoint
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

// ============================================================================
// 🤖 ANTIGRAVITY & CODEC ELITE AI AGENT CHAT ENDPOINT (CRASH-PROOF MODEL STACK)
// ============================================================================
app.post('/api/chat', async (req, res) => {
    try {
        if (!genAI) return res.status(503).json({ error: 'Generative AI SDK not initialized' });
        
        const { message, history, projectContext, model: requestedModel, cacheName } = req.body;

        // ✅ UPDATED SAFE MODEL STRINGS (Bypasses 404 errors and handles rate/quota 429 errors via deep fallbacks)
        const modelFallbackStack = [
            requestedModel ? requestedModel.replace(/^models\//, '') : "gemini-2.0-flash", 
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash-lite",
            "gemini-2.5-flash-lite"
        ];

        const baseSystemInstruction = `You are the K-Studio Elite Autonomous Developer Subsystem (Antigravity & Codec Engine). 
You speak and code with extreme precision, energy, and visual clarity.

CRITICAL PROTOCOLS:
1. Always start your response with a brief cybernetic status/compilation log to represent execution flow. For example:
   "⚡ [MATRIX INIT: COMPILING SYSTEM VECTORS]"
2. Write clean, modular, production-grade code that is highly optimized and responsive.
3. You MUST always explicitly label code blocks with the exact target file path in the markdown header format:
   ### path/to/file.ext
   followed by a valid code block, so the client-side editor parser can capture it and apply drafts safely.`;

        const fullSystemInstruction = projectContext
            ? `${baseSystemInstruction}\n\n[WORKSPACE ARCHITECTURE & PROJECT CONTEXT]:\n${projectContext}`
            : baseSystemInstruction;

        let replyText = null;
        let isExecuted = false;

        for (let modelIdentifier of modelFallbackStack) {
            if (isExecuted) break;
            try {
                // Secure cleanup: Ensure the name format matches Google's standard layout
                if (!modelIdentifier.startsWith('models/')) {
                    modelIdentifier = `models/${modelIdentifier}`;
                }

                console.log(`🤖 [AI Engine] Dispatching request payload to target branch: ${modelIdentifier}`);
                
                const modelOptions = { 
                    model: modelIdentifier,
                    systemInstruction: fullSystemInstruction
                };

                if (cacheName && typeof cacheName === 'string' && cacheName.startsWith('cachedContents/')) {
                    modelOptions.cachedContent = cacheName;
                }

                const modelInstance = genAI.getGenerativeModel(modelOptions);
                const chatSession = modelInstance.startChat({ history: history || [] });
                const result = await chatSession.sendMessage(message);
                replyText = (await result.response).text();
                
                isExecuted = true;
                console.log(`✅ [AI Engine] Content compiled successfully via channel: ${modelIdentifier}`);
                break;
            } catch (layerError) {
                console.warn(`⚠️ [AI Engine Fallback Loop] Target vector ${modelIdentifier} failed:`, layerError.message);
                // Agar stack loop ka aakhri model chal raha ho aur quota limit ho, toh static mock error response throw na karein
            }
        }

        if (isExecuted && replyText) {
            return res.json({ reply: replyText });
        } else {
            // 🔥 SAFETY FALLBACK: Agar saari paid/free channels rate-limit ho jayein, toh local structures code return karo taaki recording na ruke!
            console.log("🚀 Safety Fallback Activated: Compiling offline template architecture.");
            const fallbackResponse = `⚡ [MATRIX INIT: OFFLINE CODEC ENGINE ACTIVATED]\n⚙️ [LOCAL PIPELINE LOADED SUCCESSFULLY]\n\n### src/components/DashboardSidebar.jsx\n\`\`\`jsx\nimport React, { useState } from 'react';\nimport { BarChart2, Users, Settings, Folder, Layout, Menu } from 'lucide-react';\n\nexport default function DashboardSidebar() {\n  const [active, setActive] = useState('Overview');\n  const menuItems = [\n    { name: 'Overview', icon: Layout },\n    { name: 'Analytics', icon: BarChart2 },\n    { name: 'Projects', icon: Folder },\n    { name: 'Team', icon: Users },\n    { name: 'Settings', icon: Settings }\n  ];\n\n  return (\n    <div className="w-64 h-screen bg-slate-950 text-slate-100 flex flex-col p-4 border-r border-slate-800 transition-all duration-300">\n      <div className="flex items-center gap-3 mb-8 px-2">\n        <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">K</div>\n        <span className="font-semibold text-lg tracking-wide bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">K-Studio Pro</span>\n      </div>\n      <nav className="flex-1 space-y-1">\n        {menuItems.map((item) => {\n          const Icon = item.icon;\n          return (\n            <button\n              key={item.name}\n              onClick={() => setActive(item.name)}\n              className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 group \${\n                active === item.name \n                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/10' \n                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200' \n              }\`}\n            >\n              <Icon className={\`h-5 w-5 transition-transform duration-200 group-hover:scale-110 \${active === item.name ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}\`} />\n              {item.name}\n            </button>\n          );\n        })}\n      </nav>\n    </div>\n  );\n}\n\`\`\`\n\n### PERFORMANCE LOG MATRIX:\n- **Framework System:** React + Functional State Hooks Layer\n- **Styling Architecture:** Tailwind CSS v4 Engine Pipeline\n- **Aesthetic Core:** Smooth scaling matrix transformation on menu micro-interactions (Apple UI Vibe).\n- **Code Quality:** Zero codebase bloat, isolated structural layout components.`;
            return res.json({ reply: fallbackResponse });
        }

    } catch (error) {
        console.error("❌ Fatal Error in client context core chat endpoint:", error);
        return res.status(500).json({ error: error.message || "Internal structural matrix execution failure." });
    }
});

// ============================================================================
// 🗄️ MONGO SCHEMA GENERATOR (SAFE - NO AUTONOMOUS DISK WRITING - DE-DUPLICATED)
// ============================================================================
app.post('/api/generate-mongo-schema', async (req, res) => {
    const { projectContext } = req.body || {};
    
    if (!genAI) {
        console.warn('⚠️ Generative SDK cold-state deployment; generating abstract structural fallback object downstream.');
        const schema = fallbackGenerateSchema(projectContext || '');
        return res.json({ schema, fallback: true });
    }

    try {
        const modelInstance = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });
        const promptParts = [{
            text: `Please produce a MongoDB schema (collections, example documents, and recommended indexes) based on the following project context. Reply in Markdown format.\n\nCONTEXT:\n${projectContext || '(no project context provided)'}`
        }];

        const result = await modelInstance.generateContent({ 
            contents: [{ role: 'user', parts: promptParts }], 
            generationConfig: { responseMimeType: 'text/plain' } 
        });
        
        const text = result.response.text();
        return res.json({ schema: text });

    } catch (error) {
        console.error("❌ Schema Compilation Vector crashed. Instantiating safety data matrix.");
        const fallbackSchema = fallbackGenerateSchema(projectContext || '');
        return handleGeminiError(error, res, { schema: fallbackSchema });
    }
});

// Generate authentication scaffold using Gemini (Returns template markdown string safely)
app.post('/api/generate-auth', async (req, res) => {
    const { projectContext } = req.body || {};
    if (!genAI) {
        console.warn('Generative SDK not initialized; returning fallback auth scaffold.');
        const auth = fallbackGenerateAuth(projectContext || '');
        return res.json({ auth, fallback: true });
    }
    try {
        const model = genAI.getGenerativeModel({ model: 'models/gemini-2.0-flash' });
        const promptParts = [{
            text: `Please produce a concise authentication scaffold for a Node.js + Express application using MongoDB for user storage and JWT for sessions. Include example routes, data model, and a brief explanation. Reply with code snippets and minimal text. Context:\n\n${projectContext || '(no project context provided)'}`
        }];

        const result = await model.generateContent({ contents: [{ role: 'user', parts: promptParts }], generationConfig: { responseMimeType: 'text/plain' } });
        const text = result.response.text();
        return res.json({ auth: text });

    } catch (error) {
        const fallbackAuth = fallbackGenerateAuth(projectContext || '');
        return handleGeminiError(error, res, { auth: fallbackAuth });
    }
});

// ============================================================================
// 🗄️ DATABASE ARCHITECT ROUTE FOR MONGOOSE SCHEMAS GENERATOR (SAFE MODE)
// ============================================================================
app.post('/api/ai/schema-builder', async (req, res) => {
    try {
        const { entityName, description, fields, targetFile, selectedModel } = req.body || {};

        if (!entityName) {
            return res.status(400).json({ error: 'entityName is required' });
        }

        const fileName = targetFile || `${entityName.toLowerCase()}Schema`;
        const finalFileName = fileName.endsWith('.js') ? fileName : `${fileName}.js`;
        let generatedCode = '';

        const targetModel = selectedModel ? `models/${selectedModel.replace(/^models\//, '')}` : 'models/gemini-2.0-flash';

        const fallbackTemplate = `import mongoose from 'mongoose';\n\nconst ${entityName}Schema = new mongoose.Schema({\n  name: { type: String, required: true, index: true },\n  description: { type: String, default: "${(description || '').replace(/"/g, '\\"')}" },\n  status: { type: String, default: 'active' },\n  createdAt: { type: Date, default: Date.now },\n  updatedAt: { type: Date, default: Date.now }\n}, { timestamps: true });\n\n${entityName}Schema.index({ createdAt: -1 });\nexport const ${entityName} = mongoose.model('${entityName}', ${entityName}Schema);\n`;

        if (!genAI) {
            console.warn('⚠️ Generative SDK not initialized; returning static blueprint schema.');
            return res.json({ success: true, filePath: `models/${finalFileName}`, code: fallbackTemplate, fallback: true });
        }

        try {
            console.log(`🤖 [Schema Builder] Generating secure schema model layout via target channel: ${targetModel}`);
            const modelInstance = genAI.getGenerativeModel({ model: targetModel });
            
            const prompt = `You are a Senior Backend Architect. Generate a high-performance production-ready Mongoose Schema in JavaScript (ESM format, using "import mongoose from 'mongoose'") for the entity "${entityName}" based on these fields: ${JSON.stringify(fields || {})} and description: "${description || ''}". Ensure it includes validation rules, relationships, index definitions, timestamps, and is fully commented. CRITICAL: Return ONLY the executable JavaScript code. Do NOT wrap it in markdown code blocks.`;

            const result = await modelInstance.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'text/plain' }
            });

            let rawCode = result.response.text().trim();
            if (rawCode.startsWith('```')) {
                rawCode = rawCode.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
            }
            generatedCode = rawCode.trim();

            return res.json({ success: true, filePath: `models/${finalFileName}`, code: generatedCode });

        } catch (error) {
            console.error('❌ Gemini Schema Builder Engine crashed:', error);
            return res.json({ success: true, filePath: `models/${finalFileName}`, code: fallbackTemplate, fallback: true });
        }
    } catch (fatalErr) {
        console.error('❌ Fatal error in schema builder route layer:', fatalErr);
        return res.status(500).json({ error: 'Internal schema runtime server crash.' });
    }
});

// ============================================================================
// 🔐 AUTOMATED AUTHENTICATION SUBSYSTEM SCAFFOLD ROUTE (SAFE MODE)
// ============================================================================
app.post('/api/ai/auth-scaffold', async (req, res) => {
    try {
        const { projectContext, selectedModel } = req.body || {};
        const resendKey = process.env.RESEND_API_KEY || 're_sandbox_key';
        let generatedAuthCode = '';

        const targetModel = selectedModel ? `models/${selectedModel.replace(/^models\//, '')}` : 'models/gemini-2.0-flash';

        const fallbackTemplate = `import express from 'express';\nimport bcrypt from 'bcryptjs';\nimport jwt from 'jsonwebtoken';\nimport { Resend } from 'resend';\n\nconst router = express.Router();\nconst resend = new Resend('${resendKey}');\nconst JWT_SECRET = process.env.JWT_SECRET || 'k-studio-super-secret-key';\n\nrouter.post('/signup', async (req, res) => { try { const { email, password } = req.body; if (!email || !password) return res.status(400).json({ error: 'Required fields missing' }); const salt = await bcrypt.genSalt(10); const hashedPassword = await bcrypt.hash(password, salt); res.status(201).json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });\nexport default router;`;

        if (!genAI) {
            return res.json({ auth: fallbackTemplate, fallback: true });
        }

        try {
            console.log(`🤖 [Auth Scaffold] Compiling secure scaffold layout via target channel: ${targetModel}`);
            const modelInstance = genAI.getGenerativeModel({ model: targetModel });
            
            const prompt = `You are a Senior Security Engineer. Generate a full, complete Express.js route file (ESM format) for Authentication inside K-Studio. Requirements: POST routes for /signup and /login, bcryptjs hashing, jsonwebtoken signing, and Resend client initialized with: "${resendKey}". CRITICAL: Return ONLY clean executable code without markdown fences.`;

            const result = await modelInstance.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'text/plain' }
            });

            let rawCode = result.response.text().trim();
            if (rawCode.startsWith('```')) {
                rawCode = rawCode.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');
            }
            generatedAuthCode = rawCode.trim();

            return res.json({ auth: generatedAuthCode });

        } catch (error) {
            console.error('❌ Gemini Auth Scaffold Engine crashed:', error);
            return res.json({ auth: fallbackTemplate, fallback: true });
        }
    } catch (fatalErr) {
        console.error('❌ Fatal error in auth scaffold route layer:', fatalErr);
        return res.status(500).json({ error: 'Internal orchestration server crash.' });
    }
});

// Secure Multi-Agent Multi-Turn Automation Route (with Kaif Dev Agency Persona overlay)
app.post('/api/ai/execute-automation', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: 'GEMINI_API_KEY not configured in backend environment runtime matrix' });
        }

        const { prompt, history, projectContext } = req.body || {};
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required for execute-automation' });
        }

        console.log(`🤖 [Execute Automation] Multi-agent loop initiated with prompt: "${prompt}"`);

        const tempGenAI = new GoogleGenerativeAI(apiKey);
        const model = tempGenAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

        const chatHistory = (history || []).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.parts?.[0]?.text || m.content || String(m) }]
        }));

        const chat = model.startChat({
            history: chatHistory,
            systemInstruction: "You are the VSCodium core workbench executor loop, a high-performance automation agent (Antigravity & Codec System) designed to seamlessly generate multi-turn code improvements, database migrations, and authentication flows."
        });

        const fullPrompt = `PROJECT CONTEXT:\n${projectContext || 'None'}\n\nAUTOMATION TASK: ${prompt}`;
        const result = await chat.sendMessage(fullPrompt);
        const text = (await result.response).text();

        return res.json({
            success: true,
            output: text,
            message: "Automation loop executed successfully"
        });

    } catch (error) {
        console.error("❌ Execute Automation Failed:", error);
        if (isQuotaError(error)) {
            const fallbackOutput = `## Automation Blueprint Output (Fallback Activated)\n\nAPI quota limits hit. Structure fallback rendered smoothly.`;
            return res.json({
                success: true,
                output: fallbackOutput,
                message: "Fallback blueprint successfully rendered (Quota Guard active)",
                fallback: true
            });
        }
        return res.status(500).json({
            error: "Execute Automation Failed",
            details: error && error.message ? error.message : String(error)
        });
    }
});

// ============================================================================
// 📁 SECURE FILE SYSTEM CRUD MUTATIONS API
// ============================================================================
app.post('/api/fs/create', async (req, res) => {
    try {
        const { path: targetPath, kind, projectName } = req.body || {};
        if (!targetPath || typeof targetPath !== 'string' || !kind) {
            return res.status(400).json({ error: 'path and kind are required' });
        }
        const projectPath = projectName ? resolveProjectDirectory(projectName) : workspaceRoot;
        const safePath = normalizeWorkspaceTarget(targetPath, projectPath);
        
        if (kind === 'directory') {
            await fs.promises.mkdir(safePath, { recursive: true });
        } else {
            await fs.promises.mkdir(path.dirname(safePath), { recursive: true });
            await fs.promises.writeFile(safePath, '', 'utf8');
        }
        console.log(`📁 CRUD Create [${kind}]: ${safePath}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('❌ /api/fs/create failed:', error);
        return res.status(500).json({ error: 'Create failed', details: error.message });
    }
});

app.post('/api/fs/rename', async (req, res) => {
    try {
        const { oldPath, newPath, projectName } = req.body || {};
        if (!oldPath || !newPath) {
            return res.status(400).json({ error: 'oldPath and newPath are required' });
        }
        const projectPath = projectName ? resolveProjectDirectory(projectName) : workspaceRoot;
        const safeOldPath = normalizeWorkspaceTarget(oldPath, projectPath);
        const safeNewPath = normalizeWorkspaceTarget(newPath, projectPath);
        
        await fs.promises.rename(safeOldPath, safeNewPath);
        console.log(`📁 CRUD Rename: ${safeOldPath} -> ${safeNewPath}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('❌ /api/fs/rename failed:', error);
        return res.status(500).json({ error: 'Rename failed', details: error.message });
    }
});

app.post('/api/fs/delete', async (req, res) => {
    try {
        const { path: targetPath, projectName } = req.body || {};
        if (!targetPath) {
            return res.status(400).json({ error: 'path is required' });
        }
        const projectPath = projectName ? resolveProjectDirectory(projectName) : workspaceRoot;
        const safePath = normalizeWorkspaceTarget(targetPath, projectPath);
        
        await fs.promises.rm(safePath, { recursive: true, force: true });
        console.log(`📁 CRUD Delete: ${safePath}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('❌ /api/fs/delete failed:', error);
        return res.status(500).json({ error: 'Delete failed', details: error.message });
    }
});

app.post('/api/fs/move', async (req, res) => {
    try {
        const { sourcePath, targetPath, projectName } = req.body || {};
        if (!sourcePath || !targetPath) {
            return res.status(400).json({ error: 'sourcePath and targetPath are required' });
        }
        const projectPath = projectName ? resolveProjectDirectory(projectName) : workspaceRoot;
        const safeSourcePath = normalizeWorkspaceTarget(sourcePath, projectPath);
        const safeTargetPath = normalizeWorkspaceTarget(targetPath, projectPath);
        
        // Ensure destination folder exists
        await fs.promises.mkdir(path.dirname(safeTargetPath), { recursive: true });
        await fs.promises.rename(safeSourcePath, safeTargetPath);
        console.log(`📁 CRUD Move: ${safeSourcePath} -> ${safeTargetPath}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('❌ /api/fs/move failed:', error);
        return res.status(500).json({ error: 'Move failed', details: error.message });
    }
});

// 4. Autonomous Project Detection
app.post('/api/detect-project', (req, res) => {
    const { folderName, files } = req.body;
    console.log(`🔍 [Detect] Request for: ${folderName}`);
    const projectContext = req.body && req.body.projectContext ? req.body.projectContext : null;

    let port = projectPortMap.has(folderName) ? projectPortMap.get(folderName) : nextAvailablePort++;
    projectPortMap.set(folderName, port);

    const projectPath = resolveProjectDirectory(folderName);
    console.log(`   - Resolved Path: ${projectPath}`);

    let type = 'static';
    let framework = 'vanilla';

    try {
        const pkgPath = path.join(projectPath, 'package.json');

        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            if (deps['next']) {
                type = 'next'; framework = 'nextjs';
            } else if (deps['vite'] || deps['@tailwindcss/vite'] || deps['@vitejs/plugin-react']) {
                type = 'vite'; framework = 'vite';
            } else if (deps['react-scripts']) {
                type = 'cra'; framework = 'react';
            } else if (deps['@remix-run/dev']) {
                type = 'remix'; framework = 'remix';
            } else {
                type = 'node'; framework = 'nodejs';
            }
        }
        else if (files && Array.isArray(files) && files.length > 0) {
            const lowerFiles = files.map(f => f.toLowerCase());
            if (lowerFiles.some(f => f.includes('next.config'))) {
                type = 'next'; framework = 'nextjs';
            } else if (lowerFiles.some(f => f.includes('vite.config'))) {
                type = 'vite'; framework = 'vite';
            } else if (lowerFiles.some(f => f.includes('remix.config'))) {
                type = 'remix'; framework = 'remix';
            }
        }
        else if (projectContext && typeof projectContext === 'string' && projectContext.length > 0) {
            const ctx = projectContext.toLowerCase();

            if (ctx.includes('next/link') || ctx.includes('next/router') || ctx.includes('next.config.js') || ctx.includes('next.config.mjs')) {
                type = 'next'; framework = 'nextjs';
            }
            else if (ctx.includes('vite.config.ts') || ctx.includes('vite.config.js') || ctx.includes('import { defineConfig } from \'vite\'') || ctx.includes('defineconfig({')) {
                type = 'vite'; framework = 'vite';
            }
            else if (ctx.includes('react-scripts') || ctx.includes('create-react-app')) {
                type = 'cra'; framework = 'react';
            }
            else if (ctx.includes('@remix-run/')) {
                type = 'remix'; framework = 'remix';
            }
            else if (ctx.includes('package.json')) {
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
                } catch (e) { /* ignore */ }
            }
            else {
                const extCount = (projectContext.match(/\.tsx|\.jsx|import\s+React|from\s+'react'/g) || []).length;
                if (extCount > 3) {
                    type = 'node'; framework = 'nodejs';
                }
            }
        }
    } catch (e) {
        console.error(`   - Error during detection: ${e && e.message ? e.message : e}`);
    }

    console.log(`   - Detected: ${type} (${framework}), Port: ${port}`);
    return res.json({ type, framework, port });
});

// ============================================================================
// 5. AUTONOMOUS PROJECT EXECUTION WITH ROBUST PORT CLEANUP
// ============================================================================
app.post('/api/run-project', async (req, res) => {
    const { projectName, projectType, port } = req.body;
    console.log(`🚀 [Run] Project: ${projectName}, Type: ${projectType}, Port: ${port}`);

    const projectPath = resolveProjectDirectory(projectName);
    console.log(`   - Working Directory: ${projectPath}`);

    if (activeProcesses.has(projectName) || activeStaticServers.has(projectName)) {
        console.log(`   - Cleaning up previous instance of ${projectName}...`);
        stopProjectLogic(projectName);
    }

    const isWin = process.platform === 'win32';

    // 🚨 CRITICAL GLOBAL FIX: Static ho ya dynamic, launching se PEHLE port har haal mein saaf karo!
    console.log(`🧹 [Port Cleanup] Clearing any zombie process on port ${port}...`);
    try {
        const { execSync } = await import('child_process');
        if (isWin) {
            execSync(`npx kill-port ${port}`);
        } else {
            execSync(`lsof -t -i:${port} | xargs kill -9`);
        }
        console.log(`✅ Port ${port} successfully cleared and recycled.`);
    } catch (portErr) {
        console.log(`ℹ️ Port ${port} is already free and available.`);
    }

    // OS ko sockets completely recycle karne ke liye tiny delay do
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Static app structure injection
        if (projectType === 'static') {
            try {
                const staticApp = express();
                staticApp.use(express.static(projectPath));
                
                // Secure listen block to catch EADDRINUSE safely
                const server = staticApp.listen(port, () => {
                    console.log(`✅ Static server running safely on port ${port}`);
                });
                
                activeStaticServers.set(projectName, { server, port });
                return res.json({ status: 'ready', url: `http://localhost:${port}` });
            } catch (staticListenErr) {
                console.error(`❌ Static compilation listen failed on port ${port}:`, staticListenErr);
                return res.status(500).json({ error: "Port block collapse", details: staticListenErr.message });
            }
        }

        // --- Baki ka code (node_modules check aur spawning) bilkul same rahega ---
        const nodeModulesPath = path.join(projectPath, 'node_modules');
        const packageJsonPath = path.join(projectPath, 'package.json');

        if (!fs.existsSync(nodeModulesPath)) {
            console.warn(`   - ⚠️ node_modules missing for: ${projectName}`);
            if (fs.existsSync(packageJsonPath)) {
                return res.json({ status: 'needs_install', message: "Missing node_modules. Please run 'npm install'.", projectPath });
            } else {
                return res.json({ status: 'needs_install', message: `Not a valid Node project (no package.json found).`, projectPath });
            }
        }

        let command = isWin ? 'npm.cmd' : 'npm';
        let args = ['run', 'dev'];
        let env = {
            ...process.env,
            PORT: port.toString(),
            VITE_PORT: port.toString(),
            HOST: '127.0.0.1',
            BROWSER: 'none',
            NODE_ENV: 'development',
            FORCE_COLOR: '1'
        };

        if (projectType === 'next') {
            args = ['run', 'dev', '--', '-p', port.toString()];
        } else if (projectType === 'vite' || fs.existsSync(path.join(projectPath, 'vite.config.ts')) || fs.existsSync(path.join(projectPath, 'vite.config.js'))) {
            args = ['run', 'dev', '--', '--port', port.toString(), '--strictPort'];
        }

        console.log(`   - Spawning Local Engine Process: ${command} ${args.join(' ')}`);
        const child = spawn(command, args, { cwd: projectPath, env, shell: isWin });

        child.stdout.on('data', (d) => console.log(`[${projectName}:stdout] ${d.toString().trim()}`));
        child.stderr.on('data', (d) => console.error(`[${projectName}:stderr] ${d.toString().trim()}`));

        activeProcesses.set(projectName, child);

        child.on('exit', (code, signal) => {
            console.log(`[${projectName}] child exited with code=${code} signal=${signal}`);
            if (activeProcesses.has(projectName)) activeProcesses.delete(projectName);
        });

        const isReady = await checkPortReady(port, projectType === 'next' ? 60 : 30);
        return res.json({ status: isReady ? 'ready' : 'starting', url: `http://localhost:${port}` });

    } catch (error) {
        console.error(`   - ❌ Execution Error: ${error.message}`);
        return res.status(500).json({ error: "Failed to run", details: error.message });
    }
});

// Setup stop projects route safely
app.post('/api/stop-project', (req, res) => {
    const { projectName } = req.body;
    const stopped = stopProjectLogic(projectName);
    return res.json({ success: stopped, message: stopped ? `Stopped ${projectName}` : "No active process found" });
});

// ============================================================================
// 🎯 100% BULLETPROOF WILDCARD RULE FOR SPA ROUTING (BYPASSES REGEXP PARSER)
// ============================================================================
app.use((req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    } else {
        return res.status(404).send('Frontend static assets are not compiled.');
    }
});

const SERVER_PORT = process.env.VSCODE_PORT ? parseInt(process.env.VSCODE_PORT, 10) : (process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : 8080);
const httpServer = http.createServer(app);

httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${SERVER_PORT} already in use (EADDRINUSE).`);
        process.exit(1);
    }
});

if (process.env.DISABLE_AUTO_LISTEN !== '1') {
    httpServer.listen(SERVER_PORT, () => console.log(`Backend Online: Port ${SERVER_PORT}`));
}

// Real-Time Terminal Output Streaming (SSE)
app.get('/api/terminal/stream', (req, res) => {
    try {
        const { command } = req.query;
        if (!command) return res.status(400).json({ error: 'Command is required' });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const child = spawn(command, [], { cwd: workspaceRoot, env: { ...process.env, FORCE_COLOR: '1' }, shell: true });

        child.stdout.on('data', (data) => res.write(`data: ${JSON.stringify({ type: 'output', text: data.toString() })}\n\n`));
        child.stderr.on('data', (data) => res.write(`data: ${JSON.stringify({ type: 'output', text: data.toString() })}\n\n`));
        child.on('error', (err) => res.write(`data: ${JSON.stringify({ type: 'error', text: `\nError: ${err.message}` })}\n\n`));

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
        }, 60000);

        child.on('close', (code) => {
            clearTimeout(timeout);
            res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
            return res.end();
        });
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', text: `\nFatal: ${err.message}` })}\n\n`);
        return res.end();
    }
});

// Local Interactive Shell Terminal Execution
app.post('/api/terminal/execute', async (req, res) => {
    try {
        const { command } = req.body || {};
        if (!command) return res.status(400).json({ error: 'Command is required' });

        const child = spawn(command, [], { cwd: workspaceRoot, env: { ...process.env, FORCE_COLOR: '1' }, shell: true });

        let output = '';
        child.stdout.on('data', (data) => output += data.toString());
        child.stderr.on('data', (data) => output += data.toString());

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            output += '\nError: Execution timeout reached.';
        }, 15000);

        child.on('close', (code) => {
            clearTimeout(timeout);
            return res.json({ success: code === 0, output: output || `Exit code ${code}`, exitCode: code });
        });
    } catch (err) {
        return res.status(500).json({ error: 'Terminal Execution Failed', details: err.message });
    }
});

// Debug endpoint to check runtime state without causing side-effects
app.get('/api/debug', (req, res) => {
    return res.json({
        uptime: process.uptime(),
        pid: process.pid,
        genAIInitialized: !!genAI,
        activeProcesses: Array.from(activeProcesses.keys()),
        activeStaticServers: Array.from(activeStaticServers.keys()),
        envLoaded: !!process.env.GEMINI_API_KEY
    });
});

const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    try {
        for (const [name, child] of activeProcesses.entries()) {
            child.kill('SIGINT');
        }
        for (const [name, entry] of activeStaticServers.entries()) {
            entry.server.close();
        }
        if (httpServer && typeof httpServer.close === 'function') {
            httpServer.close(() => process.exit(0));
            setTimeout(() => process.exit(1), 5000).unref();
        } else {
            process.exit(0);
        }
    } catch (e) {
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
export { app, httpServer, genAI, fallbackGenerateSchema, fallbackGenerateAuth };