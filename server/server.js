import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("Gemini API Key loaded:", !!process.env.GEMINI_API_KEY);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', port: 5000 }));

// 1. Logic to Create/Refresh Context Cache
app.post('/api/cache-codebase', async (req, res) => {
    try {
        const { projectFiles } = req.body;
        // Use a specific model version that definitely supports caching
        const model = "gemini-1.5-flash-001";

        console.log("Creating cache for model:", model);

        // Create an explicit cache (Valid for 1 hour by default)
        const cache = await genAI.getGenerativeModel({ model }).createCachedContent({
            model,
            displayName: "Gemini_Architect_Context",
            systemInstruction: "You are a Senior Architect. Use the provided frontend context to design matching backends.",
            contents: [{ role: "user", parts: [{ text: projectFiles }] }],
            ttlSeconds: 3600,
        });

        console.log("Cache created successfully:", cache.name);
        res.json({ cacheName: cache.name });
    } catch (error) {
        console.error("Caching Error Details:", error);
        res.status(500).json({ error: "Caching failed", details: error.message });
    }
});

// 2. The Main Architect Route (Deep Reasoning)
app.post('/api/architect', async (req, res) => {
    try {
        const { prompt, projectContext, image, cacheName } = req.body;
        console.log("Architect received prompt:", prompt, "hasImage:", !!image);

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: {
                parts: [{
                    text: `You are Gemini Architect 3.0, a Full-Stack Autonomous AI Agent with DIRECT file system access.
            
            CORE DIRECTIVE:
            - You are NOT a typical chatbot. You are an AGENT that builds software.
            - NEVER say "I cannot create files" or "Since I don't have access to your directory".
            - YOU HAVE FULL ACCESS to create, delete, and modify files in the user's workspace through this interface.
            
            AUTONOMOUS AGENT CAPABILITIES:
            - Generate COMPLETE, production-ready codebases.
            - Create ALL necessary files (index.html, styles.css, server.js, models, routes).
            - Ensure every state variable, API call, and schema is perfectly synced.
            
            DEEP REASONING PROTOCOL:
            Before writing code, "think" through:
            - DATA RELATIONSHIPS: Design efficient MongoDB schemas.
            - SECURITY: Implement JWT/RBAC based on UI requirements.
            - SCALABILITY: Optimize project structure.
            
            OUTPUT FORMAT (MANDATORY):
            You MUST return a JSON object. Do not include any text before or after the JSON.
            {
                "thought": "Internal architectural reasoning.",
                "plan": "Detailed implementation roadmap including markdown code blocks for the user to see.",
                "files": [
                    { "path": "ui/index.html", "content": "..." },
                    { "path": "server/index.js", "content": "..." }
                ]
            }
            Ensure the 'files' array contains EVERYTHING needed to run the app.`
                }]
            },
            cachedContent: cacheName || undefined,
        });

        let parts = [{ text: `CONTEXT:\n${projectContext}\n\nUSER REQUEST: ${prompt}` }];

        if (image) {
            const base64Data = image.split(',')[1] || image;
            const mimeType = image.split(';')[0].split(':')[1] || 'image/png';
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            });
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const responseText = result.response.text();
        console.log("Architect thought process complete.");

        res.json(JSON.parse(responseText));
    } catch (error) {
        console.error("Architect Error:", error);
        res.status(500).json({ error: "AI Architect failed to reason.", details: error.message });
    }
});

// 3. General Chat Endpoint (Multimodal)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, image, cacheName } = req.body;
        console.log("Chat request received:", { message, historyLength: history?.length, hasImage: !!image, cacheName });

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: {
                parts: [{
                    text: `You are Gemini Architect Assistant. 
            When suggesting code, always provide clear file headers like '### filename.ext' followed by code blocks.
            Your frontend is an autonomous agent that will automatically save these blocks to the user's workspace.`
                }]
            }
        });

        const chat = model.startChat({
            history: history || []
        });

        let result;
        if (image) {
            console.log("Processing image in chat...");
            // Remove header "data:image/jpeg;base64," if present
            const base64Data = image.split(',')[1] || image;
            const mimeType = image.split(';')[0].split(':')[1] || 'image/png';

            result = await chat.sendMessage([
                message,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]);
        } else {
            result = await chat.sendMessage(message);
        }

        const response = await result.response;
        res.json({ reply: response.text() });
    } catch (error) {
        console.error('Chat Error:', error);
        res.status(500).json({
            error: "Chat failed",
            details: error.message,
            suggestion: error.message.includes("429") ? "Quota exceeded. Please try again later." : "Check API key and model status."
        });
    }
});

app.listen(5000, () => console.log('Backend Online: Port 5000'));