const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');

async function buildZip() {
  const distPath = path.join(__dirname, '../dist');
  const zipPath = path.join(__dirname, '../extension.zip');

  // Remove existing zip if it exists
  await fs.remove(zipPath).catch(() => {});

  // Create a write stream
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  return new Promise<void>((resolve, reject) => {
    output.on('close', () => {
      console.log('Extension has been zipped successfully');
      resolve();
    });

    archive.on('error', (err: Error) => {
      console.error('Failed to create zip:', err);
      reject(err);
    });

    archive.pipe(output);
    archive.directory(distPath, false);
    archive.finalize();
  });
}

async function main() {
  try {
    await buildZip();
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();