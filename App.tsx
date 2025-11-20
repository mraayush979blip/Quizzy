
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, History as HistoryIcon, LogOut, Sparkles, ArrowLeft, Trash2, Moon, Sun, BrainCircuit, Lock, Mail, AlertCircle, Settings, Copy, UserCircle, Upload, FileText, X, Check } from 'lucide-react';
import { StudyGoal, StudySession, User, ViewState, Theme, Difficulty, FileData } from './types';
import { generateStudyContent } from './services/geminiService';
import { STORAGE_KEY_THEME, STORAGE_KEY_HISTORY } from './constants';
import Button from './components/Button';
import QuizPlayer from './components/QuizPlayer';
import FlashcardPlayer from './components/FlashcardPlayer';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('AUTH');
  const [theme, setTheme] = useState<Theme>('light');
  
  // Auth State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Generator State
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState<StudyGoal>(StudyGoal.QUIZ);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<StudySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Extended Generator Options
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [history, setHistory] = useState<StudySession[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // Feature Flags
  const [isDbAvailable, setIsDbAvailable] = useState(true);

  // Initialize Theme and Auth Listener
  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            isAuthenticated: true
          });
          setView('GENERATOR');
        } else {
          setUser(null);
          setView('AUTH');
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // History Sync (Firestore + Local Storage Fallback)
  useEffect(() => {
    if (!user?.uid) return;

    // 1. Local Storage Mode (Guest or DB Unavailable)
    if (user.uid === 'guest-user' || !isDbAvailable) {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setHistory(parsed);
        } catch (e) {
          console.warn("Failed to parse local history");
        }
      }
      setIsHistoryLoading(false);
      return;
    }

    // 2. Firestore Mode
    setIsHistoryLoading(true);
    
    if (!db) {
        setIsDbAvailable(false); // Fallback immediately if SDK didn't init
        return;
    }

    let unsubscribe: () => void;

    try {
      const q = query(
        collection(db, 'users', user.uid, 'history'),
        orderBy('timestamp', 'desc')
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedHistory: StudySession[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudySession));
        setHistory(fetchedHistory);
        setIsHistoryLoading(false);
        setIsDbAvailable(true);
      }, (error: any) => {
        console.warn("Firestore unavailable (switching to local mode):", error.code);
        // If DB is missing (not-found) or unavailable, switch to local mode
        if (error.code === 'not-found' || error.code === 'permission-denied' || error.code === 'unavailable') {
            setIsDbAvailable(false);
        }
        setIsHistoryLoading(false);
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (err) {
      console.error("Firestore connection failed:", err);
      setIsDbAvailable(false);
      setIsHistoryLoading(false);
    }
  }, [user?.uid, isDbAvailable]);

  // Sync history changes to LocalStorage when in Local Mode
  useEffect(() => {
    if ((!isDbAvailable || user?.uid === 'guest-user') && user) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    }
  }, [history, isDbAvailable, user]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem(STORAGE_KEY_THEME, newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleGuestLogin = () => {
    setAuthLoading(true);
    setTimeout(() => {
        setUser({
            uid: 'guest-user',
            email: 'Guest',
            isAuthenticated: true
        });
        setView('GENERATOR');
        setAuthLoading(false);
    }, 800);
  };

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    if (!auth) {
      handleGuestLogin();
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      // Handle known auth errors gracefully without cluttering console
      const errorCode = err.code;
      let errorMessage = "Authentication failed. Please try again.";
      
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        errorMessage = "Incorrect email or password.";
      } else if (errorCode === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please sign in.";
        setIsSignUp(false);
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = "Password must be at least 6 characters.";
      } else if (errorCode === 'auth/network-request-failed') {
        errorMessage = "Network error. Check your internet connection.";
      } else if (
          errorCode === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || 
          errorCode === 'auth/invalid-api-key' || 
          errorCode === 'auth/configuration-not-found' || 
          errorCode === 'auth/operation-not-allowed'
      ) {
        console.warn("Firebase Config Error:", errorCode); // Keep warn for dev debugging
        errorMessage = "Login unavailable. Enabling Guest Mode...";
        setAuthError(errorMessage);
        setTimeout(() => handleGuestLogin(), 1500);
        return;
      } else {
        console.error("Auth Error:", err); // Log unknown errors
        errorMessage = err.message;
      }
      
      setAuthError(errorMessage);
    } finally {
        if (auth) setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      setUser(null);
      setView('AUTH');
      setTopic('');
      setCurrentResult(null);
      setEmail('');
      setPassword('');
      setDifficulty(Difficulty.MEDIUM);
      setQuestionCount(5);
      setSelectedFile(null);
      // Don't clear history state here; let the useEffect handle it when user changes
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // File Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      
      setSelectedFile({
        mimeType: file.type,
        data: base64Data,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generation Handler
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!topic.trim() && !selectedFile) || !user) return;

    setIsGenerating(true);
    setError(null);
    setCurrentResult(null);

    try {
      // Use a default topic if only a file is provided
      const finalTopic = topic.trim() || (selectedFile ? "the provided document" : "General Knowledge");

      const generatedText = await generateStudyContent({
        topic: finalTopic,
        goal,
        difficulty,
        questionCount,
        file: selectedFile
      });
      
      const newSessionData: Omit<StudySession, 'id'> = {
        topic: finalTopic,
        goal,
        result: generatedText,
        timestamp: Date.now(), 
        config: (goal === StudyGoal.QUIZ || goal === StudyGoal.FLASHCARDS) ? { difficulty, questionCount } : undefined
      };

      let id = 'temp-' + Date.now();
      let savedToDb = false;

      // Attempt to save to Firestore
      if (db && user.uid !== 'guest-user' && isDbAvailable) {
        try {
           const docRef = await addDoc(collection(db, 'users', user.uid, 'history'), newSessionData);
           id = docRef.id;
           savedToDb = true;
        } catch (dbErr: any) {
          console.warn("Failed to save to DB, falling back to local:", dbErr.code);
          if (dbErr.code === 'not-found' || dbErr.code === 'unavailable') {
             setIsDbAvailable(false); // Switch to local mode for future ops
          }
        }
      } 
      
      // Update State (which triggers LocalStorage save via useEffect if !isDbAvailable)
      const newSession: StudySession = { id, ...newSessionData };
      
      if (!savedToDb) {
        setHistory(prev => [newSession, ...prev]);
      }

      setCurrentResult(newSession);
      
    } catch (err: any) {
      setError(err.message || "An error occurred while generating content.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    if (db && user.uid !== 'guest-user' && isDbAvailable) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'history', id));
        } catch (err: any) {
          console.error("Error deleting item:", err);
          if (err.code === 'not-found' || err.code === 'unavailable') {
             setIsDbAvailable(false);
             setHistory(prev => prev.filter(item => item.id !== id));
          }
        }
    } else {
        setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  // Helper to convert markdown images to HTML
  const renderMarkdownWithImages = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
        const imageMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
        if (imageMatch) {
            return (
                <div key={index} className="my-6 rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-700">
                    <img 
                        src={imageMatch[2]} 
                        alt={imageMatch[1]} 
                        className="w-full h-auto object-cover max-h-96 hover:scale-105 transition-transform duration-700" 
                        loading="lazy"
                    />
                    {imageMatch[1] && <div className="bg-slate-50 dark:bg-slate-900 p-2 text-xs text-center text-slate-500 italic">{imageMatch[1]}</div>}
                </div>
            );
        }
        return <span key={index}>{part}</span>;
    });
  };

  const renderContent = (session: StudySession) => {
    switch (session.goal) {
      case StudyGoal.QUIZ:
        return <QuizPlayer data={session.result} onRestart={() => {}} />;
      case StudyGoal.FLASHCARDS:
        return <FlashcardPlayer data={session.result} />;
      default:
        return (
          <div className="prose prose-indigo dark:prose-invert max-w-none font-sans">
            <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed text-lg">
               {renderMarkdownWithImages(session.result)}
            </div>
          </div>
        );
    }
  };

  // View Components
  const renderAuth = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 transition-colors duration-300 font-sans">
      <div className="absolute top-4 right-4">
        <button onClick={toggleTheme} className="p-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl shadow-indigo-500/10 border border-slate-100 dark:border-slate-700 p-8 sm:p-10 animate-slide-up">
        <div className="text-center mb-8">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30 transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <BrainCircuit className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-slate-900 dark:text-white tracking-tight mb-2">Quizzy</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-light">
            Master any topic instantly.
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                Email
                </label>
                <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        setAuthError(null); // Clear error on type
                    }}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium"
                    placeholder="hello@example.com"
                />
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">
                Password
                </label>
                <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError(null); // Clear error on type
                    }}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white font-medium"
                    placeholder="••••••••"
                    minLength={6}
                />
                </div>
            </div>
          </div>

          {authError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-start animate-fade-in">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{authError}</span>
            </div>
          )}

          <Button type="submit" isLoading={authLoading} className="w-full h-14 text-lg font-bold rounded-xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5">
            {isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 text-center space-y-4">
           <button 
            type="button"
            onClick={handleGuestLogin}
            className="w-full py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center"
           >
              <UserCircle className="w-5 h-5 mr-2" />
              Continue as Guest
           </button>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSignUp ? "Already have an account? " : "Don't have an account? " }
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }} 
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors underline decoration-2 underline-offset-2 decoration-indigo-200 dark:decoration-indigo-900 hover:decoration-indigo-500"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setView('GENERATOR')}>
          <div className="bg-indigo-600 dark:bg-indigo-500 p-1.5 rounded-lg group-hover:scale-105 transition-transform">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <span className="font-serif font-bold text-2xl text-slate-900 dark:text-white tracking-tight">Quizzy</span>
        </div>
        
        <div className="flex items-center space-x-3 sm:space-x-4">
           <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {view === 'GENERATOR' && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setView('HISTORY')}
              className="hidden sm:inline-flex font-semibold"
            >
              <HistoryIcon className="w-4 h-4 mr-2" />
              Library
            </Button>
          )}
          {view === 'HISTORY' && (
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setView('GENERATOR')}
              className="font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm text-slate-600 dark:text-slate-400 hidden md:inline font-bold truncate max-w-[150px]">
                {user?.uid === 'guest-user' ? 'Guest Mode' : user?.email}
            </span>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );

  const renderGenerator = () => (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 font-sans">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-10 transition-colors duration-300">
        <div className="mb-8">
          <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-white flex items-center">
            <Sparkles className="w-6 h-6 mr-3 text-amber-500 fill-amber-500" />
            What do you want to learn?
          </h2>
        </div>

        <form onSubmit={handleGenerate} className="space-y-8">
          <div>
            <label htmlFor="topic" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
              Topic or Concept
            </label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The Solar System, React Hooks, Spanish Verbs"
              className="w-full px-5 py-4 text-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:text-white shadow-inner"
              required={!selectedFile}
            />
          </div>

           {/* File Upload Section */}
           <div>
             <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide flex items-center">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document (Optional)
             </label>
             
             {!selectedFile ? (
                 <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                 >
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">Click to upload PDF or Image</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">We'll use this as source material</p>
                 </div>
             ) : (
                 <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                    <div className="flex items-center overflow-hidden">
                        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 mr-3">
                            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{selectedFile.name}</span>
                    </div>
                    <button 
                        type="button"
                        onClick={clearFile}
                        className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-red-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                 </div>
             )}
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="application/pdf,image/*"
             />
           </div>

          <div>
            <label htmlFor="goal" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
              Learning Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(StudyGoal).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`px-4 py-4 text-sm font-bold rounded-xl border transition-all duration-200 flex items-center justify-center text-center
                    ${goal === g 
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 transform scale-[1.02]' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Quiz/Flashcard Options */}
          {(goal === StudyGoal.QUIZ || goal === StudyGoal.FLASHCARDS) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
                        Difficulty
                    </label>
                    <div className="relative">
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                            className="w-full appearance-none px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-white font-medium"
                        >
                            {Object.values(Difficulty).map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                            <Settings className="w-4 h-4" />
                        </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wide">
                        {goal === StudyGoal.QUIZ ? 'Number of Questions' : 'Number of Cards'}
                    </label>
                    <div className="flex space-x-2">
                        {[5, 10, 15, 20].map(num => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => setQuestionCount(num)}
                                className={`flex-1 py-3 rounded-xl font-bold border transition-colors ${
                                    questionCount === num
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>
          )}

          <div className="pt-2">
            <Button type="submit" isLoading={isGenerating} className="w-full h-14 text-lg font-bold shadow-xl shadow-indigo-500/20 rounded-2xl hover:shadow-indigo-500/40 transition-all">
              {isGenerating ? 'Creating your content...' : 'Generate Study Material'}
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Result Display */}
      {currentResult && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-up transition-colors duration-300">
          <div className="bg-indigo-50/50 dark:bg-slate-900/50 px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center backdrop-blur-sm">
            <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">Result</h3>
            <div className="flex items-center space-x-2">
                {currentResult.config && (
                    <span className="hidden sm:inline-flex text-xs text-slate-500 dark:text-slate-400 font-medium px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                        {currentResult.config.difficulty} • {currentResult.config.questionCount} {currentResult.goal === StudyGoal.QUIZ ? 'Qs' : 'Cards'}
                    </span>
                )}
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm border border-indigo-100 dark:border-slate-700">
                    {currentResult.goal}
                </span>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            {renderContent(currentResult)}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold text-slate-900 dark:text-white">Library</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Your past learning sessions</p>
          {(!isDbAvailable || user?.uid === 'guest-user') && (
             <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-2 flex items-center font-semibold">
                <HistoryIcon className="w-3 h-3 mr-1" /> Saved locally (Offline Mode)
             </p>
          )}
        </div>
      </div>

      {isHistoryLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="bg-slate-100 dark:bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <HistoryIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-xl font-serif font-bold text-slate-900 dark:text-white mb-2">No history yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">Generated quizzes and study materials will appear here automatically.</p>
          <Button onClick={() => setView('GENERATOR')} variant="primary" size="lg" className="rounded-xl font-bold">
            Create New Material
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((session) => (
            <div key={session.id} 
              onClick={() => {
                setTopic(session.topic);
                setGoal(session.goal);
                setCurrentResult(session);
                setView('GENERATOR');
              }}
              className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all hover:shadow-lg p-6 flex items-start justify-between"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 rounded-md">
                    {session.goal}
                  </span>
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-slate-900 dark:text-white text-xl truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-2">{session.topic}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed line-clamp-2">
                  {(session.goal === StudyGoal.QUIZ || session.goal === StudyGoal.FLASHCARDS) 
                    ? `${session.goal === StudyGoal.QUIZ ? 'Interactive Quiz' : 'Flashcard Set'} - Click to view content` 
                    : session.result.replace(/[#*`]/g, '').substring(0, 160)}
                </p>
              </div>
              <button 
                onClick={(e) => handleDeleteHistory(session.id, e)}
                className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (view === 'AUTH' && !user) {
    return renderAuth();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12 transition-colors duration-300 font-sans">
      {renderHeader()}
      {view === 'GENERATOR' ? renderGenerator() : renderHistory()}
    </div>
  );
};

export default App;
