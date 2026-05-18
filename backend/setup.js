const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, 'storage');

// Delete old storage if exists
if (fs.existsSync(STORAGE_DIR)) {
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
}

// Create fresh storage directory
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// Create document.json
const documentContent = {
  content: "# Living Document\n\n## 🔴 Active Issues\n*No active issues yet.*\n\n## ✅ Resolved Issues\n*No resolved issues yet.*\n\n## 🏗️ Architecture Decisions\n*No decisions recorded yet.*",
  lastUpdated: new Date().toISOString()
};
fs.writeFileSync(path.join(STORAGE_DIR, 'document.json'), JSON.stringify(documentContent, null, 2), 'utf8');

// Create messages.json
fs.writeFileSync(path.join(STORAGE_DIR, 'messages.json'), JSON.stringify([], null, 2), 'utf8');

// Create activity.json
fs.writeFileSync(path.join(STORAGE_DIR, 'activity.json'), JSON.stringify([], null, 2), 'utf8');

console.log('✅ Storage files created successfully!');
console.log('📍 Location:', STORAGE_DIR);