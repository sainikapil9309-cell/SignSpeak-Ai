import React from 'react';
import { Hand, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 fixed top-0 left-0 right-0 z-50 flex items-center px-6 justify-between bg-slate-900/80 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Hand className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            SignSpeak AI
          </h1>
        </div>
      </div>
      <nav>
        <a 
          href="https://ai.google.dev" 
          target="_blank" 
          rel="noreferrer" 
          className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-950/30 px-3 py-1.5 rounded-full border border-cyan-500/20 hover:bg-cyan-950/50 transition-colors uppercase tracking-wider"
        >
          <Sparkles className="w-3 h-3" />
          Powered by Gemini 2.5
        </a>
      </nav>
    </header>
  );
};