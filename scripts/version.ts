import fs from 'fs-extra';
import path from 'path';

async function updateVersion(newVersion: string): Promise<void> {
  try {
    // Update package.json
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = await fs.readJson(packagePath);
    packageJson.version = newVersion;
    await fs.writeJson(packagePath, packageJson, { spaces: 2 });

    // Update manifest.json
    const manifestPath = path.join(__dirname, '../src/manifest.json');
    const manifestJson = await fs.readJson(manifestPath);
    manifestJson.version = newVersion;
    await fs.writeJson(manifestPath, manifestJson, { spaces: 2 });

    console.log(`Version updated to ${newVersion} in package.json and manifest.json`);
  } catch (error) {
    console.error('Error updating version:', (error as Error).message);
    process.exit(1);
  }
}

// Get version from command line argument
const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Please provide a version number');
  process.exit(1);
}

updateVersion(newVersion);