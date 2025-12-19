# Server Setup Instructions

## Fixing Sharp Library Installation on Linux Server

If you see errors like:
```
Something went wrong installing the "sharp" module
Cannot find module '../build/Release/sharp.node'
```

Run these commands on your server:

```bash
cd /var/www/jobportal/backend/JobsStorm_backend

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall all dependencies (this will rebuild Sharp for Linux)
npm install

# If that doesn't work, try installing Sharp specifically for Linux
npm install --platform=linux --arch=x64 sharp

# Or rebuild Sharp
npm rebuild sharp

# Restart PM2
pm2 restart all
```

## Alternative: Disable Compression Temporarily

If Sharp continues to fail, the code will automatically fall back to uploading files without compression. The uploads will still work, but files won't be compressed before upload.

## Verify Installation

After installation, check if Sharp is working:
```bash
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions);"
```

If this works, Sharp is properly installed.

