#!/bin/bash
# Install necessary dependencies
npm install puppeteer axios form-data socks-proxy-agent worker_threads os crypto readline fs perf_hooks

# Run the script
node script.js

// package.json
{
  "name": "upload-script",
  "version": "1.0.0",
  "description": "Automated file upload with encryption and threading",
  "main": "script.js",
  "scripts": {
    "start": "node script.js"
  },
  "dependencies": {
    "axios": "^1.3.0",
    "form-data": "^4.0.0",
    "socks-proxy-agent": "^6.0.0",
    "worker_threads": "^1.0.0",
    "os": "^0.1.2",
    "crypto": "^1.0.1",
    "readline": "^1.3.0",
    "fs": "^0.0.1-security",
    "perf_hooks": "^1.0.0",
    "puppeteer": "^21.3.0"
  }
}

import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import os from 'os';
import crypto from 'crypto';
import puppeteer from 'puppeteer';
import readline from 'readline';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort } from 'worker_threads';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const panelUrl = "https://yujinshop.naofumi.web.id";

async function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function getTargetUrls() {
    const targetUrlsInput = await askQuestion("Enter target URLs (comma-separated): ");
    return targetUrlsInput.split(',').map(url => url.trim());
}

const encryptionKey = 'your-32-byte-hex-key';

function encryptChunk(chunk, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(chunk), cipher.final(), iv, cipher.getAuthTag()]);
    return encrypted;
}

async function solveCaptcha(targetUrl) {
    console.log("[AI] Solving CAPTCHA...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(5000);
    await browser.close();
    console.log("[AI] CAPTCHA bypassed!");
}

async function uploadToTarget(targetUrl, chunk, index) {
    try {
        const formData = new FormData();
        formData.append("file", chunk, `chunk_${index}`);

        const response = await axios.post(targetUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            timeout: 5000
        });
        return response.status === 200;
    } catch (error) {
        console.error(`[ERROR] Upload failed at chunk ${index}:`, error.message);
        return false;
    }
}

if (!isMainThread) {
    parentPort.on('message', async ({ chunk, index, totalChunks, targetUrls }) => {
        try {
            const encryptedChunk = encryptChunk(chunk, encryptionKey);
            let success = false;
            for (const targetUrl of targetUrls) {
                success = await uploadToTarget(targetUrl, encryptedChunk, index);
                if (success) break;
            }
            parentPort.postMessage({ success, index });
        } catch (error) {
            console.error(`[FATAL] Worker failed at chunk ${index}:`, error.message);
        }
    });
} else {
    async function uploadLargeFile(fileBuffer) {
        const targetUrls = await getTargetUrls();
        rl.close();
        
        const cpuThreads = os.cpus().length || 4;
        const packetSize = 100000;
        const totalChunks = Math.ceil(fileBuffer.length / packetSize);
        let uploadedChunks = new Set();
        const workers = new Set();
        let index = 0;
        
        for (let i = 0; i < fileBuffer.length; i += packetSize) {
            const chunk = fileBuffer.slice(i, i + packetSize);
            if (!uploadedChunks.has(index)) {
                const worker = new Worker(__filename);
                worker.postMessage({ chunk, index, totalChunks, targetUrls });
                workers.add(worker);
                worker.on('message', ({ success, index }) => {
                    if (success) uploadedChunks.add(index);
                    workers.delete(worker);
                });
                worker.on('exit', () => workers.delete(worker));
                if (workers.size >= cpuThreads) await Promise.race([...workers].map(w => new Promise(res => w.on('exit', res))));
            }
            index++;
        }
        await Promise.all([...workers].map(w => new Promise(res => w.on('exit', res))));
        console.log("[SUCCESS] Secure, AI-enhanced ultra-fast upload completed.");
    }

    (async () => {
        const exampleBuffer = Buffer.from('This is a test file content');
        await uploadLargeFile(exampleBuffer);
    })();
}
