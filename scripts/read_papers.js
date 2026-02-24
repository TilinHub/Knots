import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const papersDir = path.join(__dirname, '../papers');

async function readPdfs() {
    const files = fs.readdirSync(papersDir).filter(f => f.endsWith('.pdf'));
    for (const file of files) {
        console.log(`\n\n--- Reading ${file} ---\n`);
        const dataBuffer = fs.readFileSync(path.join(papersDir, file));
        try {
            const data = await pdf(dataBuffer);
            console.log(data.text.substring(0, 2000)); // First 2000 chars to get an idea
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }
}

readPdfs();
