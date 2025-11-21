
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, History as HistoryIcon, LogOut, Sparkles, Trash2, Moon, Sun, BrainCircuit, Lock, Mail, AlertCircle, Settings, UserCircle, Upload, FileText, X, Zap, BarChart3, TrendingUp, Award, Target } from 'lucide-react';
import { StudyGoal, StudySession, User, ViewState, Theme, Difficulty, FileData, QuizAttempt } from './types';
import { generateStudyContent } from './services/geminiService';
import { STORAGE_KEY_THEME, STORAGE_KEY_HISTORY } from './constants';
import Button from './components/Button';
import QuizPlayer from './components/QuizPlayer';
import FlashcardPlayer from './components/FlashcardPlayer';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';

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

  const handleGuestLogin = (delay = 800) => {
    setAuthLoading(true);
    setTimeout(() => {
        setUser({
            uid: 'guest-user',
            email: 'Guest',
            isAuthenticated: true
        });
        setView('GENERATOR');
        setAuthLoading(false);
    }, delay);
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
      const errorMsg = err.message || '';
      
      // CRITICAL: Handle Configuration Errors by Silently Falling Back to Guest
      if (
          errorCode === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || 
          errorCode === 'auth/invalid-api-key' || 
          errorCode === 'auth/configuration-not-found' || 
          errorCode === 'auth/operation-not-allowed' ||
          errorCode === 'auth/requests-from-referer-blocked' ||
          errorMsg.includes('identity-toolkit')
      ) {
        console.warn("Firebase Config Issue (Falling back to Guest):", errorCode || errorMsg); 
        handleGuestLogin(100); // Immediate fallback
        return;
      }

      // Handle standard user errors
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
      } else {
        console.error("Auth Error:", err);
        errorMessage = err.message;
      }
      
      setAuthError(errorMessage);
    } finally {
        // Only clear loading if we didn't trigger guest fallback
        if (auth) {
           setTimeout(() => {
                if (!user) setAuthLoading(false);
           }, 50);
        }
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
        config: (goal === StudyGoal.QUIZ || goal === StudyGoal.FLASHCARDS) ? { difficulty, questionCount } : undefined,
        attempts: []
      };

      let id = 'temp-' + Date.now();
      let savedToDb = false;

      if (db && user.uid !== 'guest-user' && isDbAvailable) {
        try {
           const docRef = await addDoc(collection(db, 'users', user.uid, 'history'), newSessionData);
           id = docRef.id;
           savedToDb = true;
        } catch (dbErr: any) {
          console.warn("Failed to save to DB, falling back to local:", dbErr.code);
          if (dbErr.code === 'not-found' || dbErr.code === 'unavailable') {
             setIsDbAvailable(false);
          }
        }
      } 
      
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

  // Handle Quiz Completion
  const handleQuizComplete = async (score: number, total: number) => {
    if (!currentResult || !user) return;

    const newAttempt: QuizAttempt = {
      timestamp: Date.now(),
      score,
      totalQuestions: total
    };

    // Create updated session object
    const updatedSession: StudySession = {
      ...currentResult,
      attempts: [...(currentResult.attempts || []), newAttempt]
    };

    // Update Local State
    setCurrentResult(updatedSession);
    setHistory(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));

    // Update DB (if available)
    if (user.uid !== 'guest-user' && isDbAvailable && db) {
        try {
            const sessionRef = doc(db, 'users', user.uid, 'history', updatedSession.id);
            await updateDoc(sessionRef, { attempts: updatedSession.attempts });
        } catch (err) {
            console.error("Failed to update quiz score in DB", err);
        }
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
                <div key={index} className="my-8 rounded-2xl overflow-hidden shadow-xl border border-zinc-200 dark:border-white/10 relative group">
                    <img 
                        src={imageMatch[2]} 
                        alt={imageMatch[1]} 
                        className="w-full h-auto object-cover max-h-96 transition-transform duration-700 group-hover:scale-105" 
                        loading="lazy"
                    />
                    {imageMatch[1] && <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-3 text-xs text-center text-zinc-200 italic">{imageMatch[1]}</div>}
                </div>
            );
        }
        return <span key={index}>{part}</span>;
    });
  };

  const renderContent = (session: StudySession) => {
    switch (session.goal) {
      case StudyGoal.QUIZ:
        return <QuizPlayer data={session.result} onRestart={() => {}} onComplete={handleQuizComplete} />;
      case StudyGoal.FLASHCARDS:
        return <FlashcardPlayer data={session.result} />;
      default:
        return (
          <div className="prose prose-lg prose-zinc dark:prose-invert max-w-none font-sans leading-loose">
            <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
               {renderMarkdownWithImages(session.result)}
            </div>
          </div>
        );
    }
  };

  // --- BACKGROUND ANIMATION COMPONENT ---
  const BackgroundAnimation = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Light Mode - Subtle Flowing Gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 bg-[length:400%_400%] animate-subtle-flow dark:hidden"></div>
      
      {/* Floating Blobs for depth */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden dark:hidden opacity-70">
         <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-200/20 rounded-full mix-blend-multiply filter blur-[90px] animate-blob"></div>
         <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-purple-200/20 rounded-full mix-blend-multiply filter blur-[90px] animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] bg-pink-200/20 rounded-full mix-blend-multiply filter blur-[90px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Dark Mode - Deep Nebula */}
       <div className="hidden dark:block absolute inset-0 bg-zinc-950">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-900/20 via-zinc-950 to-zinc-950"></div>
           <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary-900/10 rounded-full blur-[120px] animate-pulse"></div>
           <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] bg-fuchsia-900/10 rounded-full blur-[120px] animate-pulse animation-delay-2000"></div>
      </div>
    </div>
  );

  // View Components
  const renderAuth = () => (
    <div className="min-h-screen flex items-center justify-center px-4 font-sans relative">
      <BackgroundAnimation />
      
      <div className="absolute top-6 right-6 z-20">
        <button onClick={toggleTheme} className="p-3 rounded-full bg-white/40 dark:bg-white/10 backdrop-blur-md border border-white/50 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-white/60 transition-all shadow-sm">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
      
      <div className="max-w-md w-full glass-panel rounded-[2.5rem] shadow-2xl p-8 sm:p-12 animate-slide-up relative z-10">
        <div className="text-center mb-10">
          <div className="bg-gradient-to-tr from-primary-600 to-fuchsia-500 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-500/30 transform rotate-6 hover:rotate-0 transition-transform duration-500">
            <BrainCircuit className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-display font-bold text-zinc-900 dark:text-white tracking-tighter mb-3">Quizzy</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg font-medium">
            Your AI Learning Companion
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-5">
            <div>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setAuthError(null);
                        }}
                        className="w-full pl-11 pr-4 py-4 bg-white/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all dark:text-white font-medium placeholder:text-zinc-400/70 backdrop-blur-sm text-lg"
                        placeholder="Email Address"
                    />
                </div>
            </div>

            <div>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setAuthError(null);
                        }}
                        className="w-full pl-11 pr-4 py-4 bg-white/50 dark:bg-black/20 border border-zinc-200/80 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all dark:text-white font-medium placeholder:text-zinc-400/70 backdrop-blur-sm text-lg"
                        placeholder="Password"
                        minLength={6}
                    />
                </div>
            </div>
          </div>

          {authError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-300 text-sm flex items-start animate-fade-in">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{authError}</span>
            </div>
          )}

          <Button type="submit" isLoading={authLoading} className="w-full h-16 text-lg rounded-2xl shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-1">
            {isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-zinc-200/60 dark:border-white/10 text-center space-y-4">
           <button 
            type="button"
            onClick={() => handleGuestLogin()}
            className="w-full py-4 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white/30 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-white/60 dark:hover:bg-white/10 transition-all flex items-center justify-center backdrop-blur-sm"
           >
              <UserCircle className="w-5 h-5 mr-2" />
              Continue as Guest
           </button>

          <p className="text-sm text-zinc-500 dark:text-zinc-500 font-medium">
            {isSignUp ? "Already have an account? " : "Don't have an account? " }
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }} 
              className="font-bold text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-colors"
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="glass-panel border-b border-white/20 dark:border-white/5 sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setView('GENERATOR')}>
          <div className="bg-gradient-to-tr from-primary-600 to-fuchsia-500 p-2.5 rounded-xl shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform duration-300">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-zinc-900 dark:text-white tracking-tight">Quizzy</span>
        </div>
        
        <div className="flex items-center space-x-3 sm:space-x-4">
           <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-full text-zinc-600 hover:bg-zinc-100/50 dark:text-zinc-400 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-white/5"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div className="hidden sm:flex space-x-2">
            <Button 
              variant={view === 'HISTORY' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('HISTORY')}
              className="font-semibold"
            >
              <HistoryIcon className="w-4 h-4 mr-2" />
              Library
            </Button>
            <Button 
              variant={view === 'PROGRESS' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('PROGRESS')}
              className="font-semibold"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Progress
            </Button>
          </div>
          
          <div className="h-8 w-px bg-zinc-200 dark:bg-white/10 mx-2"></div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm text-zinc-600 dark:text-zinc-400 hidden md:inline font-semibold truncate max-w-[150px]">
                {user?.uid === 'guest-user' ? 'Guest Mode' : user?.email}
            </span>
            <button 
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
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
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 font-sans relative z-10">
      <div className="glass-panel rounded-[2rem] shadow-xl p-8 sm:p-12 transition-all duration-300 border-t border-white/60">
        <div className="mb-10">
          <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white flex items-center">
            <span className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl mr-4">
                <Sparkles className="w-6 h-6 text-amber-500 fill-amber-500/20" />
            </span>
            What do you want to learn?
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-3 ml-[4.5rem] text-lg">Enter a topic or upload a document to get started.</p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-8">
          <div>
            <label htmlFor="topic" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-widest">
              Topic or Concept
            </label>
            <div className="relative group">
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Quantum Physics, The French Revolution"
                className="w-full px-6 py-5 text-lg bg-white/60 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all dark:text-white shadow-sm placeholder:text-zinc-400 backdrop-blur-sm"
                required={!selectedFile}
              />
            </div>
          </div>

           {/* File Upload Section */}
           <div>
             <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-widest flex items-center">
                <Upload className="w-4 h-4 mr-2" />
                Source Material (Optional)
             </label>
             
             {!selectedFile ? (
                 <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-300/70 dark:border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:bg-white/40 dark:hover:bg-white/5 transition-colors group"
                 >
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <FileText className="w-8 h-8 text-zinc-400 group-hover:text-primary-500 transition-colors" />
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-200 font-bold text-lg">Click to upload PDF or Image</p>
                    <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">AI will analyze this content to generate questions</p>
                 </div>
             ) : (
                 <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-700/50 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center overflow-hidden">
                        <div className="w-12 h-12 bg-white dark:bg-primary-600/20 rounded-xl flex items-center justify-center flex-shrink-0 mr-4 shadow-sm">
                            <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <span className="font-medium text-zinc-800 dark:text-zinc-100 truncate text-lg">{selectedFile.name}</span>
                    </div>
                    <button 
                        type="button"
                        onClick={clearFile}
                        className="p-2.5 hover:bg-white dark:hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-red-500"
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
            <label htmlFor="goal" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-widest">
              Learning Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.values(StudyGoal).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  className={`px-4 py-4 text-sm font-bold rounded-2xl border transition-all duration-300 flex items-center justify-center text-center relative overflow-hidden shadow-sm
                    ${goal === g 
                      ? 'border-transparent text-white shadow-lg shadow-primary-500/30 transform scale-[1.02]' 
                      : 'border-zinc-200/60 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/5 bg-white/40 dark:bg-black/20'
                    }`}
                >
                  {goal === g && (
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-fuchsia-500 -z-10"></div>
                  )}
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Quiz/Flashcard Options */}
          {(goal === StudyGoal.QUIZ || goal === StudyGoal.FLASHCARDS) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in p-6 bg-zinc-50/60 dark:bg-black/20 rounded-2xl border border-zinc-200/50 dark:border-white/5">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-widest">
                        Difficulty
                    </label>
                    <div className="relative">
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                            className="w-full appearance-none px-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-zinc-700 dark:text-white font-medium shadow-sm"
                        >
                            {Object.values(Difficulty).map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-zinc-500">
                            <Settings className="w-4 h-4" />
                        </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-3 uppercase tracking-widest">
                        {goal === StudyGoal.QUIZ ? 'Number of Questions' : 'Number of Cards'}
                    </label>
                    <div className="flex space-x-2">
                        {[5, 10, 15, 20].map(num => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => setQuestionCount(num)}
                                className={`flex-1 py-3.5 rounded-xl font-bold border transition-colors shadow-sm ${
                                    questionCount === num
                                    ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-500 text-primary-700 dark:text-primary-300'
                                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                  </div>
              </div>
          )}

          <div className="pt-6">
            <Button type="submit" isLoading={isGenerating} className="w-full h-16 text-xl font-bold shadow-2xl shadow-primary-500/25 rounded-2xl hover:shadow-primary-500/40 transition-all hover:-translate-y-1">
              {isGenerating ? (
                  <span className="flex items-center"><Sparkles className="w-6 h-6 mr-3 animate-pulse" /> Generating...</span>
              ) : (
                  <span className="flex items-center"><Zap className="w-6 h-6 mr-3 fill-current" /> Generate Material</span>
              )}
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-8 p-5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-300 text-sm font-medium flex items-center">
             <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
             {error}
          </div>
        )}
      </div>

      {/* Result Display */}
      {currentResult && (
        <div className="glass-panel rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up transition-colors duration-300">
          <div className="bg-gradient-to-r from-zinc-50/50 to-zinc-100/50 dark:from-zinc-900 dark:to-zinc-900/50 px-10 py-8 border-b border-zinc-200/60 dark:border-white/5 flex justify-between items-center">
            <h3 className="font-display font-bold text-2xl text-zinc-900 dark:text-white flex items-center">
                <Sparkles className="w-6 h-6 mr-3 text-fuchsia-500" /> Result
            </h3>
            <div className="flex items-center space-x-2">
                {currentResult.config && (
                    <span className="hidden sm:inline-flex text-xs text-zinc-600 dark:text-zinc-400 font-bold px-3 py-1.5 bg-white dark:bg-white/5 rounded-lg border border-zinc-200 dark:border-white/5 shadow-sm">
                        {currentResult.config.difficulty} • {currentResult.config.questionCount} {currentResult.goal === StudyGoal.QUIZ ? 'Qs' : 'Cards'}
                    </span>
                )}
                <span className="text-xs text-primary-700 dark:text-primary-300 font-bold uppercase tracking-wider bg-primary-100/80 dark:bg-primary-900/30 px-3 py-1.5 rounded-lg shadow-sm border border-primary-200 dark:border-primary-500/30">
                    {currentResult.goal}
                </span>
            </div>
          </div>
          <div className="p-10 sm:p-14 bg-white/40 dark:bg-transparent">
            {renderContent(currentResult)}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => (
    <div className="max-w-5xl mx-auto px-4 py-12 font-sans relative z-10">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">Library</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium text-lg">Your knowledge collection</p>
          {(!isDbAvailable || user?.uid === 'guest-user') && (
             <p className="text-primary-700 dark:text-primary-400 text-xs mt-3 flex items-center font-bold bg-primary-100/80 dark:bg-primary-900/30 self-start inline-flex px-3 py-1.5 rounded-lg">
                <HistoryIcon className="w-3.5 h-3.5 mr-1.5" /> Offline Mode
             </p>
          )}
        </div>
      </div>

      {isHistoryLoading ? (
        <div className="flex justify-center py-32">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary-500"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-32 glass-panel rounded-[2rem] border-dashed border-2 border-zinc-300/60 dark:border-white/10">
          <div className="bg-white dark:bg-white/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <HistoryIcon className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white mb-2">No history yet</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-10 max-w-md mx-auto text-lg">Generated study materials will appear here automatically.</p>
          <Button onClick={() => setView('GENERATOR')} variant="primary" size="lg" className="rounded-2xl font-bold px-8">
            Create New Material
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {history.map((session) => (
            <div key={session.id} 
              onClick={() => {
                setTopic(session.topic);
                setGoal(session.goal);
                setCurrentResult(session);
                setView('GENERATOR');
              }}
              className="group glass-panel rounded-2xl hover:border-primary-300 dark:hover:border-primary-500 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/5 p-6 flex flex-col justify-between hover:-translate-y-1 h-full bg-white/60 dark:bg-zinc-900/40"
            >
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/40 px-2.5 py-1 rounded-md border border-primary-100 dark:border-primary-800">
                    {session.goal}
                  </span>
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-display font-bold text-zinc-900 dark:text-white text-xl leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-3 line-clamp-2">{session.topic}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed line-clamp-3 font-medium">
                  {(session.goal === StudyGoal.QUIZ || session.goal === StudyGoal.FLASHCARDS) 
                    ? `${session.goal === StudyGoal.QUIZ ? 'Interactive Quiz' : 'Flashcard Set'} - Click to view content` 
                    : session.result.replace(/[#*`]/g, '').substring(0, 160)}
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-white/5 flex justify-end">
                  <button 
                    onClick={(e) => handleDeleteHistory(session.id, e)}
                    className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // PROGRESS DASHBOARD
  const renderProgress = () => {
    // Filter only quiz sessions
    const quizSessions = history.filter(s => s.goal === StudyGoal.QUIZ && s.attempts && s.attempts.length > 0);
    
    // Calculate Stats
    const totalAttempts = quizSessions.reduce((acc, s) => acc + (s.attempts?.length || 0), 0);
    const avgScore = totalAttempts > 0 
        ? Math.round(quizSessions.reduce((acc, s) => acc + (s.attempts?.reduce((sum, a) => sum + (a.score/a.totalQuestions), 0) || 0), 0) / totalAttempts * 100) 
        : 0;

    return (
      <div className="max-w-5xl mx-auto px-4 py-12 font-sans relative z-10 animate-fade-in">
        <div className="mb-10">
            <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">Your Progress</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium text-lg">Track your quiz performance over time</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-primary-500">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Total Quizzes</h4>
                    <BookOpen className="w-5 h-5 text-primary-500" />
                </div>
                <p className="text-4xl font-display font-bold text-zinc-900 dark:text-white">{totalAttempts}</p>
            </div>
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-fuchsia-500">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Avg. Accuracy</h4>
                    <Target className="w-5 h-5 text-fuchsia-500" />
                </div>
                <p className="text-4xl font-display font-bold text-zinc-900 dark:text-white">{avgScore}%</p>
            </div>
             <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-amber-500">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider">Topics Studied</h4>
                    <Award className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-4xl font-display font-bold text-zinc-900 dark:text-white">{quizSessions.length}</p>
            </div>
        </div>

        {/* Quiz List */}
        <div className="space-y-6">
             {quizSessions.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50/50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-zinc-200 dark:border-white/10">
                    <BarChart3 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500 font-medium">Take some quizzes to see your progress here!</p>
                </div>
             ) : (
                 quizSessions.map(session => {
                     // Get latest attempt
                     const latest = session.attempts![session.attempts!.length - 1];
                     const latestPct = Math.round((latest.score / latest.totalQuestions) * 100);
                     const bestAttempt = session.attempts!.reduce((max, curr) => (curr.score/curr.totalQuestions) > (max.score/max.totalQuestions) ? curr : max, session.attempts![0]);
                     const bestPct = Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100);

                     return (
                        <div key={session.id} className="glass-panel rounded-2xl p-6 hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <span className="px-2 py-1 rounded bg-zinc-100 dark:bg-white/10 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                            {session.config?.difficulty || 'Medium'}
                                        </span>
                                        <span className="text-xs text-zinc-400 font-medium">Last taken: {new Date(latest.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{session.topic}</h3>
                                    
                                    {/* Attempts Mini-Graph */}
                                    <div className="flex items-end space-x-1 h-12 mt-4">
                                        {session.attempts!.slice(-10).map((attempt, i) => {
                                            const pct = (attempt.score / attempt.totalQuestions) * 100;
                                            return (
                                                <div key={i} className="w-2 bg-zinc-200 dark:bg-white/10 rounded-t-sm relative group">
                                                    <div 
                                                        className={`absolute bottom-0 w-full rounded-t-sm transition-all ${pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                        style={{ height: `${pct}%` }}
                                                    ></div>
                                                    {/* Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                                                        {Math.round(pct)}%
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                
                                <div className="flex items-center space-x-8 border-t md:border-t-0 md:border-l border-zinc-100 dark:border-white/5 pt-4 md:pt-0 md:pl-8">
                                    <div className="text-center">
                                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Latest</p>
                                        <p className={`text-2xl font-display font-bold ${latestPct >= 80 ? 'text-green-500' : latestPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                            {latestPct}%
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Best</p>
                                        <p className="text-2xl font-display font-bold text-zinc-700 dark:text-white">
                                            {bestPct}%
                                        </p>
                                    </div>
                                    <Button 
                                        size="sm"
                                        onClick={() => {
                                            setTopic(session.topic);
                                            setGoal(session.goal);
                                            setCurrentResult(session);
                                            setView('GENERATOR');
                                        }}
                                    >
                                        Retake
                                    </Button>
                                </div>
                            </div>
                        </div>
                     )
                 })
             )}
        </div>
      </div>
    );
  };

  if (view === 'AUTH' && !user) {
    return renderAuth();
  }

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 font-sans relative overflow-x-hidden">
      <BackgroundAnimation />
      {renderHeader()}
      {view === 'GENERATOR' ? renderGenerator() : view === 'PROGRESS' ? renderProgress() : renderHistory()}
    </div>
  );
};

export default App;
