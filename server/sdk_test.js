import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testSDK() {
    console.log("Testing Gemini SDK directly...");
    console.log("Using API Key starting with:", process.env.GEMINI_API_KEY?.substring(0, 10));

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        console.log("Sending simple prompt...");
        const result = await model.generateContent("Say hello!");
        const response = await result.response;
        console.log("Success! Response:", response.text());

        console.log("Testing chat session...");
        const chat = model.startChat({ history: [] });
        const chatResult = await chat.sendMessage("Hi again!");
        const chatResponse = await chatResult.response;
        console.log("Chat Success! Response:", chatResponse.text());

    } catch (error) {
        console.error("SDK Test Failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
    }
}

testSDK();
