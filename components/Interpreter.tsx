import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Camera, Mic, MicOff, Video, VideoOff, Play, Square, AlertCircle, Volume2, Globe, LogOut, MessageSquareText, User, Bot, XCircle } from 'lucide-react';
import { ConnectionState, Message } from '../types';
import { 
  base64ToUint8Array, 
  blobToBase64, 
  decodeAudioData, 
  float32ToPCM16, 
  uint8ArrayToBase64,
  PCM_SAMPLE_RATE,
  INPUT_SAMPLE_RATE
} from '../services/audioUtils';

const VIDEO_FRAME_RATE = 2; // Frames per second sent to model
const JPEG_QUALITY = 0.6;

interface InterpreterProps {
  onBack: () => void;
}

export const Interpreter: React.FC<InterpreterProps> = ({ onBack }) => {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs for media management
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Scroll to bottom of chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscription]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAudioContexts = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE,
      });
    }
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: INPUT_SAMPLE_RATE,
      });
    }
  };

  const startSession = async () => {
    try {
      setErrorMsg(null);
      
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please check your deployment settings or .env file.");
      }

      setConnectionState(ConnectionState.CONNECTING);
      initializeAudioContexts();

      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (inputAudioContextRef.current?.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a friendly and helpful AI Sign Language Interpreter. Your task is to act as a bridge between a signer (video input) and a speaker/reader. 1. Watch the video stream carefully. When you see sign language (ASL), translate it into spoken English clearly and accurately. 2. When you hear spoken English (audio input), listen and understand the query, then either respond verbally or describe how to sign the response if asked. 3. If there is no active signing or speaking, remain silent. 4. Be concise. Do not hallucinate signs that aren't there.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setConnectionState(ConnectionState.CONNECTED);
            startAudioInput(stream);
            startVideoStreaming();
          },
          onmessage: async (message: LiveServerMessage) => {
            handleServerMessage(message);
          },
          onclose: (e) => {
            console.log('Gemini Live Session Closed', e);
            setConnectionState(ConnectionState.DISCONNECTED);
            stopMediaProcessing();
          },
          onerror: (e) => {
            console.error('Gemini Live Error', e);
            setConnectionState(ConnectionState.ERROR);
            setErrorMsg("Connection error occurred. Please try again.");
            stopSession();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;
      sessionPromise.then(session => {
        sessionRef.current = session;
      });

    } catch (err: any) {
      console.error("Failed to start session:", err);
      setConnectionState(ConnectionState.ERROR);
      setErrorMsg(err.message || "Failed to access camera/microphone or connect.");
      stopSession(); 
    }
  };

  const stopSession = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    stopMediaProcessing();

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (error) {
        console.warn("Failed to close session:", error);
      }
      sessionRef.current = null;
    }
    
    setConnectionState(ConnectionState.DISCONNECTED);
    // Note: We intentionally do NOT clear messages here so the user can read the history after stopping.
    setCurrentTranscription('');
  };

  const stopMediaProcessing = () => {
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  const startAudioInput = (stream: MediaStream) => {
    if (!inputAudioContextRef.current) return;
    
    const ctx = inputAudioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (isMuted) return; 
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = float32ToPCM16(inputData);
      const uint8 = new Uint8Array(pcm16.buffer);
      const base64 = uint8ArrayToBase64(uint8);

      sessionPromiseRef.current?.then((session) => {
        try {
          session.sendRealtimeInput({
            media: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64
            }
          });
        } catch (error) {
           console.warn("Error sending audio input:", error);
        }
      });
    };

    source.connect(processor);
    processor.connect(ctx.destination);
    
    sourceRef.current = source;
    processorRef.current = processor;
  };

  const startVideoStreaming = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = window.setInterval(() => {
      if (!isVideoEnabled || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(async (blob) => {
        if (blob) {
          const base64 = await blobToBase64(blob);
          sessionPromiseRef.current?.then((session) => {
            try {
              session.sendRealtimeInput({
                media: {
                  mimeType: 'image/jpeg',
                  data: base64
                }
              });
            } catch (error) {
              console.warn("Error sending video frame:", error);
            }
          });
        }
      }, 'image/jpeg', JPEG_QUALITY);

    }, 1000 / VIDEO_FRAME_RATE);
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && audioContextRef.current) {
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), ctx);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      const currentTime = ctx.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;
    }

    const outputTranscript = message.serverContent?.outputTranscription?.text;
    const inputTranscript = message.serverContent?.inputTranscription?.text;

    if (outputTranscript || inputTranscript) {
       if (outputTranscript) {
           setCurrentTranscription(prev => prev + outputTranscript);
       }
    }

    if (message.serverContent?.turnComplete) {
       // Check for input transcript to log user message
       // Note: The API sometimes batches transcripts. For this demo, we rely on output for 'model' 
       // and if we had robust input transcription storage we could log 'user' turns too. 
       // We'll log the model response here.
       
       const finalTranscript = currentTranscription;
       if (finalTranscript.trim()) {
           setMessages(prev => [...prev, {
               id: Date.now().toString(),
               role: 'model',
               text: finalTranscript,
               timestamp: new Date()
           }]);
           setCurrentTranscription(''); 
       }
    }
  };


  const toggleMute = () => setIsMuted(!isMuted);
  const toggleVideo = () => setIsVideoEnabled(!isVideoEnabled);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 max-w-8xl mx-auto">
      
      {/* LEFT COLUMN: VIDEO FEED */}
      <div className="flex flex-col gap-4 flex-grow lg:w-2/3 h-full min-h-[50vh]">
        <div className="relative flex-grow bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 ring-1 ring-white/10 group">
          
          <video 
            ref={videoRef} 
            className={`h-full w-full object-cover transition-opacity duration-500 ${connectionState === ConnectionState.CONNECTED && isVideoEnabled ? 'opacity-100' : 'opacity-20'}`}
            autoPlay 
            playsInline 
            muted 
          />
          
          {/* Connecting / Status States */}
          {(connectionState !== ConnectionState.CONNECTED || !isVideoEnabled) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-slate-900/50 backdrop-blur-sm">
              {connectionState === ConnectionState.CONNECTING ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Globe className="w-6 h-6 text-cyan-500" />
                    </div>
                  </div>
                  <p className="font-medium text-cyan-400 animate-pulse">Establishing Secure Connection...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                    <VideoOff className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="font-medium">Camera Inactive</p>
                  <button onClick={startSession} className="text-cyan-400 hover:text-cyan-300 hover:underline text-sm">
                    Start Session to activate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Badges */}
          {connectionState === ConnectionState.CONNECTED && (
            <div className="absolute top-6 left-6 flex items-center gap-3">
               <div className="flex items-center gap-2 bg-red-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-pulse">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  LIVE
               </div>
               <div className="hidden md:flex items-center gap-2 bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                  <Camera className="w-3 h-3" />
                  <span>Tracking Hands</span>
               </div>
            </div>
          )}

          {/* Live Captions Overlay */}
          {currentTranscription && (
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-20">
              <div className="text-center">
                 <span className="inline-block text-white text-xl md:text-3xl font-medium leading-relaxed drop-shadow-md font-sans">
                   {currentTranscription}
                 </span>
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div className="bg-slate-900/60 backdrop-blur-xl p-4 rounded-3xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
           
           <div className="flex items-center gap-4">
             {connectionState === ConnectionState.CONNECTED ? (
               <button 
                onClick={stopSession}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all hover:scale-105"
               >
                 <Square className="w-5 h-5 fill-current" />
                 <span>End Session</span>
               </button>
             ) : (
               <button 
                onClick={startSession}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
               >
                 <Play className="w-5 h-5 fill-current" />
                 <span>Start Interpreter</span>
               </button>
             )}
             
             {connectionState === ConnectionState.CONNECTED && (
               <div className="h-8 w-px bg-slate-700 mx-2 hidden sm:block" />
             )}

             {connectionState === ConnectionState.CONNECTED && (
               <div className="flex items-center gap-2">
                 <button 
                  onClick={toggleVideo} 
                  className={`p-3 rounded-xl transition-all ${isVideoEnabled ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-500/20 text-red-500'}`}
                  title="Toggle Video"
                 >
                   {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                 </button>
                 <button 
                  onClick={toggleMute} 
                  className={`p-3 rounded-xl transition-all ${!isMuted ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-500/20 text-red-500'}`}
                  title="Toggle Microphone"
                 >
                   {!isMuted ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                 </button>
               </div>
             )}
           </div>

           <div className="flex items-center gap-4 ml-auto">
             {errorMsg ? (
               <div className="flex items-center gap-2 text-red-400 text-sm font-medium bg-red-950/30 px-3 py-1.5 rounded-lg border border-red-900/50">
                 <AlertCircle className="w-4 h-4" />
                 <span className="truncate max-w-[200px]">{errorMsg}</span>
               </div>
             ) : (
                connectionState === ConnectionState.CONNECTED && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-900/50">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                    <span className="hidden sm:inline">Listening & Watching</span>
                  </div>
                )
             )}
             <button 
              onClick={onBack}
              className="p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border border-transparent hover:border-slate-700"
              title="Exit to Menu"
             >
               <LogOut className="w-5 h-5" />
             </button>
           </div>
        </div>
      </div>

      {/* RIGHT COLUMN: TRANSCRIPT / CHAT */}
      <div className="lg:w-1/3 h-full flex flex-col bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
         <div className="p-5 border-b border-white/10 bg-slate-900/90 flex items-center gap-3">
            <div className="p-2 bg-cyan-950/50 rounded-lg text-cyan-400">
               <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">Live Transcript</h2>
              <p className="text-xs text-slate-400">Real-time conversation history</p>
            </div>
         </div>
         
         <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {messages.length === 0 && !currentTranscription ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center opacity-60">
                 <MessageSquareText className="w-12 h-12 mb-4 stroke-1" />
                 <p className="text-sm">No conversation yet. <br/>Start speaking or signing to see transcription here.</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className="animate-in slide-in-from-bottom-2 duration-300">
                     <div className="flex items-start gap-3">
                        <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'model' ? 'bg-cyan-600' : 'bg-slate-600'}`}>
                           {msg.role === 'model' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
                        </div>
                        <div className="flex-1">
                           <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-200 capitalize">{msg.role === 'model' ? 'AI Interpreter' : 'You'}</span>
                              <span className="text-xs text-slate-500">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </div>
                           <div className="p-3 bg-slate-800/50 border border-white/5 rounded-2xl rounded-tl-none text-slate-300 text-sm leading-relaxed">
                              {msg.text}
                           </div>
                        </div>
                     </div>
                  </div>
                ))}
                {/* Current pending message placeholder if needed */}
                {currentTranscription && (
                   <div className="flex items-start gap-3 opacity-70">
                      <div className="mt-1 w-8 h-8 rounded-full bg-cyan-600/50 flex items-center justify-center shrink-0 animate-pulse">
                         <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                         <p className="text-sm font-bold text-cyan-400 mb-1">Typing...</p>
                         <div className="text-slate-400 text-sm italic">
                            {currentTranscription}
                         </div>
                      </div>
                   </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
         </div>
      </div>

    </div>
  );
}