
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/Button';
import { PremiumModal } from './components/PremiumModal';
import { simplifyText, transcribeImage, generateExplanationAudio, decodeBase64ToUint8, decodeAudioData } from './services/geminiService';
import { ExplanationResult, UserProfile } from './types';

const INITIAL_PROFILE: UserProfile = {
  isPremium: false,
  usage: {
    count: 0,
    lastDate: new Date().toISOString().split('T')[0]
  }
};

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('expliquepramim_user');
    if (saved) {
      const parsed: UserProfile = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      if (parsed.usage.lastDate !== today) {
        parsed.usage.count = 0;
        parsed.usage.lastDate = today;
      }
      setUserProfile(parsed);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('expliquepramim_user', JSON.stringify(userProfile));
  }, [userProfile]);

  const handleUpgrade = () => {
    setUserProfile(prev => ({ ...prev, isPremium: true }));
    setIsModalOpen(false);
    alert("Parabéns! Você agora é um usuário Premium 🎉");
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const captureAndTranscribe = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsLoading(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
      
      try {
        const text = await transcribeImage(base64Image);
        setInputText(prev => prev + (prev ? '\n' : '') + text);
        stopCamera();
      } catch (err: any) {
        setError("Erro ao ler imagem: " + err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleExplain = async () => {
    if (!inputText.trim()) return;
    if (!userProfile.isPremium && userProfile.usage.count >= 3) {
      setIsModalOpen(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const explanationResult = await simplifyText(inputText);
      setResult(explanationResult);
      setUserProfile(prev => ({
        ...prev,
        usage: { ...prev.usage, count: prev.usage.count + 1 }
      }));
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAudio = async () => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    if (!result) return;

    try {
      setIsPlaying(true);
      setIsLoading(true);
      const audioData = await generateExplanationAudio(result.explanation);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const decodedData = decodeBase64ToUint8(audioData);
      const audioBuffer = await decodeAudioData(decodedData, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      
      audioSourceRef.current = source;
      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold text-slate-800 tracking-tight">Explique pra mim</span>
        </div>
        
        <div className="flex items-center gap-4">
          {!userProfile.isPremium && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hoje</span>
              <div className="flex gap-1 mt-0.5">
                {[1, 2, 3].map(num => (
                  <div key={num} className={`h-1.5 w-6 rounded-full transition-colors ${num <= userProfile.usage.count ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
          )}
          {userProfile.isPremium && (
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">Premium</span>
          )}
          <button onClick={() => setIsModalOpen(true)} className={`p-2 rounded-lg transition-colors ${userProfile.isPremium ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}>
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </nav>

      <main className="flex-1 px-4 sm:px-8 pb-20 max-w-5xl mx-auto w-full pt-8">
        {!result && (
          <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
              Entenda qualquer texto de forma <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">clara e sem complicações.</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Traduza termos difíceis para uma linguagem simples e direta. Use o campo abaixo ou aponte sua câmera para um documento.
            </p>
          </header>
        )}

        {/* Input Card */}
        <div className={`bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 border border-slate-100 transition-all duration-500 ${result ? 'mb-12 opacity-80 scale-95' : 'mb-8'}`}>
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">O que você deseja entender?</label>
            {!isCameraActive && (
              <button 
                onClick={startCamera}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Escanear Documento
              </button>
            )}
          </div>

          {isCameraActive ? (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video mb-6">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white/50 w-3/4 h-3/4 rounded-xl dashed-border" />
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                <Button variant="danger" onClick={stopCamera} className="px-4 py-2">Cancelar</Button>
                <Button onClick={captureAndTranscribe} isLoading={isLoading} className="flex-1 max-w-xs">Capturar Texto</Button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Cole o conteúdo de um contrato, termo de uso ou artigo técnico aqui..."
              className="w-full h-40 sm:h-56 p-6 text-lg text-slate-700 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all resize-none"
            />
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-400">{inputText.length} caracteres</span>
            <Button 
              onClick={handleExplain} 
              isLoading={isLoading && !isPlaying} 
              disabled={!inputText.trim() || isCameraActive}
              className="w-full sm:w-auto min-w-[200px]"
            >
              Explicar de forma simples
            </Button>
          </div>
        </div>

        {error && <p className="mb-6 text-center text-rose-500 font-medium bg-rose-50 p-4 rounded-xl border border-rose-100">{error}</p>}

        {/* Results */}
        {result && (
          <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
            <div className="bg-indigo-600 rounded-3xl p-8 sm:p-12 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-widest opacity-80">Explicação Acessível</h2>
                </div>
                
                <button 
                  onClick={handleToggleAudio}
                  disabled={isLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isPlaying ? 'bg-white text-indigo-600 scale-105' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                >
                  {isPlaying ? (
                    <div className="flex gap-0.5 items-end h-3">
                      <div className="w-1 bg-indigo-600 animate-[bounce_0.6s_infinite_0s]" style={{height: '100%'}} />
                      <div className="w-1 bg-indigo-600 animate-[bounce_0.6s_infinite_0.1s]" style={{height: '60%'}} />
                      <div className="w-1 bg-indigo-600 animate-[bounce_0.6s_infinite_0.2s]" style={{height: '80%'}} />
                    </div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                  <span className="font-bold text-sm">{isPlaying ? 'Ouvindo...' : 'Ouvir Explicação'}</span>
                </button>
              </div>

              <p className="text-xl sm:text-2xl font-medium leading-relaxed relative z-10">
                {result.explanation}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                  Pontos Essenciais
                </h3>
                <ul className="space-y-4">
                  {result.summary.map((point, i) => (
                    <li key={i} className="flex gap-4 group">
                      <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold mt-1 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        {i + 1}
                      </div>
                      <span className="text-slate-600 leading-snug">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                   <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                  Glossário Simplificado
                </h3>
                <div className="space-y-6">
                  {result.simplifiedTerms.map((term, i) => (
                    <div key={i} className="border-b border-slate-50 pb-4 last:border-0">
                      <span className="block text-sm font-bold text-indigo-600 uppercase tracking-wider mb-1">{term.original}</span>
                      <p className="text-slate-600">{term.simplified}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-8">
              <Button variant="outline" onClick={() => { 
                setResult(null); 
                setInputText(''); 
                if (isPlaying) { audioSourceRef.current?.stop(); setIsPlaying(false); }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}>
                Nova Explicação
              </Button>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-100 bg-white px-6 py-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-slate-400">
          <div className="flex flex-col gap-1 text-center md:text-left">
             <span className="text-sm font-bold text-slate-600">Explique pra mim</span>
             <p className="text-xs">Transformando o complexo em simples e acessível para todos.</p>
          </div>
          <div className="flex items-center gap-6 text-xs font-medium">
            <button onClick={() => { localStorage.removeItem('expliquepramim_user'); window.location.reload(); }} className="hover:text-rose-500 transition-colors">Resetar Dados</button>
            <span>v2.1 - Clareza e Respeito</span>
          </div>
        </div>
      </footer>

      <PremiumModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUpgrade={handleUpgrade} />
      
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
        .dashed-border {
          background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='white' stroke-width='4' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
      `}</style>
    </div>
  );
};

export default App;
