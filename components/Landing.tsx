import React from 'react';
import { ArrowRight, Video, Globe, Zap, MessageSquare } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] text-center px-4 py-12 relative overflow-hidden">
       {/* Background Decoration */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-cyan-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-600 rounded-full blur-[128px]" />
       </div>

       {/* Hero */}
       <div className="relative space-y-8 max-w-4xl mx-auto z-10 mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-cyan-400 text-sm font-medium backdrop-blur-sm">
            <Zap className="w-4 h-4 fill-cyan-400/20" />
            <span>Powered by Gemini 2.5 Live API</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
            Breaking Barriers with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
              AI-Powered Interpretation
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Your personal real-time sign language interpreter. Seamlessly translate gestures into speech and convert conversations into text.
          </p>
          
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onStart}
              className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-full text-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] active:scale-95"
            >
              Start Interpreter
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="https://ai.google.dev" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-200 font-semibold rounded-full text-lg transition-all border border-slate-700 backdrop-blur-sm"
            >
              Documentation
            </a>
          </div>
       </div>

       {/* Features */}
       <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full relative z-10">
          {[
            { icon: Video, title: "Visual Recognition", desc: "Advanced computer vision tracks hand movements and gestures with high precision in real-time." },
            { icon: Globe, title: "Instant Translation", desc: "Seamlessly converts Sign Language (ASL) into spoken English, bridging the communication gap." },
            { icon: MessageSquare, title: "Live Transcription", desc: "Spoken words are instantly transcribed into text, allowing for full two-way accessibility." }
          ].map((feature, i) => (
            <div key={i} className="group bg-slate-900/40 border border-slate-800/50 p-8 rounded-3xl hover:bg-slate-800/40 hover:border-cyan-500/30 transition-all text-left backdrop-blur-sm">
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 group-hover:scale-110 transition-transform duration-300 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <feature.icon className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
       </div>
    </div>
  )
}