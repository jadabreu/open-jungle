const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');

const SRC_DIR = 'src';
const DIST_DIR = 'dist';
const BUILD_DIR = path.join(DIST_DIR, 'capy-tools');

// Files/directories to copy from src to dist
const COPY_PATHS = [
    'assets',
    'scripts',
    'styles',
    'window.html'
];

// Files/directories to exclude
const EXCLUDE_PATTERNS = [
    '.DS_Store',
    'Thumbs.db',
    '*.map',
    '*.log'
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanDist() {
    if (fsSync.existsSync(DIST_DIR)) {
        try {
            await fs.rm(DIST_DIR, { recursive: true, force: true });
            await sleep(500);
        } catch (error) {
            console.warn(`Warning: Could not remove dist directory: ${error.message}`);
        }
    }
    try {
        await fs.mkdir(DIST_DIR, { recursive: true });
        await sleep(100);
    } catch (error) {
        throw new Error(`Failed to create dist directory: ${error.message}`);
    }
}

async function copyFile(source, dest) {
    const maxRetries = 3;
    const retryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Ensure the destination directory exists
            const destDir = path.dirname(dest);
            if (!fsSync.existsSync(destDir)){
                await fs.mkdir(destDir, { recursive: true });
                await sleep(100);
            }

            // If destination exists and is a directory, remove it first
            if (fsSync.existsSync(dest)) {
                const stats = fsSync.statSync(dest);
                if (stats.isDirectory()) {
                    await fs.rm(dest, { recursive: true, force: true });
                    await sleep(100);
                }
            }

            // Read and write the file
            const content = await fs.readFile(source);
            await fs.writeFile(dest, content);
            return;
        } catch (err) {
            console.log(`Attempt ${attempt}/${maxRetries} failed to copy ${source}`);
            console.log(`Error details: ${err.message}`);
            
            if (attempt === maxRetries) {
                console.error(`Failed to copy file after ${maxRetries} attempts:`, source);
                throw err;
            }

            await sleep(retryDelay);
        }
    }
}

async function copyToDist() {
    // Copy files from src to dist
    for (const filePath of COPY_PATHS) {
        const sourcePath = path.join(SRC_DIR, filePath);
        const destPath = path.join(DIST_DIR, filePath);
        await copyRecursive(sourcePath, destPath);
    }

    // Copy manifest.json to dist from src/
    await copyFile(
        path.join(SRC_DIR, 'manifest.json'),
        path.join(DIST_DIR, 'manifest.json')
    );
}

async function copyRecursive(source, destination) {
    const currentSource = path.resolve(source);
    const currentDest = path.resolve(destination);
    
    if (!fsSync.existsSync(currentSource)) {
        console.warn(`Warning: ${currentSource} does not exist`);
        return;
    }

    try {
        if (!fsSync.existsSync(currentDest)) {
            await fs.mkdir(currentDest, { recursive: true });
            await sleep(100);
        }

        const stats = await fs.stat(currentSource);
        if (stats.isDirectory()) {
            const files = await fs.readdir(currentSource);
            for (const file of files) {
                if (EXCLUDE_PATTERNS.some(pattern => {
                    if (pattern.includes('*')) {
                        const regex = new RegExp(pattern.replace('*', '.*'));
                        return regex.test(file);
                    }
                    return file === pattern;
                })) {
                    continue;
                }
                
                await copyRecursive(
                    path.join(currentSource, file),
                    path.join(currentDest, file)
                );
            }
        } else {
            await copyFile(currentSource, currentDest);
        }
    } catch (error) {
        console.error(`Error processing ${currentSource}:`, error);
        throw error;
    }
}

// Create a zip file for Chrome Web Store
function createZip() {
    const output = fsSync.createWriteStream(path.join(DIST_DIR, 'extension.zip'));
    const archive = archiver('zip', { zlib: { level: 9 }});

    return new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(DIST_DIR, false);
        archive.finalize();
    });
}

async function build() {
    try {
        console.log('Cleaning dist directory...');
        await cleanDist();

        console.log('Copying files to dist...');
        await copyToDist();

        console.log('Creating zip file...');
        await createZip();

        console.log('Build complete!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

// Start the build process
build();