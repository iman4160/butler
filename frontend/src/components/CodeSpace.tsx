import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Eye, FileCode, Plus, Trash2, X } from 'lucide-react';

interface File {
  name: string;
  content: string;
  language: string;
  icon: string;
}

interface CodeSpaceProps {
  files: File[];
  activeFile: string;
  onFileChange: (fileName: string, newContent: string) => void;
  onFileSelect: (fileName: string) => void;
  onAddFile?: () => void;
  onDeleteFile?: (fileName: string) => void;
  onClose?: () => void;
}

const CodeSpace: React.FC<CodeSpaceProps> = ({
  files,
  activeFile,
  onFileChange,
  onFileSelect,
  onAddFile,
  onDeleteFile,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const currentFile = files.find(f => f.name === activeFile) || files[0];

  const generatePreviewHtml = () => {
    const htmlFile = files.find(f => f.name === 'index.html');
    if (!htmlFile) return '<div style="padding: 20px; text-align: center; color: #666;">No HTML file to preview</div>';
    return htmlFile.content;
  };

  useEffect(() => {
    if (iframeRef.current && viewMode === 'preview') {
      iframeRef.current.srcdoc = generatePreviewHtml();
    }
  }, [files, viewMode]);

  const handleCopy = async () => {
    if (currentFile) {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.html')) return '🌐';
    if (fileName.endsWith('.css')) return '🎨';
    if (fileName.endsWith('.js')) return '📜';
    if (fileName.endsWith('.py')) return '🐍';
    if (fileName.endsWith('.json')) return '📋';
    return '📄';
  };

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.py')) return 'python';
    return 'text';
  };

  if (!currentFile) {
    return (
      <div className="codespace-empty-state">
        <div className="codespace-empty-icon">📝</div>
        <p>No code generated yet</p>
        <small>Ask Butler to write code, and it will appear here</small>
      </div>
    );
  }

  return (
    <div className="codespace">
      {/* Top Bar with File Tabs and Actions */}
      <div className="codespace-header">
        <div className="codespace-tabs">
          {files.map((file) => (
            <div 
              key={file.name} 
              className={`codespace-tab ${activeFile === file.name ? 'active' : ''}`}
              onClick={() => onFileSelect(file.name)}
            >
              <span className="tab-icon">{file.icon || getFileIcon(file.name)}</span>
              <span className="tab-name">{file.name}</span>
              {onDeleteFile && files.length > 1 && (
                <button className="tab-delete" onClick={(e) => { e.stopPropagation(); onDeleteFile(file.name); }}>✕</button>
              )}
            </div>
          ))}
          {onAddFile && (
            <button className="codespace-add-tab" onClick={onAddFile}>
              <Plus size={14} /> New
            </button>
          )}
        </div>
        <div className="codespace-actions">
          <button 
            className={`action-btn ${viewMode === 'code' ? 'active' : ''}`} 
            onClick={() => setViewMode('code')}
            title="Code view"
          >
            <FileCode size={16} />
          </button>
          <button 
            className={`action-btn ${viewMode === 'preview' ? 'active' : ''}`} 
            onClick={() => setViewMode('preview')}
            title="Preview"
          >
            <Eye size={16} />
          </button>
          <button 
            className="action-btn copy-btn" 
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          {onClose && (
            <button 
              className="action-btn close-btn" 
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="codespace-content">
        {viewMode === 'code' ? (
          <textarea
            className="codespace-editor"
            value={currentFile.content}
            onChange={(e) => onFileChange(activeFile, e.target.value)}
            spellCheck={false}
          />
        ) : (
          <div className="codespace-preview">
            <div className="preview-bar">
              <span>Live Preview</span>
              <button onClick={() => iframeRef.current?.contentWindow?.location.reload()}>↻ Refresh</button>
            </div>
            <iframe ref={iframeRef} title="preview" srcDoc={generatePreviewHtml()} sandbox="allow-same-origin allow-scripts allow-popups allow-forms" className="preview-frame" />
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="codespace-footer">
        <span className="lang-badge">{getLanguage(activeFile).toUpperCase()}</span>
        <span>Lines: {currentFile.content?.split('\n').length || 0}</span>
        <span>Chars: {currentFile.content?.length || 0}</span>
      </div>
    </div>
  );
};

export default CodeSpace;