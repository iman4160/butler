import React, { useState, useEffect, useRef } from 'react';
import { Copy, Play, Check, X, Code2, Eye, FileCode, Save } from 'lucide-react';

interface File {
  name: string;
  content: string;
  language: string;
  icon: string;
}

interface CodeCanvasProps {
  files: File[];
  activeFile: string;
  onFileChange: (fileName: string, newContent: string) => void;
  onFileSelect: (fileName: string) => void;
  onAddFile?: () => void;
  onDeleteFile?: (fileName: string) => void;
  aiSuggestion?: {
    original: string;
    suggested: string;
    explanation: string;
    fileName: string;
  } | null;
  onAcceptSuggestion?: () => void;
  onRejectSuggestion?: () => void;
  isProcessing?: boolean;
}

const CodeCanvas: React.FC<CodeCanvasProps> = ({
  files,
  activeFile,
  onFileChange,
  onFileSelect,
  onAddFile,
  onDeleteFile,
  aiSuggestion,
  onAcceptSuggestion,
  onRejectSuggestion,
  isProcessing = false,
}) => {
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentFile = files.find(f => f.name === activeFile) || files[0];

  // Generate preview HTML for the current project
  const generatePreviewHtml = () => {
    const htmlFile = files.find(f => f.name === 'index.html');
    const cssFile = files.find(f => f.name === 'style.css');
    const jsFile = files.find(f => f.name === 'script.js');

    if (!htmlFile) return '<div style="padding: 20px; text-align: center; color: #666;">No HTML file to preview</div>';

    let html = htmlFile.content;

    // Inject CSS if exists
    if (cssFile && !html.includes('<style>')) {
      html = html.replace('</head>', `<style>/* Auto-injected CSS */\n${cssFile.content}\n</style>\n</head>`);
    }

    // Inject JS if exists
    if (jsFile && !html.includes('<script>')) {
      html = html.replace('</body>', `<script>\n/* Auto-injected JavaScript */\n${jsFile.content}\n</script>\n</body>`);
    }

    return html;
  };

  // Update preview when files change
  useEffect(() => {
    if (iframeRef.current && viewMode === 'preview') {
      const previewHtml = generatePreviewHtml();
      iframeRef.current.srcdoc = previewHtml;
    }
  }, [files, viewMode]);

  const handleCopy = async () => {
    if (currentFile) {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onFileChange(activeFile, e.target.value);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return '🌐';
    if (fileName.endsWith('.css')) return '🎨';
    if (fileName.endsWith('.js')) return '📜';
    if (fileName.endsWith('.py')) return '🐍';
    if (fileName.endsWith('.json')) return '📋';
    if (fileName.endsWith('.md')) return '📝';
    return '📄';
  };

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.py')) return 'python';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.md')) return 'markdown';
    return 'text';
  };

  // Diff viewer component
  const DiffViewer = ({ original, suggested }: { original: string; suggested: string }) => {
    // Simple diff highlighting - finds the changed parts
    const findDifference = () => {
      if (original === suggested) return null;
      
      // Find where they differ
      let start = 0;
      let end = 0;
      while (start < original.length && start < suggested.length && original[start] === suggested[start]) {
        start++;
      }
      while (end < original.length - start && end < suggested.length - start && 
             original[original.length - 1 - end] === suggested[suggested.length - 1 - end]) {
        end++;
      }
      
      const oldChanged = original.slice(start, original.length - end);
      const newChanged = suggested.slice(start, suggested.length - end);
      
      return { oldChanged, newChanged, start, end };
    };
    
    const diff = findDifference();
    
    if (!diff) {
      return <div className="diff-no-change">No changes detected</div>;
    }
    
    return (
      <div className="diff-container">
        <div className="diff-old">
          <div className="diff-header">❌ Original</div>
          <pre className="diff-code diff-removed">
            {diff.oldChanged}
          </pre>
        </div>
        <div className="diff-arrow">→</div>
        <div className="diff-new">
          <div className="diff-header">✅ Suggested</div>
          <pre className="diff-code diff-added">
            {diff.newChanged}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="code-canvas">
      {/* Header */}
      <div className="canvas-header">
        <div className="canvas-title">
          <Code2 size={16} />
          <span>Code Canvas</span>
        </div>
        <div className="canvas-actions">
          <button 
            className={`canvas-view-btn ${viewMode === 'code' ? 'active' : ''}`}
            onClick={() => setViewMode('code')}
          >
            <FileCode size={14} />
            Code
          </button>
          <button 
            className={`canvas-view-btn ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
          >
            <Eye size={14} />
            Preview
          </button>
          <button className="canvas-action-btn" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="canvas-tabs">
        {files.map((file) => (
          <div
            key={file.name}
            className={`canvas-tab ${activeFile === file.name ? 'active' : ''}`}
            onClick={() => onFileSelect(file.name)}
          >
            <span className="tab-icon">{file.icon || getFileIcon(file.name)}</span>
            <span className="tab-name">{file.name}</span>
            {onDeleteFile && files.length > 1 && (
              <button 
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onDeleteFile(file.name); }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {onAddFile && (
          <button className="canvas-tab-add" onClick={onAddFile}>
            + New File
          </button>
        )}
      </div>

      {/* AI Suggestion Banner */}
      {aiSuggestion && aiSuggestion.fileName === activeFile && (
        <div className="ai-suggestion-banner">
          <div className="suggestion-header">
            <span className="suggestion-icon">🤖</span>
            <span className="suggestion-title">AI Suggestion</span>
            <span className="suggestion-explanation">{aiSuggestion.explanation}</span>
          </div>
          <div className="suggestion-actions">
            <button className="suggestion-accept" onClick={onAcceptSuggestion}>
              <Check size={14} /> Accept
            </button>
            <button className="suggestion-reject" onClick={onRejectSuggestion}>
              <X size={14} /> Reject
            </button>
            <button className="suggestion-show-diff" onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
          </div>
          {showDiff && (
            <div className="suggestion-diff">
              <DiffViewer original={aiSuggestion.original} suggested={aiSuggestion.suggested} />
            </div>
          )}
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="canvas-processing">
          <div className="processing-spinner"></div>
          <span>AI is thinking...</span>
        </div>
      )}

      {/* Main Content */}
      <div className="canvas-content">
        {viewMode === 'code' ? (
          <textarea
            ref={textareaRef}
            className="canvas-editor"
            value={currentFile?.content || ''}
            onChange={handleContentChange}
            spellCheck={false}
            disabled={isProcessing}
          />
        ) : (
          <div className="canvas-preview">
            <div className="preview-toolbar">
              <span>Live Preview</span>
              <button onClick={() => iframeRef.current?.contentWindow?.location.reload()}>
                <Play size={12} /> Refresh
              </button>
            </div>
            <iframe
              ref={iframeRef}
              title="preview"
              srcDoc={generatePreviewHtml()}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              className="preview-frame"
            />
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="canvas-footer">
        <div className="canvas-status">
          <span className="status-dot" />
          <span>{currentFile?.language?.toUpperCase() || getLanguage(activeFile)}</span>
        </div>
        <div className="canvas-status">
          <span>Lines: {currentFile?.content?.split('\n').length || 0}</span>
        </div>
        <div className="canvas-status">
          <span>Chars: {currentFile?.content?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default CodeCanvas;