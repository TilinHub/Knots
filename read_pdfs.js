
import fs from 'fs';
import * as pdfLib from 'pdf-parse';
import path from 'path';

console.log('pdfLib exports:', Object.keys(pdfLib));
// Try to find the function
const pdf = pdfLib.default || pdfLib;
// If pdf is not a function, we will fail later, but logs will help.

const papersDir = path.join(process.cwd(), 'papers');
const files = fs.readdirSync(papersDir).filter(f => f.endsWith('.pdf'));

async function readPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    try {
        const data = await pdf(dataBuffer);
        console.log(`\n\n--- START OF ${path.basename(filePath)} ---\n`);
        // Limit text length to avoid overflow? or just print it all and let the agent read it via truncation?
        // 20k chars per file max to start.
        console.log(data.text.slice(0, 20000));
        console.log(`\n--- END OF ${path.basename(filePath)} ---\n`);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e.message);
    }
}

async function main() {
    for (const file of files) {
        await readPdf(path.join(papersDir, file));
    }
}

main();
