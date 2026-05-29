import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.DISABLE_AUTO_LISTEN = '1';
process.env.FORCE_FALLBACK = '1';
// Ensure SDK won't be initialized in tests: clear any GEMINI API key
process.env.GEMINI_API_KEY = '';

import { app } from '../../api/index.js';

function listenOnEphemeral(app) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') return reject(new Error('Failed to get port'));
            const port = addr.port;
            resolve({ server, port });
        });
    });
}

test('generate-mongo-schema returns fallback when SDK missing', async (t) => {
    const { server, port } = await listenOnEphemeral(app);
    try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-mongo-schema`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectContext: 'sample context' }) });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.schema, 'Expected schema in response');
        assert.ok(data.fallback === true, 'Expected fallback flag when SDK missing');
    } finally {
        server.close();
    }
});

test('generate-auth returns fallback when SDK missing', async (t) => {
    const { server, port } = await listenOnEphemeral(app);
    try {
    const res = await fetch(`http://127.0.0.1:${port}/api/generate-auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectContext: 'auth context' }) });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.auth, 'Expected auth in response');
        assert.ok(data.fallback === true, 'Expected fallback flag when SDK missing');
    } finally {
        server.close();
    }
});
