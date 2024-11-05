const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');

const SOURCE_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist');

async function createZip() {
  return new Promise((resolve, reject) => {
    // Remove any existing zip file first
    const zipPath = path.join(DIST_DIR, 'extension.zip');
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const stats = fs.statSync(zipPath);
      console.log(`Extension has been zipped successfully (${(stats.size / 1024).toFixed(2)} KB)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add only necessary files
    const filesToInclude = [
      'manifest.json',
      'window.html',
      'background.bundle.js',
      'content.bundle.js',
      'styles',
      'assets'
    ];

    filesToInclude.forEach(file => {
      const filePath = path.join(DIST_DIR, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          archive.directory(filePath, file);
        } else {
          archive.file(filePath, { name: file });
        }
      }
    });

    archive.finalize();
  });
}

async function build() {
  try {
    // Clean dist directory
    await fs.emptyDir(DIST_DIR);

    // Copy static files
    await fs.copy(path.join(SOURCE_DIR, 'manifest.json'), path.join(DIST_DIR, 'manifest.json'));
    await fs.copy(path.join(SOURCE_DIR, 'window.html'), path.join(DIST_DIR, 'window.html'));
    await fs.copy(path.join(SOURCE_DIR, 'styles'), path.join(DIST_DIR, 'styles'));
    await fs.copy(path.join(SOURCE_DIR, 'assets'), path.join(DIST_DIR, 'assets'));

    console.log('Static files copied successfully');

    // Create zip if --package flag is present
    if (process.argv.includes('--package')) {
      await createZip();
    }
  } catch (err) {
    console.error('Error during build:', err);
    process.exit(1);
  }
}

build();