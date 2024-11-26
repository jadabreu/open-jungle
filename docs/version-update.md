# Version Update Guide

This guide explains how to properly update the version of the Open Jungle Forecast Extractor Chrome extension.

## When to Update the Version

You should update the version number when:

- Adding new features (minor version update: 1.1.0 -> 1.2.0)
- Fixing bugs (patch version update: 1.1.0 -> 1.1.1)
- Making breaking changes (major version update: 1.1.0 -> 2.0.0)

## Steps to Update Version

1. **Update Version Numbers in Source Files**

   - Update the version in `src/manifest.json`
   - Update the version in `package.json`
   - Make sure both files have the same version number

2. **Clean and Rebuild**

   ```bash
   # Clean the dist directory
   npm run clean

   # Build the extension
   npm run build
   ```

3. **Verify the Build**

   - Check that a new `extension.zip` file has been created
   - The zip file should contain the updated version in its manifest.json

4. **Upload to Chrome Web Store**
   - Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Find the Open Jungle Forecast Extractor
   - Click "Package" in the left sidebar
   - Upload the new `extension.zip` file
   - Update the description to mention what's new in this version
   - Submit for review

## Version Number Format

We follow semantic versioning (MAJOR.MINOR.PATCH):

- MAJOR: Breaking changes
- MINOR: New features, backwards compatible
- PATCH: Bug fixes, backwards compatible

Example: 1.2.0

- 1: Major version
- 2: Minor version
- 0: Patch version

## Common Issues

1. **Version Number Error on Upload**
   If you get an error saying "Invalid version number in manifest", make sure:

   - You've updated the version in `src/manifest.json`, not just the root manifest
   - The new version is higher than the currently published version
   - You've rebuilt the extension after updating the version

2. **Build Issues**
   If the build fails:
   - Make sure all version numbers match
   - Try running `npm install` to ensure dependencies are up to date
   - Clean the dist directory and rebuild
