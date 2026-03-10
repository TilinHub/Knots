const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const srcDir = path.join(__dirname, 'src');

walkDir(srcDir, (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Fix "cs/" internal imports that were moved one level deeper
    if (filePath.replace(/\\/g, '/').includes('core/geometry/cs/')) {
        content = content.replace(/from '\.\.\/types/g, "from '../../types");
        content = content.replace(/from '\.\.\/\.\.\/app/g, "from '../../../app");
    }

    // 2. Fix "hull/" internal imports that were moved one level deeper
    if (filePath.replace(/\\/g, '/').includes('core/geometry/hull/')) {
        content = content.replace(/from '\.\.\/types/g, "from '../../types");
        // hull/robustHull.ts imports contactGraph from its old geometry/ location
        content = content.replace(/from '\.\/contactGraph'/g, "from '../envelope'");
    }

    // 3. Fix "validation/" internal imports
    if (filePath.replace(/\\/g, '/').includes('core/geometry/validation/')) {
        content = content.replace(/from '\.\.\/contactGraph'/g, "from '../envelope'");
    }

    // 4. Fix "curve/" internal imports (outerFace.ts)
    if (filePath.replace(/\\/g, '/').includes('core/geometry/curve/')) {
        content = content.replace(/from '\.\.\/types/g, "from '../../types");
    }

    // 5. Global replaces for envelope files
    // If a file outside geometry/envelope imports contactGraph, collision, ElasticEnvelope, EnvelopeComputer
    // the path used to end in /contactGraph', now it should end in /envelope'
    // Let's replace the last part of the import path.
    // Make sure not to replace inside envelope/ itself relative internal imports unless they are './xyz'.

    // Replace: from '.../core/geometry/contactGraph' => from '.../core/geometry/envelope'
    content = content.replace(/from '([^']+(?:\/|\\\\)core(?:\/|\\\\)geometry)(?:\/|\\\\)(contactGraph|collision|ElasticEnvelope|EnvelopeComputer)'/g, "from '$1/envelope'");

    // Fix imports from `@/core/geometry/contactGraph` -> `@/core/geometry/envelope`
    content = content.replace(/from '(@(?:\/|\\\\)core(?:\/|\\\\)geometry)(?:\/|\\\\)(contactGraph|collision|ElasticEnvelope|EnvelopeComputer)'/g, "from '$1/envelope'");

    // Fix cs/csTransitions.ts importing from envelope
    if (filePath.replace(/\\/g, '/').includes('core/geometry/cs/')) {
        content = content.replace(/from '\.\.\/contactGraph'/g, "from '../envelope'");
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated:', filePath);
    }
});
