# Suggested MongoDB Schema

## users

- _id: ObjectId
- email: string (unique)
- passwordHash: string
- roles: [string]
- createdAt: ISODate
- updatedAt: ISODate

Example:

{
  "email": "user@example.com",
  "passwordHash": "$2b$...",
  "roles": ["user"]
}

## projects

- _id: ObjectId
- ownerId: ObjectId (ref users)
- name: string
- files: [{ path: string, content: string }]
- createdAt: ISODate

## Recommended Indexes

- users: { email: 1 } (unique)
- projects: { ownerId: 1 }


// Context summary:

// File: kaif dev agency/.next/build/chunks/[root-of-the-server]__0d-m0h0._.js
module.exports = [
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/url [external] (url, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("url", () => require("url"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[project]/postcss.config.mjs [postcss] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const config = {
    plugins: {
        "@tailwindcss/postcss": {}
    }
};
const __TURBOPACK__default__export__ = config;
}),
"[turbopack-node]/transforms/transforms.ts [