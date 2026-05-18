require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const STORAGE = path.join(__dirname, '../storage');
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const SESSIONS_DIR = path.join(STORAGE, 'sessions');

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const FAST_MODEL = "gemini-3.1-flash-lite";

async function ensureDirectories() {
  await fs.mkdir(STORAGE, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.json', '.csv', '.pdf', '.docx', '.js', '.py', '.html', '.css', '.xml', '.yaml', '.yml'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowedTypes.includes(ext) ? cb(null, true) : cb(new Error('File type not supported'));
  }
});

const io = {
  read: async (f) => {
    try {
      return JSON.parse(await fs.readFile(path.join(STORAGE, f), 'utf8'));
    } catch {
      return null;
    }
  },
  write: async (f, d) => fs.writeFile(path.join(STORAGE, f), JSON.stringify(d, null, 2))
};

async function initStorage() {
  try {
    await ensureDirectories();
    
    const messages = await io.read('messages.json');
    if (!messages) await io.write('messages.json', []);
    
    const document = await io.read('document.json');
    if (!document) {
      const initialDoc = {
        content: '',
        lastUpdated: new Date().toISOString(),
        title: 'Notes'
      };
      await io.write('document.json', initialDoc);
    }
    
    const activity = await io.read('activity.json');
    if (!activity) await io.write('activity.json', []);
    
  } catch (error) {
    console.error('Storage init error:', error);
  }
}

async function addActivity(action, type = 'evolution', agent = 'system') {
  let logs = await io.read('activity.json');
  if (!logs || !Array.isArray(logs)) {
    logs = [];
  }
  logs.unshift({ action, type, timestamp: new Date().toISOString(), agent });
  const trimmedLogs = logs.slice(0, 100);
  await io.write('activity.json', trimmedLogs);
}

async function extractFileText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const stats = await fs.stat(filePath);
  const fileSizeKB = Math.round(stats.size / 1024);
  
  const textExtensions = ['.txt', '.md', '.json', '.csv', '.js', '.py', '.html', '.css', '.xml', '.yaml', '.yml'];
  if (textExtensions.includes(ext)) {
    const content = await fs.readFile(filePath, 'utf8');
    const truncated = content.length > 5000 ? content.slice(0, 5000) + '\n...[truncated]' : content;
    return { fullText: content, preview: truncated, type: 'text', size: fileSizeKB };
  }
  
  if (ext === '.pdf') {
    return {
      fullText: `[PDF Document: ${path.basename(originalName)} - ${fileSizeKB} KB]`,
      preview: `📄 **PDF Document: ${path.basename(originalName)}**\n\nSize: ${fileSizeKB} KB`,
      type: 'pdf',
      size: fileSizeKB
    };
  }
  
  return {
    fullText: `[File: ${originalName} - ${fileSizeKB} KB]`,
    preview: `📎 **File: ${originalName}**\n\nSize: ${fileSizeKB} KB`,
    type: 'unknown',
    size: fileSizeKB
  };
}

function isUserAskingForCode(userMessage) {
  const lowerMsg = userMessage.toLowerCase();
  
  const codingPatterns = [
    /\b(code|program|script|function|class|component)\b/i,
    /\b(html|css|javascript|js|python|react|vue|angular|node|express)\b/i,
    /\b(build|create|make|write|develop)\s+(a|an)?\s*(website|app|application|webpage|component|function)/i,
    /\b(fix|debug|repair|correct)\s+(my|the)?\s*(code|script|program)/i,
    /\b(algorithm|data structure|api|endpoint|database|query|sql)\b/i,
    /\b(implement|add|create)\s+(a|an)?\s*(feature|functionality|method|endpoint)/i,
    /\b(how to|help me)\s+(code|program|build|create)\b/i,
    /\b(what'?s wrong with|why isn'?t)\s+(my|the)?\s*(code|script)/i,
    /\b(example|sample)\s+(code|implementation|script)/i,
    /\b(web|frontend|backend|full[-\s]?stack)\s+(development|design)/i,
    /\b(responsive|layout|flexbox|grid|animation)\s+(design|css)/i,
    /\b(component|state|props|hooks|context|redux)\b/i,
    /\b(api|fetch|axios|request|response|json)\s+(call|request|endpoint)/i,
    /^(can you|please)\s+(write|create|make|build|generate)\s+(a|an)?\s*(code|script|program|function|class)/i,
    /\b(need|want)\s+(a|an)?\s*(code|script|program|function)\b/i,
  ];
  
  for (const pattern of codingPatterns) {
    if (pattern.test(lowerMsg)) {
      return true;
    }
  }
  
  return false;
}

async function getAllSessions() {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        const data = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf8');
        const session = JSON.parse(data);
        sessions.push({
          id: sessionId,
          title: session.title || 'Untitled Chat',
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages?.length || 0,
          pinned: session.pinned || false
        });
      }
    }
    sessions.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return sessions;
  } catch (error) {
    console.error('Error getting sessions:', error);
    return [];
  }
}

async function getSession(sessionId) {
  try {
    // Validate sessionId to prevent path traversal
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      return null;
    }
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function saveSession(sessionId, sessionData) {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error('Invalid session ID');
  }
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
}

async function createNewSession(title = 'New Chat') {
  const sessionId = Date.now().toString();
  const newSession = {
    id: sessionId,
    title: title,
    pinned: false,
    messages: [],
    document: {
      content: '',
      lastUpdated: new Date().toISOString(),
      title: 'Notes'
    },
    activity: [],
    canvasFiles: [],
    timelineNodes: [],
    branches: [],
    nextBranchNumber: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await saveSession(sessionId, newSession);
  return sessionId;
}

async function deleteSession(sessionId) {
  if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    throw new Error('Invalid session ID');
  }
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  await fs.unlink(filePath);
}

async function generateChatTitle(messages) {
  if (!messages || messages.length === 0) return 'New Chat';
  
  const historyText = messages.slice(0, 3).map(msg => 
    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
  ).join('\n');
  
  try {
    const model = genAI.getGenerativeModel({ model: FAST_MODEL });
    const prompt = `Based on this conversation, generate a VERY SHORT title (2-4 words max). Return ONLY the title, no quotes, no explanation:

${historyText}

Title:`;
    
    const result = await model.generateContent(prompt);
    let title = result.response.text().trim();
    title = title.replace(/["']/g, '').slice(0, 40);
    return title || 'New Chat';
  } catch (error) {
    console.error('Title generation error:', error);
    return 'New Chat';
  }
}

// ========== SSE ==========
const clients = [];

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);
  
  req.on('close', () => {
    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) clients.splice(index, 1);
  });
});

function broadcastEvent(data) {
  clients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      console.error('Broadcast error:', e);
    }
  });
}

// ========== STREAMING CHAT ENDPOINT (MAIN) ==========
app.post('/api/chat/stream', async (req, res) => {
  const { message, sessionId, fileContext } = req.body;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    let session = await getSession(sessionId);
    let isNewSession = false;
    if (!session) {
      const newSessionId = await createNewSession();
      session = await getSession(newSessionId);
      isNewSession = true;
    }
    
    const msgs = session.messages || [];
    const isCodingRequest = isUserAskingForCode(message);
    
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    msgs.push(userMsg);
    
    broadcastEvent({
      type: 'activity',
      activity: {
        action: `💬 User: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
        agent: 'user'
      }
    });
    
    const model = genAI.getGenerativeModel({ model: FAST_MODEL });
    
    let historyText = "";
    if (msgs && msgs.length > 0) {
      const lastMessages = msgs.slice(-10);
      for (let i = 0; i < lastMessages.length; i++) {
        const msg = lastMessages[i];
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        historyText += `${role}: ${msg.content}\n`;
      }
    }
    
    let fileContextText = "";
    if (fileContext) {
      fileContextText = `\n\nUser uploaded file: ${fileContext.fileName}\nPreview: ${fileContext.preview}\n`;
    }
    
    let prompt = "";
    
    if (isCodingRequest) {
      prompt = `You are Butler, a helpful AI coding assistant.

CONVERSATION HISTORY:
${historyText}

Current user: ${message}
${fileContextText}

INSTRUCTIONS:
- Provide code in \`\`\` blocks with language specified
- Be conversational and helpful
- Do NOT use gendered language
- Explain the code you provide

Respond directly:`;
    } else {
      prompt = `You are Butler, a helpful AI assistant. Have a natural conversation.

CONVERSATION HISTORY:
${historyText}

Current user: ${message}
${fileContextText}

RULES:
- Be helpful and conversational
- Do NOT use gendered language
- Keep responses natural and engaging
- Use markdown formatting for better readability (## headers, **bold**, - lists)
- You have no access to any notes or document system

Respond naturally:`;
    }
    
    const result = await model.generateContentStream(prompt);
    
    let fullResponse = "";
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      res.write(`data: ${JSON.stringify({ content: chunkText })}\n\n`);
    }
    
    // Clean up response for non-coding requests
    let finalResponse = fullResponse;
    if (!isCodingRequest) {
      finalResponse = fullResponse.replace(/```[\s\S]*?```/g, '');
      finalResponse = finalResponse.replace(/`([^`]+)`/g, '"$1"');
    }
    finalResponse = finalResponse.trim();
    
    msgs.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date().toISOString()
    });
    
    broadcastEvent({
      type: 'activity',
      activity: {
        action: `🤖 Butler: Generated response`,
        timestamp: new Date().toISOString(),
        agent: 'fast-brain'
      }
    });
    
    // Generate title for new sessions or default titles
    const defaultTitles = ['New Chat', 'Untitled Chat', 'Notes', 'Document'];
    if ((isNewSession || defaultTitles.includes(session.title)) && msgs.length >= 2) {
      const newTitle = await generateChatTitle(msgs);
      if (newTitle && newTitle !== 'New Chat') {
        session.title = newTitle;
        res.write(`data: ${JSON.stringify({ sessionTitle: newTitle })}\n\n`);
      }
    }
    
    session.messages = msgs;
    session.updatedAt = new Date().toISOString();
    await saveSession(sessionId || session.id, session);
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ========== JANITOR LIVE ENDPOINT (SECRETARY MODE) ==========
app.post('/api/janitor-live', async (req, res) => {
  const { text, currentDocument, sessionId } = req.body;
  
  console.log('🔴 Secretary mode processing:', text?.slice(0, 100));
  
  if (!text || text.length < 5) {
    return res.json({});
  }
  
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }
  
  try {
    // Get the session to update timestamp later
    let session = await getSession(sessionId);
    if (!session) {
      // Create session if it doesn't exist
      const newSessionId = await createNewSession();
      session = await getSession(newSessionId);
    }
    
    const model = genAI.getGenerativeModel({ model: FAST_MODEL });
    
    const existingContent = currentDocument?.content || '';
    const existingTitle = currentDocument?.title || 'Notes';
    
    const prompt = `You are an agentic documentation system. Update the notes based on this conversation excerpt.

CONVERSATION: "${text}"

${existingContent ? `EXISTING NOTES:\n${existingContent}\n` : ''}

GUIDING PRINCIPLES (not rigid rules):
1. EXTRACT SIGNAL FROM NOISE - Document decisions, options, facts, preferences, plans, problems, solutions. Ignore casual chat like greetings or filler.

2. HONOR CURRENT FOCUS - What's being actively discussed goes to the top. Previous discussions move down. The document should read like a conversation's memory - most relevant first.

3. EVOLVE, DON'T JUST APPEND - New information should UPDATE or RESTRUCTURE, not just add. When an option becomes a decision, CHANGE how it's presented. When context shifts, REORGANIZE to match. Summarize old information instead of deleting it.

4. LET STRUCTURE EMERGE FROM CONTENT - Look at WHAT you're documenting and HOW things relate:
   - Comparisons → Tables or pros/cons
   - Sequences → Timelines or numbered steps
   - Attributes → Property lists or specs
   - Decisions → Decision records
   Let the information SHOW you how it wants to be organized. Never force a template.

5. KEEP IT SCANNABLE - A human should grasp the state of things in 10 seconds. Use formatting (bold, tables, lists) to make important information pop. Avoid walls of text.

6. PRESERVE CONTEXT, NOT CONVERSATION - Don't record who said what unless it matters. Don't record exact wording unless it's worth quoting. Record the ESSENCE - what was established, decided, or learned.

7. HANDLE TOPIC DRIFT GRACEFULLY - Main conversation gets main document. If the user goes fully off-topic, create a "## 🧵 Off-Topic" section at the bottom and move unrelated tangents there. If off-topic becomes the new main topic, promote it to the top.

8. NO METADATA - Never include timestamps, "last updated", or any breadcrumbs about when or how information was added. The document should feel like it always existed.

9. When the AI suggests multiple possibilities, list them as "**Options Considered**" or "**Possibilities**"
   - When user chooses or agrees to something, mark it as the primary decision and move the other options to a section at the bottom or remove them if they are no longer relevant
   - When user rejects something, remove it

CRITICAL: The document is a silent background process. Never reference it, never mention "notes" or "document" or "recording" in the output. Just return the updated notes as if they naturally evolved from the conversation.

Return ONLY the updated markdown notes. No explanations, no metadata, no references to the document itself.`;

    const result = await model.generateContent(prompt);
    let updatedContent = result.response.text();
    
    updatedContent = updatedContent.replace(/```markdown\s*/g, '');
    updatedContent = updatedContent.replace(/```\s*$/g, '');
    updatedContent = updatedContent.trim();
    
    if (updatedContent && updatedContent !== existingContent) {
      // Extract title from first # heading if it exists and isn't just "Notes"
      let newTitle = existingTitle;
      const titleMatch = updatedContent.match(/^# (.+)$/m);
      if (titleMatch && titleMatch[1] && titleMatch[1].length < 50 && titleMatch[1] !== 'Notes') {
        newTitle = titleMatch[1];
      }
      
      const newDocument = {
        content: updatedContent,
        lastUpdated: new Date().toISOString(),
        title: newTitle
      };
      
      // Update session with new document and timestamp
      session.document = newDocument;
      session.updatedAt = new Date().toISOString();
      await saveSession(sessionId, session);
      
      broadcastEvent({
        type: 'document_update',
        document: newDocument,
        changeType: 'modify',
        section: 'General'
      });
      
      res.json({
        updatedDocument: newDocument,
        changedSection: 'General'
      });
      return;
    }
    
    res.json({});
  } catch (error) {
    console.error('Live update error:', error);
    res.json({});
  }
});

// ========== NON-STREAMING CHAT (DEPRECATED - KEPT FOR COMPATIBILITY) ==========
app.post('/api/chat', async (req, res) => {
  const { message, fileContext, sessionId } = req.body;
  
  try {
    let session = await getSession(sessionId);
    if (!session) {
      const newSessionId = await createNewSession();
      session = await getSession(newSessionId);
    }
    
    const msgs = session.messages || [];
    const isCodingRequest = isUserAskingForCode(message);
    
    msgs.push({
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });
    
    broadcastEvent({
      type: 'activity',
      activity: {
        action: `💬 User: "${message.slice(0, 50)}${message.length > 50 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
        agent: 'user'
      }
    });
    
    let historyText = "";
    if (msgs && msgs.length > 0) {
      const lastMessages = msgs.slice(-10);
      for (let i = 0; i < lastMessages.length; i++) {
        const msg = lastMessages[i];
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        historyText += `${role}: ${msg.content}\n`;
      }
    }
    
    let fileContextText = "";
    if (fileContext) {
      fileContextText = `\n\nUser uploaded file: ${fileContext.fileName}\n`;
    }
    
    const model = genAI.getGenerativeModel({ model: FAST_MODEL });
    
    let prompt = "";
    if (isCodingRequest) {
      prompt = `You are Butler, a helpful AI coding assistant.

CONVERSATION HISTORY:
${historyText}

Current user: ${message}
${fileContextText}

INSTRUCTIONS:
- Provide code in \`\`\` blocks
- Be conversational and helpful
- Do NOT use gendered language

Respond directly:`;
    } else {
      prompt = `You are Butler, a helpful AI assistant.

CONVERSATION HISTORY:
${historyText}

Current user: ${message}
${fileContextText}

RULES:
- Be helpful and conversational
- Do NOT use gendered language
- Keep responses natural

Respond naturally:`;
    }
    
    const result = await model.generateContent(prompt);
    let aiResponse = result.response.text();
    aiResponse = aiResponse.replace(/\\n/g, '\n');
    
    if (!isCodingRequest) {
      aiResponse = aiResponse.replace(/```[\s\S]*?```/g, '');
      aiResponse = aiResponse.replace(/`([^`]+)`/g, '"$1"');
    }
    aiResponse = aiResponse.trim();
    
    msgs.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    });
    
    broadcastEvent({
      type: 'activity',
      activity: {
        action: `🤖 Butler: Generated response`,
        timestamp: new Date().toISOString(),
        agent: 'fast-brain'
      }
    });
    
    // Generate title for new sessions
    const defaultTitles = ['New Chat', 'Untitled Chat', 'Notes', 'Document'];
    if (defaultTitles.includes(session.title) && msgs.length >= 2) {
      const newTitle = await generateChatTitle(msgs);
      if (newTitle && newTitle !== 'New Chat') {
        session.title = newTitle;
      }
    }
    
    session.messages = msgs;
    session.updatedAt = new Date().toISOString();
    await saveSession(sessionId || session.id, session);
    
    res.json({
      reply: aiResponse,
      sessionTitle: session.title
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== BASIC ROUTES ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/messages', async (req, res) => {
  const messages = await io.read('messages.json');
  res.json(messages || []);
});

app.get('/api/document', async (req, res) => {
  const doc = await io.read('document.json');
  res.json(doc || { content: '', lastUpdated: new Date().toISOString(), title: 'Notes' });
});

app.get('/api/activity', async (req, res) => {
  const activities = await io.read('activity.json');
  res.json(activities || []);
});

// ========== SESSION ROUTES ==========
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { title } = req.body;
    const sessionId = await createNewSession(title || 'New Chat');
    res.json({ sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    let session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });
    
    Object.assign(session, updates);
    session.updatedAt = new Date().toISOString();
    
    await saveSession(sessionId, session);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    await deleteSession(req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== FILE UPLOAD ==========
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const filePath = path.join(UPLOADS_DIR, req.file.filename);
    const fileData = await extractFileText(filePath, req.file.originalname);
    
    res.json({ success: true, fileName: req.file.originalname, preview: fileData.preview });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sync', async (req, res) => {
  res.json({ message: 'Sync complete' });
});

app.post('/api/activity/log', async (req, res) => {
  const { action, agent } = req.body;
  if (action) {
    await addActivity(action, 'evolution', agent || 'system');
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Action required' });
  }
});

app.post('/api/generate-branch-name', async (req, res) => {
  const { userMessage, recentMessages } = req.body;
  
  try {
    const model = genAI.getGenerativeModel({ model: FAST_MODEL });
    
    let context = userMessage;
    if (recentMessages && recentMessages.length > 0) {
      context = `Recent conversation:\n${recentMessages}\n\nCurrent message: ${userMessage}`;
    }
    
    const prompt = `Generate a short, descriptive name (2-5 words) for a conversation branch based on this message.

MESSAGE: "${context}"

RULES:
- Return ONLY the name, no quotes, no explanations
- Name should capture the key topic or question
- Keep it under 40 characters
- Use title case (e.g., "API Design Discussion")
- Be specific, not generic

Examples:
- "PostgreSQL Setup" (not just "Database")
- "Authentication Flow" (not just "Security")
- "UI Component Architecture" (not just "Design")

Name:`;

    const result = await model.generateContent(prompt);
    let name = result.response.text().trim();
    name = name.replace(/["']/g, '').replace(/[.!?]$/g, '');
    name = name.replace(/^name:\s*/i, '');
    
    if (name.length > 45) {
      name = name.slice(0, 42) + '...';
    }
    
    if (!name || name.length < 3) {
      const words = userMessage.split(' ').slice(0, 3).join(' ');
      name = words.length > 35 ? words.slice(0, 32) + '...' : words;
    }
    
    res.json({ name: name });
  } catch (error) {
    console.error('Branch naming error:', error);
    const words = userMessage.split(' ').slice(0, 3).join(' ');
    const fallbackName = words.length > 35 ? words.slice(0, 32) + '...' : words;
    res.json({ name: fallbackName || 'Conversation Path' });
  }
});

// ========== START SERVER ==========
initStorage().then(() => {
  app.listen(3000, () => {
    console.log('🚀 Backend running on http://localhost:3000');
    console.log('🤖 Model: gemini-3.1-flash-lite');
    console.log('📁 Sessions ready');
    console.log('🎤 Secretary mode enabled via /api/janitor-live');
    console.log('💬 Streaming chat at /api/chat/stream');
  });
});