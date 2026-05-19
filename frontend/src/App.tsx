import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, Trash2, Sparkles, Mic, MicOff, FileText, Download, Edit3, X, Menu, GitBranch, ChevronDown, ChevronRight, Link, Eye, Copy, Check, MapPin, Volume2, VolumeX, Brain, Activity, FileCheck, Edit2, CheckCircle, AlertCircle } from 'lucide-react';
import CodeSpace from './components/CodeSpace';
import BootSequence from './components/BootSequence';
import ModeToggle from './components/ModeToggle';
import './App.css';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface LivingDocumentType {
  content: string;
  lastUpdated: string;
  title?: string;
}

interface ActivityLog {
  action: string;
  timestamp: string;
  type?: string;
  agent?: 'user' | 'fast-brain' | 'janitor' | 'system';
}

interface CanvasFile {
  name: string;
  content: string;
  language: string;
  icon: string;
}

interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  pinned?: boolean;
  canvasFiles?: CanvasFile[];
  messages?: Message[];
  document?: LivingDocumentType;
  timelineNodes?: TimelineNode[];
  branches?: Branch[];
  nextBranchNumber?: number;
  decisions?: Decision[];
}

interface TimelineNode {
  id: string;
  userMessage: string;
  assistantMessage: string;
  timestamp: string;
  documentContent: string;
  documentSnapshot: LivingDocumentType;
  messagesSnapshot: Message[];
  parentId: string | null;
  branchId: string;
}

interface Branch {
  id: string;
  name: string;
  color: string;
  bgTint: string;
  icon: string;
  breadcrumbColor: string;
  createdAt: string;
  document: LivingDocumentType;
  collapsed?: boolean;
}

interface Decision {
  id: string;
  content: string;
  timestamp: string;
  section: string;
  status: 'active' | 'modified' | 'superseded';
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BRANCH_STYLES = [
  {
    id: 'main',
    name: 'Main',
    color: '#F5C451',        // warm amber
    bgTint: '#1A1408',
    icon: '◆',
    breadcrumbColor: '#FFD978'
  },

  {
    id: 'branch1',
    name: 'Exploration',
    color: '#7C9CF5',        // muted periwinkle
    bgTint: '#111827',
    icon: '◇',
    breadcrumbColor: '#A5B8FF'
  },

  {
    id: 'branch2',
    name: 'Alternative',
    color: '#B38CF7',        // soft lavender
    bgTint: '#161021',
    icon: '○',
    breadcrumbColor: '#D1B3FF'
  },

  {
    id: 'branch3',
    name: 'Experiment',
    color: '#E6A15A',        // muted amber-orange
    bgTint: '#1A130C',
    icon: '△',
    breadcrumbColor: '#FFC27A'
  },

  {
    id: 'branch4',
    name: 'Research',
    color: '#D16B6B',        // muted crimson
    bgTint: '#1A1010',
    icon: '□',
    breadcrumbColor: '#F09797'
  },

  {
    id: 'branch5',
    name: 'Testing',
    color: '#C472B8',        // dusty pink
    bgTint: '#1A1017',
    icon: '▽',
    breadcrumbColor: '#F0A3DE'
  },

  {
    id: 'branch6',
    name: 'Development',
    color: '#58B8C9',        // muted cyan
    bgTint: '#0F1720',
    icon: '☆',
    breadcrumbColor: '#8FE5F5'
  },

  {
    id: 'branch7',
    name: 'Prototype',
    color: '#93B85C',        // muted lime
    bgTint: '#141A0F',
    icon: '⬡',
    breadcrumbColor: '#BFE27A'
  },

  {
    id: 'branch8',
    name: 'Review',
    color: '#D98A52',        // burnt orange
    bgTint: '#1A130F',
    icon: '◈',
    breadcrumbColor: '#FFB27D'
  }
];
function isCodingRequest(message: string): boolean {
  const lowerMsg = message.toLowerCase();
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
    if (pattern.test(lowerMsg)) return true;
  }
  return false;
}

function extractCodeBlocks(text: string): { language: string, code: string }[] {
  const codeBlocks: { language: string, code: string }[] = [];
  const regex = /```(\w+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    codeBlocks.push({ language: match[1], code: match[2].trim() });
  }
  return codeBlocks;
}

function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  let html = markdown;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/^[\*\-] (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    if (match.match(/^\d+\./m)) return `<ol>${match}</ol>`;
    return match;
  });
  html = html.replace(/\n/gim, '<br />');
  html = html.replace(/(<br \/>\s*)+/g, '<br />');
  return html;
}

function App() {
  // State hooks
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [livingDocument, setLivingDocument] = useState<LivingDocumentType>({ content: '', lastUpdated: '', title: 'Notes' });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showChatSidebar, setShowChatSidebar] = useState(true);
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  
  const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [nextBranchNumber, setNextBranchNumber] = useState(1);
  const [currentBranchId, setCurrentBranchId] = useState<string>('main');
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [activeRestoredNodeId, setActiveRestoredNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);
  const [renamingBranchId, setRenamingBranchId] = useState<string | null>(null);
  const [branchRenameValue, setBranchRenameValue] = useState('');
  
  // Voice & Real-time states
  const [isListening, setIsListening] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [lastDocumentUpdate, setLastDocumentUpdate] = useState<{ type: 'add' | 'modify' | 'remove', section: string } | null>(null);
  const [showRestoreNotification, setShowRestoreNotification] = useState(false);
  
  // Add this with your other mode states
  const [interactiveMode, setInteractiveMode] = useState(false);

  // Secretary mode states
  const [secretaryMode, setSecretaryMode] = useState(false);
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [isJanitorProcessing, setIsJanitorProcessing] = useState(false);
  
  // Intent detection states
  const [intentConfidence, setIntentConfidence] = useState(0);
  const [detectedIntent, setDetectedIntent] = useState<'brainstorming' | 'question' | 'command' | 'direct_address' | 'unknown'>('unknown');
  const [showIntentIndicator, setShowIntentIndicator] = useState(false);
  const [intentIndicatorTimeout, setIntentIndicatorTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Voice response states
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [currentStreamingResponse, setCurrentStreamingResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Canvas/CodeSpace states
  const [canvasFiles, setCanvasFiles] = useState<CanvasFile[]>([]);
  const [activeCanvasFile, setActiveCanvasFile] = useState('');
  const [showCodeCanvas, setShowCodeCanvas] = useState(false);
  
  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatHistoryListRef = useRef<HTMLDivElement>(null);
  const timelineListRef = useRef<HTMLDivElement>(null);
  const documentContentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const janitorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastNodeIdRef = useRef<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const shouldStopRef = useRef(false);
  const accumulatedConversationRef = useRef<string>('');
  const isMutedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const pushToTalkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPushToTalkActiveRef = useRef(false);

  const [hasTriedCreate, setHasTriedCreate] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showTimelineMobile, setShowTimelineMobile] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showBootSequence, setShowBootSequence] = useState(true);

  // Wake word states
  const [wakeWordTriggered, setWakeWordTriggered] = useState(false);
  const [isProcessingWakeWord, setIsProcessingWakeWord] = useState(false);
  const [queuedQuestion, setQueuedQuestion] = useState<string | null>(null);

  const handleBootComplete = () => {
    setShowBootSequence(false);
  };

  const [userId] = useState(() => {
  let id = localStorage.getItem('butler_user_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    localStorage.setItem('butler_user_id', id);
  }
  return id;
});

const toggleBranchExpansion = (branchId: string) => {
  setExpandedBranches(prev => {
    const newSet = new Set(prev);
    if (newSet.has(branchId)) {
      newSet.delete(branchId);
    } else {
      newSet.add(branchId);
    }
    return newSet;
  });
};

  // Intent Detection
  const detectIntent = (text: string): { intent: 'brainstorming' | 'question' | 'command' | 'direct_address' | 'unknown', confidence: number } => {
    const lowerText = text.toLowerCase().trim();
    const directAddressPatterns = [
      /^butler[,:]?\s/i, /^hey butler/i, /^yo butler/i, /^hello butler/i,
      /^thanks butler/i, /butler[,:]?\s+(?:what|how|why|when|where|can|could|would|should)/i,
    ];
    for (const pattern of directAddressPatterns) {
      if (pattern.test(lowerText)) return { intent: 'direct_address', confidence: 92 };
    }
    const commandPatterns = [
      /\b(?:note|document|record|remember)\b.*\b(?:this|that|decision|info)/i,
      /\block\s+this\s+decision/i, /\bsave\s+this/i, /\b(?:update|change|add)\s+the\s+document/i,
    ];
    for (const pattern of commandPatterns) {
      if (pattern.test(lowerText)) return { intent: 'command', confidence: 88 };
    }
    const questionPatterns = [
      /^(?:what|how|why|when|where|who|which)\b/i, /\?$/,
      /\b(?:suggest|recommend|explain|describe|tell me|help me)\b/i,
      /\b(?:options|alternatives|examples?)\b/i,
    ];
    let questionScore = 0;
    for (const pattern of questionPatterns) {
      if (pattern.test(lowerText)) questionScore += 25;
    }
    if (questionScore >= 50) return { intent: 'question', confidence: Math.min(questionScore, 70) };
    const brainstormingPatterns = [
      /^(?:maybe|perhaps|could|might|what if|consider|thinking about)\b/i,
      /\b(?:i think|i feel|i believe|i wonder|i'm thinking)\b/i,
      /\b(?:brainstorm|idea|thought|option|possibility)\b/i, /\.{3,}$/,
    ];
    let brainstormingScore = 0;
    for (const pattern of brainstormingPatterns) {
      if (pattern.test(lowerText)) brainstormingScore += 20;
    }
    if (brainstormingScore >= 40) return { intent: 'brainstorming', confidence: Math.max(25, 65 - brainstormingScore) };
    if (text.length < 15) return { intent: 'unknown', confidence: 35 };
    return { intent: 'brainstorming', confidence: 30 };
  };

  // ========== Wake Word Detection ==========
const detectWakeWord = (text: string): { hasWakeWord: boolean; cleanedText: string } => {
  const lowerText = text.toLowerCase().trim();
  
  // More flexible wake word patterns
  const wakePatterns = [
    /\b(hey|yo|hello|hi|okay|ok)\s+butler\b/i,           // "hey butler", "yo butler"
    /\bbutler\b[,:]?\s+(?:can you|could you|what|how|why|when|where|do you|would you|should we|tell me|give me|explain|help me|suggest|recommend)\b/i,  // "butler, can you..."
    /^\s*butler\b[,:]?\s+/i,                              // "butler " at start
    /\bbutler\b\s*$/i,                                    // "butler" at end
    /\bbutler\b/i,                                        // any "butler" in text
  ];
  
  for (const pattern of wakePatterns) {
    if (pattern.test(lowerText)) {
      // Remove the wake word part and clean up
      let cleaned = text;
      
      // Remove "hey butler", "yo butler", etc.
      cleaned = cleaned.replace(/\b(hey|yo|hello|hi|okay|ok)\s+butler\b[,:]?\s*/i, '');
      // Remove "butler," or "butler " at start
      cleaned = cleaned.replace(/^\s*butler\b[,:]?\s*/i, '');
      // Remove "butler" anywhere else
      cleaned = cleaned.replace(/\bbutler\b[,:]?\s*/i, '');
      
      cleaned = cleaned.trim();
      
      // Capitalize first letter
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      
      // If nothing left after cleaning, use a default
      if (cleaned.length === 0) {
        cleaned = "What do you think?";
      }
      
      console.log('🎯 Wake word detected! Original:', text);
      console.log('🎯 Cleaned question:', cleaned);
      
      return { hasWakeWord: true, cleanedText: cleaned };
    }
  }
  
  return { hasWakeWord: false, cleanedText: text };
}

const speakResponse = (text: string) => {
  // Don't speak if muted
  if (isMutedRef.current) {
    console.log('🔇 Muted - not speaking');
    return;
  }
  
  if (!voiceResponseEnabled) return;
  if (shouldStopRef.current) return;
  
  // CRITICAL: Force stop recognition BEFORE speaking to prevent echo
  if (recognitionRef.current) {
    try {
      console.log('🎤 FORCE stopping recognition before AI speaks');
      recognitionRef.current.stop();
      setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort?.();
          } catch (e) {}
        }
      }, 50);
    } catch (e) {
      console.log('Recognition stop error:', e);
    }
  }
  
  // Set speaking flag immediately
  setIsSpeaking(true);
  setVoiceActivity('speaking');
  
  let cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[`_~>]/g, '');
  
  if (cleanText.length > 400) {
    cleanText = cleanText.slice(0, 400) + '...';
  }
  
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 0.85;
  utterance.pitch = 1.0;
  utterance.volume = 0.8;
  
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  utterance.onstart = () => {
    console.log('🔊 AI started speaking - recognition stopped');
    setIsSpeaking(true);
    setVoiceActivity('speaking');
  };
  
  utterance.onend = () => {
  console.log('🔊 AI finished speaking - restarting recognition');
  
  // Record when AI finished speaking
  (window as any).lastAISpeechEndTime = Date.now();
  
  setIsSpeaking(false);
  setVoiceActivity('listening');
  
  // CRITICAL: Re-initialize recognition after speaking
  setTimeout(() => {
    if ((secretaryMode || interactiveMode) && !isViewingHistory && !isSpeaking) {
      // Don't try to copy handlers - just create fresh recognition
      // The useEffect will handle re-initialization
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {}
      }
      
      // Signal that recognition needs to be recreated
      // The useEffect will recreate it on next render
      window.dispatchEvent(new Event('resize'));
    }
  }, 500);
};
  
  utterance.onerror = (event) => {
  console.log('🔊 AI speech error:', event.error);
  
  (window as any).lastAISpeechEndTime = Date.now();
  
  setIsSpeaking(false);
  setVoiceActivity('listening');
  
  setTimeout(() => {
    if ((secretaryMode || interactiveMode) && !isViewingHistory && !isSpeaking) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {}
      }
      window.dispatchEvent(new Event('resize'));
    }
  }, 500);
};
  
  window.speechSynthesis.speak(utterance);
};

const stopSpeaking = () => {
  if (isSpeaking) { 
    window.speechSynthesis.cancel(); 
    setIsSpeaking(false); 
    setVoiceActivity('listening'); 
  }
};

const stopAIResponse = () => {
  console.log('🛑 STOPPING AI RESPONSE - User interrupted');
  shouldStopRef.current = true;  // Set flag
  
  // Force stop speech
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  
  // Abort fetch
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
  
  // Reset states
  setIsSpeaking(false);
  setIsStreaming(false);
  setLoading(false);
  setVoiceActivity('idle');
  
  // Reset flag after a short delay
  setTimeout(() => {
    shouldStopRef.current = false;
  }, 500);
};

// Session Management
  const loadSessions = async () => {
  if (isSpeaking || isStreaming) {
    stopAIResponse();
  }
  
  try {
    console.log('📋 Loading sessions list...');
    const res = await fetch(`${API_URL}/sessions`);
    
    if (!res.ok) {
      throw new Error(`Failed to load sessions: ${res.status}`);
    }
    
    const sessionsList = await res.json();
    console.log(`📋 Loaded ${sessionsList.length} sessions`);
    setSessions(sessionsList);
    
    // If no current session and we have sessions, load the most recent one
    if (!currentSessionId && sessionsList.length > 0) {
      const mostRecent = sessionsList.reduce((latest, session) => {
        return new Date(session.updatedAt) > new Date(latest.updatedAt) ? session : latest;
      }, sessionsList[0]);
      
      console.log('🔄 Loading most recent session:', mostRecent.id);
      await loadSession(mostRecent.id);
    }
    
  } catch (error) { 
    console.error('Failed to load sessions:', error); 
  }
};

const loadSession = async (sessionId: string) => {

  setIsViewingHistory(false);
  setActiveRestoredNodeId(null);
  // Don't reload the same session
  if (currentSessionId === sessionId && !isViewingHistory) {
    console.log('Already on this session');
    return;
  }
  
  try {
    // CRITICAL: Save current session before switching
    if (currentSessionId && currentSessionId !== sessionId) {
      console.log('💾 Saving current session before switching...');
      await saveCurrentSession();
    }
    
    // Stop any ongoing processes
    if (isSpeaking || isStreaming) {
      stopAIResponse();
    }
    
    console.log('📂 Loading session:', sessionId);
    const res = await fetch(`${API_URL}/sessions/${sessionId}`);
    
    if (!res.ok) {
      throw new Error(`Failed to load session: ${res.status}`);
    }
    
    const session = await res.json();
    
    // Restore all state
    setMessages(session.messages || []);
    
    if (session.timelineNodes) {
      setTimelineNodes(session.timelineNodes);
      if (session.timelineNodes.length > 0) {
        lastNodeIdRef.current = session.timelineNodes[session.timelineNodes.length - 1].id;
      }
    } else {
      lastNodeIdRef.current = null;
    }
    
    if (session.document) { 
      setLivingDocument({ ...session.document, title: session.document.title || 'Notes' }); 
      setEditTitleValue(session.document.title || 'Notes'); 
    } else {
      setLivingDocument({ content: '', lastUpdated: new Date().toISOString(), title: 'Notes' });
      setEditTitleValue('Notes');
    }
    
    if (session.activity) setActivities(session.activity);
    else setActivities([]);
    
    if (session.branches) {
      setBranches(session.branches.map((b: Branch) => ({ ...b, collapsed: false })));
      const maxBranchNumber = session.branches.reduce((max, b) => { 
        const num = parseInt(b.name.split(' ')[1]) || 0; 
        return Math.max(max, num); 
      }, 0);
      setNextBranchNumber(maxBranchNumber + 1);
    } else {
      setBranches([]);
      setNextBranchNumber(1);
    }
    
    if (session.nextBranchNumber) setNextBranchNumber(session.nextBranchNumber);
    
    if (session.canvasFiles && session.canvasFiles.length > 0) { 
      setCanvasFiles(session.canvasFiles); 
      setShowCodeCanvas(true); 
    } else { 
      setCanvasFiles([]); 
      setShowCodeCanvas(false); 
    }
    
    if (session.decisions) setDecisions(session.decisions);
    else setDecisions([]);
    
    setCurrentSessionId(sessionId);
    sessionStorage.setItem('butler_session', sessionId);
    
    // Reset all history flags
    setIsViewingHistory(false);
    setActiveRestoredNodeId(null);
    setSearchTerm('');
    setTranscriptSegments([]);
    
    // Set current branch
    if (session.branches && session.branches.length > 0) {
      const latestBranch = session.branches.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      setCurrentBranchId(latestBranch.id);
      if (latestBranch.document) setLivingDocument(latestBranch.document);
    } else { 
      setCurrentBranchId('main'); 
    }
    
    addActivityToBackend(`📂 Loaded chat: ${session.title}`, 'system');
    
    // Scroll to bottom
    if (messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }, 100);
    }
    
  } catch (error) { 
    console.error('Failed to load session:', error);
    addActivityToBackend(`❌ Failed to load chat`, 'system');
  }
};

  const saveCurrentSession = async () => {
  if (!currentSessionId) {
    console.log('No current session to save');
    return;
  }
  
  try {
    console.log('💾 Saving session:', currentSessionId);
    
    // Get current state
    const sessionData = {
      messages,
      document: livingDocument,
      activity: activities,
      canvasFiles,
      timelineNodes,
      branches,
      nextBranchNumber,
      decisions,
      updatedAt: new Date().toISOString()
    };
    
    const res = await fetch(`${API_URL}/sessions/${currentSessionId}`, { 
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(sessionData) 
    });
    
    if (!res.ok) {
      throw new Error(`Failed to save: ${res.status}`);
    }
    
    console.log('✅ Session saved successfully');
    return true;
  } catch (error) { 
    console.error('Failed to save session:', error);
    return false;
  }
};

const buildMessageTree = () => {
  // First, group nodes by branch, filtering by search term
  const branchGroups: Map<string, TimelineNode[]> = new Map();
  
  // Helper to check if a node matches search
  const matchesSearch = (node: TimelineNode) => {
    if (!searchTerm) return true;
    return node.userMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
           node.assistantMessage.toLowerCase().includes(searchTerm.toLowerCase());
  };
  
  // Add main branch nodes with search filter
  const mainNodes = timelineNodes
    .filter(node => node.branchId === 'main' && matchesSearch(node))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  branchGroups.set('main', mainNodes);
  
  // Add other branch nodes with search filter
  branches.forEach(branch => {
    const branchNodes = timelineNodes
      .filter(node => node.branchId === branch.id && matchesSearch(node))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    branchGroups.set(branch.id, branchNodes);
  });
  
  return branchGroups;
};


  // Timeline Functions
  // ========== Timeline Functions ==========
const addToTimeline = (userMessage: string, assistantMessage: string) => {
  // CRITICAL: Create IMMEDIATE deep copies of current state
  const messagesSnapshot = JSON.parse(JSON.stringify(messages));
  const documentSnapshot = JSON.parse(JSON.stringify(livingDocument));
  
  console.log('📅 SAVING TIMELINE NODE');
  console.log('  User:', userMessage.slice(0, 40));
  console.log('  Messages count:', messagesSnapshot.length);
  console.log('  Document title:', documentSnapshot.title);
  console.log('  Document content length:', documentSnapshot.content?.length || 0);
  
  const newNode: TimelineNode = {
    id: Date.now().toString(),
    userMessage: userMessage,
    assistantMessage: assistantMessage,
    timestamp: new Date().toISOString(),
    documentContent: documentSnapshot.content || '',
    documentSnapshot: documentSnapshot,
    messagesSnapshot: messagesSnapshot,
    parentId: lastNodeIdRef.current,
    branchId: currentBranchId
  };
  
  setTimelineNodes(prev => {
    console.log('✅ Node saved. Total nodes:', prev.length + 1);
    return [...prev, newNode];
  });
  lastNodeIdRef.current = newNode.id;
};

// Add this near your other fetch/API functions (around line 100-200)
const addActivityToBackend = async (action: string, agent: string = 'user') => {
  try {
    await fetch('/api/activity/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, agent })
    });
  } catch (error) {
    // Silent fail - won't break the chat
    console.debug('Activity log failed:', error);
  }
};

const deleteBranch = async (branchId: string) => {
  if (branchId === 'main') {
    addActivityToBackend(`⚠️ Cannot delete main branch`, 'system');
    return;
  }
  
  if (confirm(`Delete branch "${getBranchName(branchId)}"? This cannot be undone.`)) {
    // Remove branch from state
    setBranches(prev => prev.filter(b => b.id !== branchId));
    
    // If currently on this branch, switch to main
    if (currentBranchId === branchId) {
      setCurrentBranchId('main');
      // Reload main branch document
      const mainBranch = branches.find(b => b.id === 'main');
      if (mainBranch?.document) {
        setLivingDocument(mainBranch.document);
      }
    }
    
    // Remove all timeline nodes belonging to this branch
    setTimelineNodes(prev => prev.filter(node => node.branchId !== branchId));
    
    // Save to backend
    if (currentSessionId) {
      const updatedBranches = branches.filter(b => b.id !== branchId);
      const updatedTimelineNodes = timelineNodes.filter(node => node.branchId !== branchId);
      await fetch(`${API_URL}/sessions/${currentSessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: updatedBranches, timelineNodes: updatedTimelineNodes })
      });
    }
    
    addActivityToBackend(`🗑️ Deleted branch: ${getBranchName(branchId)}`, 'system');
  }
};

 const addCodeToCanvas = (code: string, language: string) => {
    let filename = 'code.txt', icon = '📄';
    if (language === 'python' || language === 'py') { filename = 'script.py'; icon = '🐍'; }
    else if (language === 'javascript' || language === 'js') { filename = 'script.js'; icon = '📜'; }
    else if (language === 'html') { filename = 'index.html'; icon = '🌐'; }
    else if (language === 'css') { filename = 'style.css'; icon = '🎨'; }
    else if (language === 'json') { filename = 'data.json'; icon = '📋'; }
    setCanvasFiles(prev => {
      const existing = prev.find(f => f.name === filename);
      if (existing) return prev.map(f => f.name === filename ? { ...f, content: code } : f);
      else return [...prev, { name: filename, content: code, language, icon }];
    });
    setActiveCanvasFile(filename);
    setShowCodeCanvas(true);
  };

const sendStreamingMessage = async (message: string) => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  
  const controller = new AbortController();
  abortControllerRef.current = controller;
  
  setLoading(true);
  setIsStreaming(true);
  setCurrentStreamingResponse('');
  
  // Add user message to chat
  const userMessage: Message = {
    id: Date.now(),
    role: 'user',
    content: message,
    timestamp: new Date().toLocaleTimeString()
  };
  setMessages(prev => [...prev, userMessage]);
  
  // Add placeholder assistant message
  const assistantId = Date.now() + 1;
  setMessages(prev => [...prev, {
    id: assistantId,
    role: 'assistant',
    content: '',
    timestamp: new Date().toLocaleTimeString()
  }]);
  
  try {
    const response = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        sessionId: currentSessionId,
        branchId: currentBranchId,
        currentDocument: livingDocument
      }),
      signal: controller.signal
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullResponse += parsed.content;
              setCurrentStreamingResponse(fullResponse);
              
              // Update the assistant message in real-time
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId ? { ...msg, content: fullResponse } : msg
              ));
            }
            if (parsed.document) {
              setLivingDocument(parsed.document);
              addActivityToBackend(`📄 Document updated during conversation`, 'janitor');
              await loadSessions();
            }
            if (parsed.decisions) {
              parsed.decisions.forEach((d: Decision) => {
                setDecisions(prev => [d, ...prev]);
                addActivityToBackend(`📋 Decision: ${d.content}`, 'janitor');
              });
            }
            if (parsed.sessionTitle) {
              console.log('📝 Updating chat title to:', parsed.sessionTitle);
              setSessions(prev => prev.map(session => 
                session.id === currentSessionId 
                  ? { ...session, title: parsed.sessionTitle }
                  : session
              ));
              setLivingDocument(prev => ({ ...prev, title: parsed.sessionTitle }));
              setEditTitleValue(parsed.sessionTitle);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
    // Only speak if we're in a voice mode (secretary or interactive) AND not muted
    if (fullResponse.trim() && (secretaryMode || interactiveMode)) {      
      if (!isMuted) {
        console.log('🔊 Speaking response, length:', fullResponse.length);
        speakResponse(fullResponse);
      } else {
        console.log('🔇 Muted - skipping speech');
      }
    } else if (fullResponse.trim()) {
      console.log('💬 Text-only response (no voice)');
    }

    // Process AI response: Update document AND extract code blocks
    if (fullResponse.trim()) {
      // Update document with AI response
      triggerLiveJanitor(fullResponse);
      
      // Extract code blocks and add to canvas
      const codeBlocks = extractCodeBlocks(fullResponse);
      if (codeBlocks.length > 0) {
        codeBlocks.forEach(({ language, code }) => {
          addCodeToCanvas(code, language);
        });
        console.log(`📝 Added ${codeBlocks.length} code block(s) to canvas`);
      }
    }
    
    addActivityToBackend(`🤖 Butler: Responded to "${message.slice(0, 50)}..."`, 'fast-brain');
    
    // ===== Create timeline node with the FINAL state =====
    setTimeout(() => {
      let finalMessages: Message[] = [];
      let finalDocument: LivingDocumentType = { content: '', lastUpdated: '', title: 'Notes' };
      
      setMessages(prev => {
        finalMessages = [...prev];
        return prev;
      });
      
      setLivingDocument(prev => {
        finalDocument = { ...prev };
        return prev;
      });
      
      setTimeout(() => {
        console.log('📝 CREATING TIMELINE NODE FOR:', message.slice(0, 40));
        console.log('  Messages count:', finalMessages.length);
        console.log('  Document title:', finalDocument.title);
        
        if (finalMessages.length > 0) {
          const newNode: TimelineNode = {
            id: Date.now().toString(),
            userMessage: message,
            assistantMessage: fullResponse,
            timestamp: new Date().toISOString(),
            documentContent: finalDocument.content || '',
            documentSnapshot: JSON.parse(JSON.stringify(finalDocument)),
            messagesSnapshot: JSON.parse(JSON.stringify(finalMessages)),
            parentId: lastNodeIdRef.current,
            branchId: currentBranchId
          };
          
          setTimelineNodes(prev => {
            console.log('✅ Timeline node added. Total nodes:', prev.length + 1);
            return [...prev, newNode];
          });
          lastNodeIdRef.current = newNode.id;
        }
      }, 100);
    }, 100);
    
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Request aborted due to interruption');
    } else {
      console.error('Streaming error:', error);
    }
  } finally {
    setLoading(false);
    setIsStreaming(false);
    setCurrentStreamingResponse('');
    abortControllerRef.current = null;
  }
};

  const showIntentFeedback = (intent: string, confidence: number) => {
    setDetectedIntent(intent as any); setIntentConfidence(confidence); setShowIntentIndicator(true);
    if (intentIndicatorTimeout) clearTimeout(intentIndicatorTimeout);
    const timeout = setTimeout(() => setShowIntentIndicator(false), 1800);
    setIntentIndicatorTimeout(timeout);
  };

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices.find(v => v.lang === 'en-US');
      if (preferredVoice) setSelectedVoice(preferredVoice);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

const triggerLiveJanitor = async (text: string) => {
  console.log('🔴 1. Janitor called with:', text.slice(0, 50));
  if (!text.trim() || text.length < 5) {
    console.log('🔴 2. Text too short, skipping');
    return;
  }
  if (isJanitorProcessing) {
    console.log('🔴 3. Already processing, skipping');
    return;
  }
  setIsJanitorProcessing(true);
  
  try {
    console.log('🔴 4. Sending request to:', `${API_URL}/janitor-live`);
    const res = await fetch(`${API_URL}/janitor-live`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: text,
        currentDocument: livingDocument, 
        sessionId: currentSessionId 
      })
    });
    
    console.log('🔴 5. Response status:', res.status);
    const data = await res.json();
    console.log('🔴 6. Response data:', data);
    
    if (data.updatedDocument) {
      console.log('🔴 7. ✅ UPDATING DOCUMENT! New content length:', data.updatedDocument.content?.length);
      setLivingDocument(data.updatedDocument);
    } else {
      console.log('🔴 8. ⚠️ No updatedDocument in response');
    }
  } catch (error) { 
    console.error('🔴 9. ERROR:', error); 
  } finally { 
    setIsJanitorProcessing(false); 
  }
};

  const debouncedJanitor = (text: string) => {
  if (janitorTimeoutRef.current) clearTimeout(janitorTimeoutRef.current);
  janitorTimeoutRef.current = setTimeout(() => { 
    triggerLiveJanitor(text); 
  }, 1200);
};


// Replace your updateDocumentOnly function
const updateDocumentOnly = async (text: string) => {
  if (!text.trim() || text.length < 10) return;
  if (isJanitorProcessing) return;
  
  // Accumulate conversation
  accumulatedConversationRef.current += ' ' + text;
  
  // Don't send every utterance - wait for pause
  if (janitorTimeoutRef.current) clearTimeout(janitorTimeoutRef.current);
  
  janitorTimeoutRef.current = setTimeout(async () => {
    setIsJanitorProcessing(true);
    
    try {
      const res = await fetch(`${API_URL}/janitor-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: accumulatedConversationRef.current.trim(),
          currentDocument: livingDocument,
          sessionId: currentSessionId
        })
      });
      
      const data = await res.json();
      
      if (data.updatedDocument) {
        console.log('✅ Document updated with context length:', accumulatedConversationRef.current.length);
        setLivingDocument(data.updatedDocument);
        
        if (data.updatedDocument.title && data.updatedDocument.title !== livingDocument.title) {
          setEditTitleValue(data.updatedDocument.title);
          setSessions(prev => prev.map(session => 
            session.id === currentSessionId 
              ? { ...session, title: data.updatedDocument.title }
              : session
          ));
        }
      }
    } catch (error) { 
      console.error('Document update error:', error); 
    } finally { 
      setIsJanitorProcessing(false); 
    }
  }, 2000); // Wait 2 seconds of silence before updating
}

useEffect(() => {
  if (isViewingHistory) {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setVoiceActivity('idle');
    setIsListening(false);
    return;
  }
  
  // Stop and cleanup if no mode is active
  if (!secretaryMode && !interactiveMode) {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (e) {}
    }
    setVoiceActivity('idle');
    setIsListening(false);
    return;
  }

  // Initialize speech recognition
  let recognition: any = null;
  let isRestarting = false;
  
  const initSpeechRecognition = () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.error('Speech recognition not supported');
    return null;
  }
  
  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  const instance = new SpeechRecognition();
  instance.continuous = true;
  instance.interimResults = true;
  instance.lang = 'en-US';
  
  // Request microphone permission and keep stream
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaStreamRef.current = stream;
        console.log('🎤 Microphone permission granted, stream ready');
      })
      .catch(err => console.error('Microphone permission denied:', err));
  }
  
  instance.onstart = () => {
    console.log('🎤 Recognition started - ready to listen');
    setVoiceActivity('listening');
    setIsListening(true);
  };
  
  instance.onend = () => {
    console.log('Recognition ended');
    setVoiceActivity('idle');
    setIsListening(false);
  };
  
  instance.onerror = (event: any) => {
    console.error('Recognition error:', event.error);
    if (event.error === 'not-allowed') {
      console.error('Microphone permission denied');
      setVoiceActivity('idle');
      setIsListening(false);
    }
  };
  
  // Store accumulated transcript
  let accumulatedFinalTranscript = '';
  
  instance.onresult = async (event: any) => {
  console.log('🎤 onresult triggered - interactiveMode:', interactiveMode, 'secretaryMode:', secretaryMode);
  
  // Ignore if viewing history
  if (isViewingHistory) {
    console.log('🎤 IGNORING - viewing history mode');
    return;
  }
  
  let finalTranscript = '', interimTranscript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript;
    if (result.isFinal) finalTranscript += transcript;
    else interimTranscript += transcript;
  }
  
  // Ignore very short transcripts (ambient noise)
  if (finalTranscript && finalTranscript.length < 2) {
    console.log('🎤 IGNORING - transcript too short');
    return;
  }
  
  if (finalTranscript) {
    console.log('🎤 PROCESSING:', finalTranscript);
    
    if (interactiveMode) {
      // INTERACTIVE MODE: Send message immediately
      console.log('💬 Interactive Mode - sending message');
      setTranscriptSegments(prev => [...prev, finalTranscript]);
      
      // Show in input for visual feedback
      setInput(finalTranscript);
      
      // Send the message
      if (isSpeaking || isStreaming) {
        stopAIResponse();
      }
      
      const messageToSend = finalTranscript;
      setInput(''); // Clear input
      
      await updateDocumentOnly(messageToSend);
      await sendStreamingMessage(messageToSend);
      return;
    }
    
    if (secretaryMode) {
      // SECRETARY MODE - Check for wake word
      const { hasWakeWord, cleanedText } = detectWakeWord(finalTranscript);
      
      if (hasWakeWord && !isProcessingWakeWord && !isSpeaking) {
        console.log('🔊 Wake word detected!');
        setIsProcessingWakeWord(true);
        setWakeWordTriggered(true);
        setTranscriptSegments(prev => [...prev, finalTranscript]);
        
        // Update document and get AI response
        await updateDocumentOnly(cleanedText);
        await sendStreamingMessage(cleanedText);
        
        setTimeout(() => {
          setIsProcessingWakeWord(false);
          setWakeWordTriggered(false);
        }, 2000);
        
        setInput('');
      } else if (!hasWakeWord && !isSpeaking) {
        console.log('📝 Documenting only');
        setTranscriptSegments(prev => [...prev, finalTranscript]);
        
        const userMessage: Message = {
          id: Date.now(),
          role: 'user',
          content: finalTranscript,
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, userMessage]);
        
        // Only update document, no AI response
        await updateDocumentOnly(finalTranscript);
        
        // Add to timeline without AI response
        setTimeout(() => {
          const messagesSnapshot = JSON.parse(JSON.stringify([...messages, userMessage]));
          const documentSnapshot = JSON.parse(JSON.stringify(livingDocument));
          
          const newNode: TimelineNode = {
            id: Date.now().toString(),
            userMessage: finalTranscript,
            assistantMessage: '',
            timestamp: new Date().toISOString(),
            documentContent: documentSnapshot.content || '',
            documentSnapshot: documentSnapshot,
            messagesSnapshot: messagesSnapshot,
            parentId: lastNodeIdRef.current,
            branchId: currentBranchId
          };
          
          setTimelineNodes(prev => [...prev, newNode]);
          lastNodeIdRef.current = newNode.id;
        }, 50);
        
        setInput('');
      }
    }
  }
  
  if (interimTranscript) {
    setInput(interimTranscript);
  }
};
  
  // Store the accumulated transcript on the instance so stopPushToTalk can access it
  instance.getAccumulatedTranscript = () => accumulatedFinalTranscript;
  instance.clearAccumulatedTranscript = () => { accumulatedFinalTranscript = ''; };
  
  return instance;
};
  
  // Start recognition if not already running
  if (!recognitionRef.current && (secretaryMode || interactiveMode)) {
    console.log('🎤 Creating speech recognition... Mode:', interactiveMode ? 'Interactive' : 'Secretary');
    recognitionRef.current = initSpeechRecognition();
  }
  
  if ((secretaryMode || interactiveMode) && recognitionRef.current) {
    try {
      console.log('🎤 Starting recognition...');
      recognitionRef.current.start();
    } catch (e: any) {
      if (e.name !== 'InvalidStateError') console.error('Error starting:', e);
    }
  } else if (!secretaryMode && !interactiveMode && recognitionRef.current) {
    try {
      console.log('🛑 Stopping recognition...');
      recognitionRef.current.stop();
      recognitionRef.current = null;
    } catch (e) {
      console.error('Error stopping:', e);
    }
  }
  
  // EventSource for real-time updates
  const es = new EventSource(`${API_URL}/events`);
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleRealtimeUpdate(data);
    } catch (e) {}
  };
  setEventSource(es);
  
  return () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (e) {}
    }
    if (eventSource) eventSource.close();
    if (janitorTimeoutRef.current) clearTimeout(janitorTimeoutRef.current);
  };
}, [secretaryMode, interactiveMode, voiceResponseEnabled, isViewingHistory]);

  const handleRealtimeUpdate = (data: any) => {
  console.log('📡 SSE Event received:', data.type, data);
  switch (data.type) {
    case 'document_update':
      console.log('📄 UPDATING DOCUMENT FROM SSE!', data.document);
      setLivingDocument(data.document);
      // ... rest of your code
      break;
    // ... other cases
  }
};

  const getBranchStyle = (branchId: string) => {
    if (branchId === 'main') return BRANCH_STYLES[0];
    const branch = branches.find(b => b.id === branchId);
    if (branch) return { id: branch.id, name: branch.name, color: branch.color, bgTint: branch.bgTint, icon: branch.icon, breadcrumbColor: branch.breadcrumbColor };
    return BRANCH_STYLES[0];
  };

  const getBranchName = (branchId: string): string => {
    if (branchId === 'main') return 'Main Branch';
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || 'Unknown';
  };

  const renameBranch = async (branchId: string, newName: string) => {
    if (!newName.trim()) return;
    setBranches(prev => prev.map(branch => branch.id === branchId ? { ...branch, name: newName.trim() } : branch));
    await addActivityToBackend(`✏️ Renamed branch to "${newName.trim()}"`, 'system');
    if (currentSessionId) {
      await fetch(`${API_URL}/sessions/${currentSessionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branches: branches.map(b => b.id === branchId ? { ...b, name: newName.trim() } : b) }) });
    }
  };

  const toggleBranchCollapse = (branchId: string) => {
    setBranches(prev => prev.map(branch => branch.id === branchId ? { ...branch, collapsed: !branch.collapsed } : branch));
  };

  const toggleSecretaryMode = () => {
      if (isSpeaking || isStreaming) {
        stopAIResponse();
      }
  if (secretaryMode) {
    // Turning OFF secretary mode
    if (typeof window !== 'undefined') {
      (window as any).shouldRestartRecognition = false;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null; // Add this - clear the instance
        console.log('🛑 Recognition stopped and cleared');
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
    }
    setSecretaryMode(false);
    setTranscriptSegments([]);
    accumulatedConversationRef.current = ''; // ← ADD THIS LINE
    if (janitorTimeoutRef.current) clearTimeout(janitorTimeoutRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopSpeaking();
    setVoiceActivity('idle');
    setIsListening(false);
    addActivityToBackend(`🎤 Secretary mode deactivated`, 'system');
  } else {
    // Turning ON secretary mode
    setSecretaryMode(true);
    accumulatedConversationRef.current = ''; // ← ADD THIS LINE
    setVoiceActivity('listening');
    addActivityToBackend(`🎤 Secretary mode activated`, 'system');
  }
};

  const toggleVoiceResponse = () => {
    if (voiceResponseEnabled) stopSpeaking();
    setVoiceResponseEnabled(!voiceResponseEnabled);
    addActivityToBackend(`🔊 Voice responses ${!voiceResponseEnabled ? 'enabled' : 'disabled'}`, 'system');
  };

  const toggleMute = () => {
  if (!isMuted) {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setVoiceActivity('listening');
    }
    setIsMuted(true);
    isMutedRef.current = true;  // ← MUST HAVE THIS
    addActivityToBackend(`🔇 Voice output muted`, 'system');
  } else {
    setIsMuted(false);
    isMutedRef.current = false;  // ← MUST HAVE THIS
    addActivityToBackend(`🔊 Voice output unmuted`, 'system');
  }
};


  const createNewSession = async () => {
  // Don't proceed if already creating
  if (isCreatingSession) {
    console.log('Already creating a session, skipping...');
    return;
  }
  
  setIsCreatingSession(true);
  
  try {
    // CRITICAL: Save current session BEFORE creating new one
    if (currentSessionId) {
      console.log('💾 Saving current session before creating new...');
      await saveCurrentSession();
    }
    
    // Stop any ongoing processes
    if (isSpeaking || isStreaming) {
      stopAIResponse();
    }
    
    // Reset history flags
    setIsViewingHistory(false);
    setActiveRestoredNodeId(null);
    
    // 🔴 ADD THIS LINE - Collapse the chat sidebar when creating new chat
    setShowChatSidebar(false);
    
    console.log('🆕 Creating new session...');
    const res = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' })
    });
    
    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ New session created:', data.sessionId);
    
    // Save to session storage
    sessionStorage.setItem('butler_session', data.sessionId);
    setCurrentSessionId(data.sessionId);
    
    // Clear all local state for the new session
    setMessages([]);
    setLivingDocument({ content: '', lastUpdated: new Date().toISOString(), title: 'Notes' });
    setEditTitleValue('Notes');
    setCanvasFiles([]);
    setShowCodeCanvas(false);
    setTimelineNodes([]);
    setBranches([]);
    setDecisions([]);
    setTranscriptSegments([]);
    setActivities([]);
    setCurrentBranchId('main');
    lastNodeIdRef.current = null;
    accumulatedConversationRef.current = '';
    
    // Reload sessions list to show the new one
    await loadSessions();
    
    // Ensure we're viewing the new session
    await loadSession(data.sessionId);
    
    addActivityToBackend(`✨ New chat created`, 'system');
    
    // Scroll to top
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
    
  } catch (error) { 
    console.error('Failed to create session:', error);
    addActivityToBackend(`❌ Failed to create new chat`, 'system');
  } finally {
    setIsCreatingSession(false);
  }
};

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'DELETE' });
      await loadSessions();
      if (currentSessionId === sessionId && sessions.length > 1) { const nextSession = sessions.find(s => s.id !== sessionId); if (nextSession) await loadSession(nextSession.id); }
    } catch (error) { console.error('Failed to delete session:', error); }
  };

  const pinSession = async (sessionId: string, isPinned: boolean) => {
    try { await fetch(`${API_URL}/sessions/${sessionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: isPinned }) }); await loadSessions(); } catch (error) {}
  };

  const updateDocumentTitle = async () => {
    if (!editTitleValue.trim()) return;
    const newTitle = editTitleValue.trim();
    setLivingDocument(prev => ({ ...prev, title: newTitle }));
    setIsEditingTitle(false);
    if (currentSessionId) { await fetch(`${API_URL}/sessions/${currentSessionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document: { ...livingDocument, title: newTitle } }) }); }
    await addActivityToBackend(`📝 Document renamed to "${newTitle}"`, 'system');
  };

  const exportAsMarkdown = () => {
    const title = livingDocument.title || 'Notes';
    const content = livingDocument.content || '';
    const date = new Date().toLocaleString();
    const fullMarkdown = `# ${title}\n\n${content}\n\n---\n*Generated by Butler AI Assistant on ${date}*\n`;
    const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addActivityToBackend(`📄 Exported as Markdown`, 'system');
  };

  const exportAsDocx = () => {
    const title = livingDocument.title || 'Notes';
    const content = livingDocument.content || '';
    const formattedContent = markdownToHtml(content);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:'Calibri','Arial',sans-serif;margin:40px;line-height:1.6;color:#333}h1{color:#10a37f;border-bottom:2px solid #10a37f;padding-bottom:10px}h2{color:#2c3e50;border-left:4px solid #10a37f;padding-left:15px}ul,ol{margin:10px 0;padding-left:30px}.footer{margin-top:50px;padding-top:20px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center}</style></head><body><h1>${title}</h1>${formattedContent}<div class="footer">Generated by Butler AI Assistant on ${new Date().toLocaleString()}</div></body></html>`;
    const blob = new Blob([fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    addActivityToBackend(`📄 Exported as Word document`, 'system');
  };

  const exportAsPdf = () => {
    const title = livingDocument.title || 'Notes';
    const content = livingDocument.content || '';
    const formattedContent = markdownToHtml(content);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI','Arial',sans-serif;margin:40px;line-height:1.6;color:#333}.container{max-width:900px;margin:0 auto}h1{color:#10a37f;border-bottom:3px solid #10a37f;padding-bottom:12px}h2{color:#2c3e50;border-left:4px solid #10a37f;padding-left:15px}ul,ol{margin:10px 0 10px 20px}.footer{margin-top:50px;padding-top:20px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center}@media print{body{margin:0;padding:20px}}</style></head><body><div class="container"><h1>${title}</h1>${formattedContent}<div class="footer">Generated by Butler AI Assistant on ${new Date().toLocaleString()}</div></div><script>window.onload=function(){window.print()}</script></body></html>`);
      printWindow.document.close();
    }
    addActivityToBackend(`📄 Exported as PDF`, 'system');
  };

  const restoreFromNode = (node: TimelineNode) => {
  console.log('🔄 ===== RESTORING FROM NODE =====');
  
  if (!node.messagesSnapshot || node.messagesSnapshot.length === 0) {
    console.error('❌ No messages snapshot in this node!');
    return;
  }
  
  // Check if this is the latest node in its branch
  const branchNodes = timelineNodes.filter(n => n.branchId === node.branchId);
  const isLatest = branchNodes.length === 0 || branchNodes.reduce((latest, current) => 
    new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
  ).id === node.id;
  
  // Restore messages
  setMessages([...node.messagesSnapshot]);
  
  // Restore document
  if (node.documentSnapshot) {
    setLivingDocument({ ...node.documentSnapshot });
    setEditTitleValue(node.documentSnapshot.title || 'Notes');
  } else if (node.documentContent) {
    setLivingDocument({
      content: node.documentContent,
      lastUpdated: new Date().toISOString(),
      title: livingDocument.title || 'Notes'
    });
  }
  
  setCurrentBranchId(node.branchId);
  
  // ONLY block chat if this is NOT the latest node
  setIsViewingHistory(!isLatest);
  setActiveRestoredNodeId(node.id);
  lastNodeIdRef.current = node.id;
  
  if (!isLatest) {
    addActivityToBackend(`⏪ Viewing past conversation from ${new Date(node.timestamp).toLocaleTimeString()} (chat blocked)`, 'system');
  } else {
    addActivityToBackend(`📋 Viewing latest conversation (chat enabled)`, 'system');
  }
  
  setShowRestoreNotification(true);
  setTimeout(() => setShowRestoreNotification(false), 3000);
  
  // Scroll to top when viewing history
  if (messagesContainerRef.current) {
    messagesContainerRef.current.scrollTop = 0;
  }
};

const branchFromNode = async (node: TimelineNode) => {
  console.log('🌿 Creating branch from node:', node.id);

  setIsViewingHistory(false);
  setActiveRestoredNodeId(null);
  
  const branchNumber = nextBranchNumber;
  const styleIndex = ((branchNumber - 1) % (BRANCH_STYLES.length - 1)) + 1;
  const style = BRANCH_STYLES[styleIndex];
  
  // Generate instant name from node message
  const instantName = node.userMessage
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .slice(0, 4)
    .join(' ')
    .slice(0, 35);

  let aiBranchName = `${style.name} ${branchNumber}`;
  if (instantName && instantName.length > 2) {
    aiBranchName = instantName;
  }
  
  const newBranchId = `branch_${Date.now()}`;
  const newBranch: Branch = {
    id: newBranchId,
    name: aiBranchName,
    color: style.color,
    bgTint: style.bgTint,
    icon: style.icon,
    breadcrumbColor: style.breadcrumbColor,
    createdAt: new Date().toISOString(),
    document: node.documentSnapshot || { 
      content: node.documentContent || '', 
      lastUpdated: new Date().toISOString(), 
      title: node.documentSnapshot?.title || 'Notes' 
    },
    collapsed: false
  };
  
  setBranches(prev => [...prev, newBranch]);
  setNextBranchNumber(prev => prev + 1);
  setCurrentBranchId(newBranchId);
  
  // Create branch node
  const branchNode: TimelineNode = {
    id: `branch_node_${Date.now()}`,
    userMessage: node.userMessage,
    assistantMessage: node.assistantMessage,
    timestamp: new Date().toISOString(),
    documentContent: node.documentContent,
    documentSnapshot: node.documentSnapshot,
    messagesSnapshot: node.messagesSnapshot,
    parentId: node.id,
    branchId: newBranchId
  };
  
  setTimelineNodes(prev => [branchNode, ...prev]);
  
  // Restore the exact state from the node
  if (node.messagesSnapshot && node.messagesSnapshot.length > 0) {
    setMessages([...node.messagesSnapshot]);
  }
  
  if (node.documentSnapshot) {
    setLivingDocument({ ...node.documentSnapshot });
    setEditTitleValue(node.documentSnapshot.title || 'Notes');
  }
  
  lastNodeIdRef.current = node.id;
  
  addActivityToBackend(`🌿 Created new branch: "${newBranch.name}"`, 'system');
  
  // Save to session
  if (currentSessionId) {
    const updatedBranches = [...branches, newBranch];
    await fetch(`${API_URL}/sessions/${currentSessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branches: updatedBranches, timelineNodes: [branchNode, ...timelineNodes] })
    });
  }
  
  setShowTimeline(false);
  
  // Scroll to bottom of chat (not top)
  if (messagesContainerRef.current) {
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }
  
  setShowRestoreNotification(true);
  setTimeout(() => setShowRestoreNotification(false), 3000);
};
  const copyNodeMessage = async (message: string, nodeId: string) => {
    await navigator.clipboard.writeText(message);
    setCopiedNodeId(nodeId);
    setTimeout(() => setCopiedNodeId(null), 2000);
    addActivityToBackend(`📋 Copied message to clipboard`, 'system');
  };

  const returnToCurrent = async () => {
  if (!currentSessionId) return;

  console.log('🔓 Returning to current conversation...');
  
  // FIRST: Save the current session to ensure latest state is stored
  await saveCurrentSession();
  
  // SECOND: Reset history flags
  setIsViewingHistory(false);
  setActiveRestoredNodeId(null);
  
  // THIRD: Force reload the session from server
  const res = await fetch(`${API_URL}/sessions/${currentSessionId}`);
  const session = await res.json();
  
  // FOURTH: Restore the latest messages (not from the node)
  setMessages(session.messages || []);
  
  if (session.document) {
    setLivingDocument(session.document);
  }
  
  // Scroll to bottom
  if (messagesContainerRef.current) {
    setTimeout(() => {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }, 100);
  }
  
  addActivityToBackend(`↺ Returned to current conversation`, 'system');
};

  const handleCanvasFileChange = (fileName: string, newContent: string) => { setCanvasFiles(prev => prev.map(f => f.name === fileName ? { ...f, content: newContent } : f)); };
  const handleCanvasFileSelect = (fileName: string) => setActiveCanvasFile(fileName);
  

  const handleAddFile = () => {
    const fileName = prompt('Enter file name:');
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const iconMap: Record<string, string> = { 'html': '🌐', 'css': '🎨', 'js': '📜', 'py': '🐍', 'json': '📋', 'md': '📝' };
      setCanvasFiles(prev => [...prev, { name: fileName, content: `// New file: ${fileName}`, language: ext, icon: iconMap[ext] || '📄' }]);
      setActiveCanvasFile(fileName);
    }
  };
  
  const handleDeleteFile = (fileName: string) => {
    if (canvasFiles.length === 1) { alert('Cannot delete the last file'); return; }
    setCanvasFiles(prev => prev.filter(f => f.name !== fileName));
    if (activeCanvasFile === fileName) setActiveCanvasFile(canvasFiles[0]?.name || '');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log('🟣 handleFileUpload triggered', e.target.files);
  const file = e.target.files?.[0];
  if (!file) {
    console.log('🔴 No file selected');
    return;
  }
  
  console.log('🟢 File selected:', file.name, file.type, file.size);
  setUploading(true);
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    console.log('🟡 Sending to:', `${API_URL}/upload`);
    const res = await fetch(`${API_URL}/upload`, { 
      method: 'POST', 
      body: formData
      // Don't set Content-Type header! Let browser set it with boundary
    });
    
    console.log('🟠 Response status:', res.status);
    const data = await res.json();
    console.log('🟢 Response data:', data);
    
    if (data.success) {
      addActivityToBackend(`📎 File uploaded: ${data.fileName}`, 'system');
      // Optional: Auto-fill input with file preview
      if (data.preview) {
        setInput(`I've uploaded a file: ${data.fileName}\n\n${data.preview}\n\nWhat do you think?`);
      }
    } else {
      console.error('Upload failed:', data);
    }
  } catch (error) {
    console.error('🔴 Upload error:', error);
  } finally {
    setUploading(false);
    // Clear the file input so same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !secretaryMode && input.trim()) {
    e.preventDefault();
    // Only stop AI in text mode if user explicitly sends a new message
    // This is fine - user wants to send a new message, so stopping is expected
    if (isSpeaking || isStreaming) {
      stopAIResponse();
    }
    const messageToSend = input;
    setTimeout(() => {
      sendStreamingMessage(messageToSend);
      if (messageToSend.trim().length > 5) {
        triggerLiveJanitor(messageToSend);
      }
      setInput('');
    }, 50);
  }
};

  const manualSync = async () => { if (currentSessionId) await loadSession(currentSessionId); };

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => {
    if (currentSessionId) { const timeout = setTimeout(() => saveCurrentSession(), 1000); return () => clearTimeout(timeout); }
  }, [messages, livingDocument, canvasFiles, timelineNodes, branches, decisions, currentSessionId]);

  useEffect(() => {
  if (shouldAutoScroll.current && messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }
}, [messages]);

  const renderDocument = () => {
    if (!livingDocument.content || livingDocument.content.trim() === '' || livingDocument.content.length < 10) {
      return ( <div className="doc-empty"><FileText size={32} /><h3>Document will appear here</h3><p>Butler automatically documents your conversation as you speak.</p></div> );
    }
    const sections = livingDocument.content.split(/(?=^## )/gm);
    return ( <div className="doc-content" ref={documentContentRef}>
      {sections.map((section, idx) => {
        const sectionTitle = section.match(/^## (.*)$/m)?.[1] || '';
        const isHighlighted = lastDocumentUpdate?.section === sectionTitle;
        return ( <div key={idx} data-section={sectionTitle} className={`doc-section ${isHighlighted ? 'flash-update' : ''}`} style={{ animation: isHighlighted ? 'flashGold 1s ease' : 'none' }}><ReactMarkdown>{section}</ReactMarkdown></div> );
      })}
      <div className="doc-footer"><span>Last updated: {new Date(livingDocument.lastUpdated).toLocaleString()}</span><span className="doc-topic-tag">Topic: {livingDocument.title}</span></div>
    </div> );
  };

  const getNodesByBranch = () => {
    const grouped: Map<string, TimelineNode[]> = new Map();
    const mainNodes = timelineNodes.filter(node => node.branchId === 'main');
    grouped.set('main', mainNodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    branches.forEach(branch => {
      const branchNodes = timelineNodes.filter(node => node.branchId === branch.id);
      grouped.set(branch.id, branchNodes.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    });
    return grouped;
  };

  const getParentInfo = (node: TimelineNode) => {
    if (!node.parentId) return null;
    const parent = timelineNodes.find(n => n.id === node.parentId);
    if (!parent) return null;
    const parentBranchStyle = getBranchStyle(parent.branchId);
    return { message: parent.userMessage, branchId: parent.branchId, branchName: getBranchName(parent.branchId), branchIcon: parentBranchStyle.icon };
  };

  const matchesSearch = (text: string) => { if (!searchTerm) return true; return text.toLowerCase().includes(searchTerm.toLowerCase()); };
  const nodesByBranch = getNodesByBranch();

  const renderBranchGroup = (branchId: string, branchNodes: TimelineNode[], level: number = 0, visitedBranches: Set<string> = new Set()) => {
  // 🔴 PREVENT INFINITE RECURSION
  if (visitedBranches.has(branchId)) {
    console.warn('Circular branch reference detected, skipping:', branchId);
    return null;
  }
  
  const newVisited = new Set(visitedBranches);
  newVisited.add(branchId);
  
  const branch = branches.find(b => b.id === branchId);
  const isMain = branchId === 'main';
  const branchStyle = isMain ? BRANCH_STYLES[0] : {
    color: branch?.color || BRANCH_STYLES[0].color,
    bgTint: branch?.bgTint || BRANCH_STYLES[0].bgTint,
    icon: branch?.icon || BRANCH_STYLES[0].icon,
    breadcrumbColor: branch?.breadcrumbColor || BRANCH_STYLES[0].breadcrumbColor,
    name: branch?.name || 'Branch'
  };
  
  const isExpanded = expandedBranches.has(branchId);
  const messageCount = branchNodes.length;
  
  return (
    <div key={branchId} className="timeline-branch-group" style={{ marginLeft: level * 16 }}>
      {/* Branch Header - Collapsible */}
      <div 
        className="timeline-branch-header-collapsible"
        onClick={() => toggleBranchExpansion(branchId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          marginTop: level > 0 ? '8px' : '0',
          marginBottom: '8px',
          backgroundColor: `${branchStyle.color}10`,
          borderRadius: '6px',
          cursor: 'pointer',
          borderLeft: `3px solid ${branchStyle.color}`,
          userSelect: 'none'
        }}
      >
        <span style={{ fontSize: '12px', color: branchStyle.color }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="branch-icon" style={{ color: branchStyle.color }}>{branchStyle.icon}</span>
        
        {/* Branch Name - Clickable to rename */}
        {renamingBranchId === branchId ? (
          <input
            type="text"
            value={branchRenameValue}
            onChange={(e) => setBranchRenameValue(e.target.value)}
            onBlur={() => {
              renameBranch(branchId, branchRenameValue);
              setRenamingBranchId(null);
              setBranchRenameValue('');
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                renameBranch(branchId, branchRenameValue);
                setRenamingBranchId(null);
                setBranchRenameValue('');
              }
            }}
            autoFocus
            style={{
              background: '#1a1a1a',
              color: branchStyle.color,
              border: `1px solid ${branchStyle.color}`,
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
              flex: 1
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            className="branch-name" 
            style={{ 
              color: branchStyle.color, 
              fontWeight: 'bold', 
              flex: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenamingBranchId(branchId);
              setBranchRenameValue(isMain ? 'Main Branch' : branchStyle.name);
            }}
            title="Double-click to rename"
          >
            {isMain ? 'Main Branch' : branchStyle.name}
            <Edit3 size={10} style={{ opacity: 0.5 }} />
          </span>
        )}
        
        <span className="branch-count" style={{ fontSize: '11px', opacity: 0.7 }}>
          {messageCount} {messageCount === 1 ? 'message' : 'messages'}
        </span>
        
        {/* RENAME BUTTON - Pencil icon */}
        {!isMain && renamingBranchId !== branchId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRenamingBranchId(branchId);
              setBranchRenameValue(branchStyle.name);
            }}
            title="Rename branch"
            style={{
              background: 'none',
              border: 'none',
              color: branchStyle.color,
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              opacity: 0.6,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
          >
            <Edit3 size={12} />
          </button>
        )}
        
        {/* DELETE BUTTON */}
        {!isMain && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete branch "${branchStyle.name}"? This cannot be undone.`)) {
                deleteBranch(branchId);
              }
            }}
            title="Delete branch"
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              opacity: 0.6,
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      
      {/* Branch Content - Only show if expanded */}
      {isExpanded && (
        <div className="timeline-branch-content" style={{ marginLeft: '16px' }}>
          {branchNodes.map((node, idx) => {
            // Check if this node has child branches
            const childBranches = branches.filter(b => {
              const hasConnection = timelineNodes.some(n => 
                n.parentId === node.id && n.branchId === b.id
              );
              return hasConnection;
            });
            
            const isLastNode = idx === branchNodes.length - 1;
            
            return (
              <div key={node.id} style={{ position: 'relative' }}>
                {/* Vertical connector line */}
                {!isLastNode && (
                  <div style={{
                    position: 'absolute',
                    left: '-8px',
                    top: '0',
                    bottom: '0',
                    width: '2px',
                    backgroundColor: `${branchStyle.color}30`,
                  }} />
                )}
                
                {/* The message node */}
                {renderTreeNode(node, branchStyle, isLastNode)}
                
                {/* Child branches (nested) - PASS THE VISITED SET */}
                {childBranches.map(childBranch => {
                  const childNodes = timelineNodes.filter(n => n.branchId === childBranch.id);
                  
                  return (
                    <div key={childBranch.id} style={{ position: 'relative', marginTop: '8px' }}>
                      {/* Branch connection indicator */}
                      <div style={{
                        position: 'absolute',
                        left: '-8px',
                        top: '-12px',
                        width: '16px',
                        height: '24px',
                        borderLeft: `2px dashed ${childBranch.color}`,
                        borderBottom: `2px dashed ${childBranch.color}`,
                        borderBottomLeftRadius: '8px'
                      }} />
                      {renderBranchGroup(childBranch.id, childNodes, level + 1, newVisited)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const renderTreeNode = (node: TimelineNode, branchStyle: any, isLastNode: boolean) => {
  const isActive = activeRestoredNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const isCopied = copiedNodeId === node.id;
  
  return (
    <div 
      className={`timeline-node-card ${isActive ? 'active' : ''}`}
      style={{ 
        marginBottom: '8px',
        marginLeft: '16px',
        backgroundColor: branchStyle.bgTint,
        borderLeft: `3px solid ${branchStyle.color}`,
        borderRadius: '6px',
        padding: '10px 12px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={() => setHoveredNodeId(node.id)}
      onMouseLeave={() => setHoveredNodeId(null)}
    >
      {/* Message content - click to restore */}
      <div onClick={() => restoreFromNode(node)} style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: branchStyle.color }}>{branchStyle.icon}</span>
            <span style={{ fontSize: '10px', opacity: 0.6 }}>
              {new Date(node.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); copyNodeMessage(node.userMessage, node.id); }}
              title="Copy message"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '4px',
                borderRadius: '4px',
                color: '#888',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div style={{ 
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: '10px'
        }}>
          {highlightSearchTerm(node.userMessage.slice(0, 70))}{node.userMessage.length > 70 ? '...' : ''}
        </div>
      </div>
      
      {/* BRANCH BUTTON - Bottom right corner */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            branchFromNode(node); 
          }}
          style={{
            background: branchStyle.color,
            color: '#000',
            border: 'none',
            padding: '4px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'transform 0.1s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <GitBranch size={10} />
          Branch
        </button>
      </div>
      
      {/* Tooltip on hover */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          backgroundColor: '#1a1a1a',
          border: `1px solid ${branchStyle.color}`,
          borderRadius: '6px',
          padding: '10px',
          zIndex: 1000,
          width: '280px',
          fontSize: '11px',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          marginBottom: '8px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: branchStyle.color }}>Message:</div>
          <div style={{ marginBottom: '8px' }}>{node.userMessage}</div>
          {node.assistantMessage && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: branchStyle.color, fontSize: '10px' }}>Response preview:</div>
              <div style={{ opacity: 0.8 }}>{node.assistantMessage.slice(0, 120)}...</div>
            </>
          )}
          <div style={{ marginTop: '8px', fontSize: '9px', opacity: 0.5, borderTop: '1px solid #333', paddingTop: '6px' }}>
            Click message to restore • Click "Branch" to create new path
          </div>
        </div>
      )}
    </div>
  );
};

  const getAgentIcon = (agent?: ActivityLog['agent']) => { switch (agent) { case 'user': return '👤'; case 'fast-brain': return '🧠'; case 'janitor': return '🧹'; default: return '🤖'; } };
  const getAgentColor = (agent?: ActivityLog['agent']) => { switch (agent) { case 'user': return '#60a5fa'; case 'fast-brain': return '#10a37f'; case 'janitor': return '#f59e0b'; default: return '#64748b'; } };

  const highlightSearchTerm = (text: string) => {
  if (!searchTerm) return text;
  
  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return parts.map((part, i) => 
    part.toLowerCase() === searchTerm.toLowerCase() 
      ? <span key={i} style={{ backgroundColor: '#F5C451', color: '#000', fontWeight: 'bold' }}>{part}</span>
      : part
  );
};

  return (
  <div className={`app ${secretaryMode ? 'secretary-active' : ''}`}>
    {showBootSequence && <BootSequence onComplete={handleBootComplete} />}
    <div className="crt-overlay"></div>
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-symbol">◆</span>
          <span className="logo-text">Butler</span>
        </div>
        {currentBranchId !== 'main' && (
          <div className="current-branch-indicator" style={{ backgroundColor: getBranchStyle(currentBranchId).bgTint, borderLeftColor: getBranchStyle(currentBranchId).color, borderLeftWidth: '3px', borderLeftStyle: 'solid', padding: '4px 12px', borderRadius: '20px', marginLeft: '16px', fontSize: '0.75rem' }}>
            <span style={{ color: getBranchStyle(currentBranchId).color }}>{getBranchStyle(currentBranchId).icon}</span>
            <span style={{ marginLeft: '6px' }}>Currently in: {getBranchName(currentBranchId)}</span>
          </div>
        )}
      </div>
      <div className="header-right">
        <button className={`header-btn ${showTimeline ? 'active' : ''}`} onClick={() => setShowTimeline(!showTimeline)}>
          <GitBranch size={14} /><span>Timeline</span>
        </button>
        <button className={`header-btn ${showDocumentPanel ? 'active' : ''}`} onClick={() => setShowDocumentPanel(!showDocumentPanel)}>
          <FileText size={14} /><span>Document</span>
        </button>
        <button className="header-btn" onClick={manualSync}>
          <Sparkles size={14} /><span>Sync</span>
        </button>
        <button className={`header-btn ${showCodeCanvas ? 'active' : ''}`} onClick={() => setShowCodeCanvas(!showCodeCanvas)}>
          {showCodeCanvas ? <X size={14} /> : <Menu size={14} />}<span>{showCodeCanvas ? 'Close' : 'Code'}</span>
        </button>
      </div>
    </header>

    <div className={`main-layout ${showCodeCanvas ? 'has-codespace' : ''}`}>
      <div className="chat-sidebar-container">
        <button className="chat-edge-toggle" onClick={() => setShowChatSidebar(!showChatSidebar)}>
          {showChatSidebar ? '←' : '💬'}
        </button>
        <div className={`chat-history-sidebar ${showChatSidebar ? 'expanded' : 'collapsed'}`}>
          <div className="chat-history-header">
            <button className="new-chat-btn" onClick={createNewSession}>
              <Plus size={14} /> New chat
            </button>
          </div>
          <div className="chat-history-list" ref={chatHistoryListRef}>
            {sessions.map(session => (
              <div key={session.id} className={`chat-history-item ${currentSessionId === session.id ? 'active' : ''}`} onClick={() => loadSession(session.id)}>
                <div className="session-info">
                  <span className="session-title">{session.title}</span>
                  <span className="session-date">{new Date(session.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="chat-actions">
                  <button className="pin-chat-btn" onClick={(e) => { e.stopPropagation(); pinSession(session.id, !session.pinned); }}>📌</button>
                  <button className="delete-chat-btn" onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chat-area">
        <div className="chat-messages-area" ref={messagesContainerRef}>
          <div className="chat-messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat-area">
                <div className="empty-chat-icon">💬</div>
                <p>What can I help you with?</p>
                <button className="voice-demo-btn" onClick={toggleSecretaryMode}>
                  <Brain size={16} /> {secretaryMode ? 'Stop Secretary Mode' : 'Start Secretary Mode'}
                </button>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                  <div className="chat-bubble-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <div className="chat-bubble-time">{msg.timestamp}</div>
                </div>
              ))
            )}
            {isStreaming && (
              <div className="chat-bubble assistant thinking">
                <div className="pixel-spinner">
                  <span className="pixel-dot"></span>
                  <span className="pixel-dot"></span>
                  <span className="pixel-dot"></span>
                  <span className="pixel-dot"></span>
                  <span className="pixel-dot"></span>
                  <span style={{ marginLeft: '6px' }}>THINKING</span>
                </div>
              </div>
            )}
              <div ref={messagesEndRef} />
          </div>
        </div>

        {isViewingHistory && (
  <div style={{
    background: 'rgba(245, 196, 81, 0.15)',
    border: '1px solid #F5C451',
    borderRadius: '8px',
    padding: '8px 12px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8rem'
  }}>
    <span>🔍 Viewing historical conversation point</span>
  </div>
)}

        {secretaryMode && (
          <div className="transcript-panel">
            <div className="transcript-header">
              <div className="transcript-title">
                <Brain size={14} /><span>Secretary Mode Active</span>
                <span className="transcript-badge">Listening & Documenting</span>
              </div>
              <div className="transcript-actions">
                {isJanitorProcessing && <span className="janitor-status"><Activity size={12} /> Updating document...</span>}
                {isSpeaking && <span className="speaking-status"><Volume2 size={12} /> Speaking...</span>}
                {showIntentIndicator && (
                  <div className={`intent-badge intent-${detectedIntent}`}>
                    {detectedIntent === 'direct_address' && '🎯 Speaking to me'}
                    {detectedIntent === 'question' && '❓ Question detected'}
                    {detectedIntent === 'command' && '⚡ Command detected'}
                    {detectedIntent === 'brainstorming' && '💭 Brainstorming'}
                    {detectedIntent === 'unknown' && '🤔 Listening'}
                    <span className="intent-confidence">{intentConfidence}%</span>
                  </div>
                )}
                {wakeWordTriggered && (
                  <div className="wake-word-indicator" style={{ background: '#10a37f', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Brain size={12} /> Listening to you...
                  </div>
                )}
                {isProcessingWakeWord && (
                  <div className="processing-indicator" style={{ background: '#f59e0b', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem' }}>
                    🤔 Thinking...
                  </div>
                )}
                {isSpeaking && (
                  <div className="speaking-indicator" style={{ background: '#10a37f', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem' }}>
                    🔊 Speaking...
                  </div>
                )}
                <button className="transcript-cancel-btn" onClick={toggleSecretaryMode}>
                  <X size={14} /> Exit
                </button>
              </div>
            </div>
            <div className="transcript-content">
              {transcriptSegments.length === 0 ? (
                <div className="transcript-empty">
                  <Volume2 size={24} />
                  <p>Speak naturally. Butler listens and documents silently.</p>
                  <small>Say "Butler" followed by your question to get a response</small>
                </div>
              ) : (
                <>
                  {transcriptSegments.map((segment, idx) => (
                    <div key={idx} className="transcript-segment">
                      <div className="segment-header">
                        <div className="segment-time">{new Date().toLocaleTimeString()}</div>
                      </div>
                      <div className="segment-text">{segment}</div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>
          </div>
        )}

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <input
              value={input}
              onChange={(e) => {
                if ((secretaryMode || interactiveMode) && (isSpeaking || isStreaming)) {
                  stopAIResponse();
                }
                setInput(e.target.value);
              }}
              placeholder={
                isViewingHistory 
                  ? "🔒 Viewing past conversation - click 'Return to Current' above to chat" 
                  : (secretaryMode ? "Secretary mode active - speak naturally" : "Type your message...")
              }
              onKeyPress={handleKeyPress}
              disabled={secretaryMode || isViewingHistory}
            />
            <div className="voice-controls">
            <button
              className={`mute-btn ${isMuted ? 'muted' : ''}`}
              onClick={toggleMute}
              title={isMuted ? "Unmute AI voice" : "Mute AI voice"}
              style={{
                background: isMuted ? '#EF4444' : '#2d3748',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                transition: 'all 0.2s'
              }}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              <span>{isMuted ? 'Muted' : 'Sound'}</span>
            </button>

            <ModeToggle
              secretaryMode={secretaryMode}
              interactiveMode={interactiveMode}
              onToggle={(mode) => {
                if (mode === 'interactive') {
                  setInteractiveMode(!interactiveMode);
                } else if (mode === 'secretary') {
                  toggleSecretaryMode();
                }
              }}
              onSecretaryToggle={toggleSecretaryMode}
            />

            {secretaryMode && voiceActivity === 'listening' && (
              <div className="waveform secretary-waveform">
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
                <div className="wave-bar"></div>
              </div>
            )}
          </div>
            <button
              className="send-btn"
              onClick={() => {
                if (input.trim()) {
                  if (isSpeaking || isStreaming) {
                    stopAIResponse();
                  }
                  const messageToSend = input;
                  setTimeout(() => {
                    sendStreamingMessage(messageToSend);
                    if (messageToSend.trim().length > 5) {
                      triggerLiveJanitor(messageToSend);
                    }
                    setInput('');
                  }, 50);
                }
              }}
              disabled={loading || secretaryMode || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {showTimeline && (
        <div className={`timeline-panel ${showTimelineMobile ? 'visible' : ''}`}>
          <div className="timeline-header">
            <h3>Conversation Timeline</h3>
            <div className="timeline-search">
              <input type="text" placeholder="Search messages..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="search-input" />
            </div>
            <button onClick={() => setShowTimeline(false)}>✕</button>
          </div>
          <div className="timeline-branch-list" ref={timelineListRef}>
            {(() => {
            const branchGroups = buildMessageTree();
            
            // Render main branch first - PASS EMPTY SET
            const mainNodes = branchGroups.get('main') || [];
            if (mainNodes.length > 0) {
              return renderBranchGroup('main', mainNodes, 0, new Set());
            }
            
            // If no main nodes, show empty state
            return (
              <div className="timeline-empty">
                <p>No timeline entries yet.</p>
                <small>Start a conversation to see your history here!</small>
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {showDocumentPanel && (
        <div className="document-panel">
          <div className="document-header">
            <div className="document-title-section">
              {isEditingTitle ? (
                <input type="text" value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)} onBlur={updateDocumentTitle} onKeyPress={(e) => e.key === 'Enter' && updateDocumentTitle()} autoFocus className="title-input" />
              ) : (
                <h2 onClick={() => { setIsEditingTitle(true); setEditTitleValue(livingDocument.title || 'Document'); }}>
                  {livingDocument.title || 'Document'}<Edit3 size={14} className="edit-icon" />
                </h2>
              )}
            </div>
            <div className="document-actions">
              <div className="document-agent-status">
                <span className="agent-badge janitor"><Brain size={12} /> {isJanitorProcessing ? 'Updating...' : 'Live'}</span>
              </div>
              <div className="export-dropdown">
                <button className="export-btn"><Download size={14} /> Export</button>
                <div className="export-menu">
                  <button onClick={exportAsMarkdown}>Markdown (.md)</button>
                  <button onClick={exportAsDocx}>Word (.doc)</button>
                  <button onClick={exportAsPdf}>PDF (Print)</button>
                </div>
              </div>
              <button className="close-doc-btn" onClick={() => setShowDocumentPanel(false)}><X size={16} /></button>
            </div>
          </div>
          <div className="document-body">{renderDocument()}</div>
        </div>
      )}

      <div className={`codespace-panel ${showCodeCanvas ? 'open' : ''}`}>
        {showCodeCanvas && canvasFiles.length > 0 && (
          <CodeSpace files={canvasFiles} activeFile={activeCanvasFile} onFileChange={handleCanvasFileChange} onFileSelect={handleCanvasFileSelect} onAddFile={handleAddFile} onDeleteFile={handleDeleteFile} onClose={() => setShowCodeCanvas(false)} />
        )}
        {showCodeCanvas && canvasFiles.length === 0 && (
          <div className="codespace-empty-state">
            <div className="codespace-empty-icon">📝</div>
            <p>No code generated yet</p>
            <small>Ask Butler to write code, and it will appear here</small>
          </div>
        )}
      </div>
    </div>

    <div className="activity-bar">
      <div className="activity-left">
        <Sparkles size={12} className="activity-icon" />
        <span className="activity-text">
          {secretaryMode ? '🎤 Secretary Mode - Listening and documenting silently' :
           voiceActivity === 'listening' ? '🎤 Listening...' : 
           voiceActivity === 'speaking' ? '🔊 Speaking...' :
           'Butler is ready'}
        </span>
      </div>
      <div className="activity-feed">
        {activities.slice(0, 5).map((activity, idx) => (
          <div key={idx} className="activity-item" style={{ borderLeftColor: getAgentColor(activity.agent) }}>
            <span className="activity-agent">{getAgentIcon(activity.agent)}</span>
            <span className="activity-message">{activity.action}</span>
            <span className="activity-time">{new Date(activity.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        {activities.length > 5 && <span className="activity-count">+{activities.length - 5} more</span>}
      </div>
    </div>

    {showRestoreNotification && (
      <div className="restore-notification">
        ✓ Conversation restored to selected point
      </div>
    )}
  </div>
);
}

export default App;