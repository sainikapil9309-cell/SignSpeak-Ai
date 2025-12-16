import React, { useState } from 'react';
import { Header } from './components/Header';
import { Interpreter } from './components/Interpreter';
import { Landing } from './components/Landing';

function App() {
  const [isInterpreterActive, setIsInterpreterActive] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      <Header />
      <main className="pt-16 min-h-screen">
        {!isInterpreterActive ? (
          <Landing onStart={() => setIsInterpreterActive(true)} />
        ) : (
          <div className="h-[calc(100vh-4rem)] p-4 md:p-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
             <Interpreter onBack={() => setIsInterpreterActive(false)} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;