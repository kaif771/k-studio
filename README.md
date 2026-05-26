Gemini Architect 3.0: Walkthrough
Overview
We built a Multimodal AI Architect that can analyze your codebase and even your visual diagrams to generate full-stack code.

Key Features
Neon Cyberpunk UI: A premium dark-mode interface with pink/blue gradients and glassmorphism.
Context-Aware: The AI reads your project files (
useProjectContext
).
Multimodal: Upload a blueprint/diagram, and the AI will code it (
AIChatbot
 + Paperclip).
Safe Execution: It generates a plan before writing code.
How to Run
Setup Environment:

Open 
c:\google-ai.env
 (or create it).
Add your key: GEMINI_API_KEY=AIzaSy...
Start Backend:

cd server
node server.js
Expected Output: Backend Online: Port 8080

Start Frontend:

cd ..
npm run dev
Open http://localhost:5173