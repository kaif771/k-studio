
// Native fetch is available in Node.js 18+
// This file is treated as a module due to package.json "type": "module"

async function testChat() {
    console.log("Testing /api/chat endpoint...");
    try {
        const response = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Hello from test script",
                history: []
            })
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            console.error(`Response: ${text}`);
            process.exit(1);
        }

        const data = await response.json();
        console.log("Success! Reply received:", data.reply);
    } catch (error) {
        console.error("Fetch connection failed:", error);
        process.exit(1);
    }
}

testChat();
