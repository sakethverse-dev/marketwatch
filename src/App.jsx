import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, Mail, Bell, Home, BarChart2, List, TrendingUp, RefreshCw, CreditCard, Gift, Shield, Settings, HelpCircle, ArrowUpRight, ArrowDownRight, Download, Eye, EyeOff, ChevronDown, Lock, ChevronRight, CheckCircle2, XCircle, Sun, Moon, Activity, Database, Target, BrainCircuit, UploadCloud, FileText, LogOut, History, MessageCircle, Send, X } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import html2pdf from 'html2pdf.js';
import './index.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CompanyLogo = ({ name, size = 32 }) => {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!name) return;
    let isMounted = true;
    
    fetch(`${API_BASE_URL}/logo?name=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.url) setSrc(data.url);
      })
      .catch(() => {
        if (isMounted) {
          const normalized = name.toLowerCase().replace(/\s+/g, '') + '.com';
          setSrc(`https://logo.clearbit.com/${normalized}`);
        }
      });

    return () => { isMounted = false; };
  }, [name]);

  if (!src) return <div style={{width: size, height: size, borderRadius: '50%', backgroundColor: 'var(--panel-border)'}} />;

  return (
    <img 
      src={src} 
      alt={name} 
      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`}}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'contain', backgroundColor: '#fff', border: '1px solid var(--panel-border)' }}
    />
  );
};

function App() {
  const [theme, setTheme] = useState('light');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userCompany, setUserCompany] = useState('');
  const [competitors, setCompetitors] = useState(() => {
    const saved = localStorage.getItem('marketwatch_competitors');
    return saved ? JSON.parse(saved) : [];
  });
  const [compInput, setCompInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [localData, setLocalData] = useState('');
  const [localFileName, setLocalFileName] = useState('');
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLocalFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setLocalData(evt.target.result);
    };
    reader.readAsText(file);
  };
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('marketwatch_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [lastScanned, setLastScanned] = useState(() => {
    return localStorage.getItem('marketwatch_last_scanned') || null;
  });
  
  useEffect(() => {
    localStorage.setItem('marketwatch_competitors', JSON.stringify(competitors));
  }, [competitors]);

  useEffect(() => {
    if (data) localStorage.setItem('marketwatch_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (lastScanned) localStorage.setItem('marketwatch_last_scanned', lastScanned);
  }, [lastScanned]);

  const [loadingStep, setLoadingStep] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [showAllSources, setShowAllSources] = useState(false);

  const [activeView, setActiveView] = useState('dashboard');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', content: 'Hi! I am your MarketWatch Copilot. Ask me anything about your competitors or the latest generated strategy.' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    
    const newMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           messages: [...chatMessages, newMsg].slice(1), 
           context_data: data || { note: "No intelligence data generated yet. Tell the user to run an analysis." }
        })
      });
      const resData = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: resData.response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Error communicating with the backend API." }]);
    } finally {
      setIsChatLoading(false);
    }
  };
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [historyData, setHistoryData] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveThreats, setLiveThreats] = useState([]);
  const monitorIntervalRef = useRef(null);

  useEffect(() => {
    if (activeView === 'history' && currentUser) {
      const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
          const q = query(collection(db, "users", currentUser.uid, "history"), orderBy("timestamp", "desc"));
          const querySnapshot = await getDocs(q);
          const hist = [];
          querySnapshot.forEach((doc) => {
            hist.push({ id: doc.id, ...doc.data() });
          });
          setHistoryData(hist);
        } catch (err) {
          console.error("Error fetching history:", err);
        }
        setIsHistoryLoading(false);
      };
      fetchHistory();
    }
  }, [activeView, currentUser]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('marketwatch_theme');
    if (savedTheme) setTheme(savedTheme);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        // Fetch user company from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().company) {
          setUserCompany(userDoc.data().company);
          setIsOnboarded(true);
        } else {
          setIsOnboarded(false);
        }
      } else {
        setCurrentUser(null);
        setIsLoggedIn(false);
        setIsOnboarded(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isMonitoring && userCompany && competitors.length > 0) {
      checkLiveThreats(); // Initial check
      monitorIntervalRef.current = setInterval(checkLiveThreats, 30000); // Poll every 30s
    } else {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    }
    return () => {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    };
  }, [isMonitoring, userCompany, competitors]);

  const checkLiveThreats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/live_monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_company: userCompany, competitors: competitors })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.threat_detected) {
          setLiveThreats(prev => [{ id: Date.now(), ...data }, ...prev].slice(0, 3));
          if (data.threat_level === 'High' && "Notification" in window && Notification.permission === "granted") {
            new Notification("🚨 High Threat Detected", { body: data.message });
          }
        }
      }
    } catch (err) {
      console.error("Monitor error:", err);
    }
  };

  const toggleLiveRadar = () => {
    if (!isMonitoring) {
      if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
    setIsMonitoring(!isMonitoring);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('marketwatch_theme', newTheme);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayNameInput) {
          await updateProfile(userCredential.user, { displayName: displayNameInput });
          setCurrentUser({ ...userCredential.user, displayName: displayNameInput });
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    if (!userCompany.trim() || !currentUser) return;
    
    setErrorMsg('Validating company...');
    try {
        const res = await fetch(`${API_BASE_URL}/validate?name=${encodeURIComponent(userCompany)}`);
        const data = await res.json();
        if (!data.valid) {
            setErrorMsg('Fake or Unrecognized Company. Please enter a real company.');
            return;
        }
        
        // Save to Firestore
        await setDoc(doc(db, "users", currentUser.uid), {
          company: userCompany.trim()
        }, { merge: true });
        
    } catch (err) {
        // Fall open if backend is unreachable
    }
    
    setErrorMsg('');
    setIsOnboarded(true);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      signOut(auth);
      setShowProfileMenu(false);
    }
  };

  const handleChangePassword = async () => {
    if (currentUser && currentUser.email) {
      if (window.confirm(`Send a password reset email to ${currentUser.email}?`)) {
        try {
          await sendPasswordResetEmail(auth, currentUser.email);
          alert('Password reset email sent! Please check your inbox.');
          setShowProfileMenu(false);
        } catch (error) {
          alert(`Error sending reset email: ${error.message}`);
        }
      }
    }
  };

  const handleDispatch = async () => {
    if (!userCompany) return;
    setLoading(true);
    setData(null);
    setShowAllSources(false);
    
    let eventSource;
    try {
      setTerminalLogs([`[${new Date().toLocaleTimeString()}] Establishing uplink...`]);
      eventSource = new EventSource(`${API_BASE_URL}/stream_logs`);
      eventSource.onmessage = (event) => {
          const timeStr = new Date().toLocaleTimeString();
          // Overwrite the array to only keep the latest line, satisfying the "disappear" requirement
          setTerminalLogs([`[${timeStr}] ${event.data}`]);
      };

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_company: userCompany, competitors: competitors, local_data: localData || null })
      });
      if (res.ok) {
         const responseData = await res.json();
         setData(responseData);
         setLastScanned(new Date().toLocaleString());
         
         if (currentUser) {
            try {
              await addDoc(collection(db, "users", currentUser.uid, "history"), {
                 timestamp: new Date().toISOString(),
                 user_company: userCompany,
                 competitors: competitors,
                 report: responseData
              });
            } catch (err) {
              console.error("Failed to save history", err);
            }
         }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to the MarketWatch AI Backend. Please ensure the Python server is running.');
    } finally {
      if (eventSource) eventSource.close();
      setLoading(false);
      setTerminalLogs([]);
    }
  };

  const downloadPDF = (elementId, reportPrefix) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const opt = {
      margin:       0.5,
      filename:     `${userCompany}_${reportPrefix}_Report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const getDataPoints = () => {
    if (!data) return "0";
    return data.data_points ? data.data_points.toLocaleString() : "0";
  };

  if (!isLoggedIn || !isOnboarded) {
    return (
      <div className={`theme-${theme}`} style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="bankio-panel animate-slide-up" style={{ width: '400px', textAlign: 'center' }}>
           <div style={{ background: 'var(--accent-green)', width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff' }}>
             {isLoggedIn ? <Target size={28} /> : <Lock size={28} />}
           </div>
           <h2 style={{ margin: '0 0 10px 0' }}>{isLoggedIn ? 'Target Setup' : 'MarketWatch Intelligence'}</h2>
           <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '25px' }}>
             {isLoggedIn ? 'Enter your primary company to begin.' : 'Authenticate to access the dashboard.'}
           </p>
           
           <form onSubmit={isLoggedIn ? handleOnboard : handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
             {!isLoggedIn ? (
               <>
                 {!isLoginMode && (
                   <input type="text" autoFocus value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} placeholder="Username" className="finance-input" required />
                 )}
                 <input type="email" autoFocus={isLoginMode} value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" className="finance-input" required />
                 <div style={{ position: 'relative', width: '100%' }}>
                   <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="finance-input" style={{ width: '100%', paddingRight: '40px', boxSizing: 'border-box' }} required />
                   <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }} onClick={() => setShowPassword(!showPassword)}>
                     {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                   </div>
                 </div>
                 {errorMsg && <div style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '-10px', paddingLeft: '5px' }}>{errorMsg}</div>}
                 <button type="submit" className="finance-btn">{isLoginMode ? 'Sign In' : 'Sign Up'} <ChevronRight size={18} /></button>
                 <div style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', marginTop: '10px' }} onClick={() => setIsLoginMode(!isLoginMode)}>
                   {isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                 </div>
               </>
             ) : (
               <>
                 <input autoFocus value={userCompany} onChange={e => setUserCompany(e.target.value)} placeholder="Company Name" className="finance-input" required />
                 {errorMsg && <div style={{ color: 'var(--accent-red)', fontSize: '12px', marginTop: '-10px', paddingLeft: '5px' }}>{errorMsg}</div>}
                 <button type="submit" className="finance-btn">Initialize <ChevronRight size={18} /></button>
               </>
             )}
           </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-layout theme-${theme} ${isMonitoring ? 'radar-scanning' : ''}`}>
      {/* Sidebar - Dynamically routing to agents */}
      <div className="sidebar">
        <div className="sidebar-logo">
           <Activity size={28} color="var(--accent-green)" />
           MarketWatch
        </div>

        <div className="sidebar-menu-title">Main Menu</div>
        <div className={`sidebar-item ${activeView === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveView('dashboard')}>
          <Home size={18} /> Dashboard Overview
        </div>
        <div className={`sidebar-item ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
          <History size={18} /> Analysis History
        </div>
        
        <div className="sidebar-menu-title" style={{ marginTop: '20px' }}>AI Agents</div>
        <div className={`sidebar-item ${activeView === 'strategy' ? 'active' : ''}`} onClick={() => setActiveView('strategy')}>
          <BrainCircuit size={18} /> Strategy Agent
        </div>
        <div className={`sidebar-item ${activeView === 'marketing' ? 'active' : ''}`} onClick={() => setActiveView('marketing')}>
          <TrendingUp size={18} /> Marketing Agent
        </div>
        <div className={`sidebar-item ${activeView === 'product' ? 'active' : ''}`} onClick={() => setActiveView('product')}>
          <Target size={18} /> Product Agent
        </div>
        <div className={`sidebar-item ${activeView === 'sales' ? 'active' : ''}`} onClick={() => setActiveView('sales')}>
          <CreditCard size={18} /> Sales Agent
        </div>

      </div>

      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Top Header */}
        <div className="top-header">
           <div className="header-text">
             <h1>Welcome, {currentUser?.displayName ? currentUser.displayName : (currentUser?.email ? currentUser.email.split('@')[0].charAt(0).toUpperCase() + currentUser.email.split('@')[0].slice(1) : 'Agent')}!</h1>
             <p>Effortlessly manage your intelligence targets with real-time insights</p>
           </div>
           <div className="header-actions">
             <div className="icon-btn" onClick={toggleTheme} title="Toggle Theme" style={{ cursor: 'pointer', background: theme === 'dark' ? 'rgba(255,145,0,0.1)' : '#f1f5f9', border: theme === 'dark' ? '1px solid var(--accent-orange)' : '1px solid #cbd5e1' }}>
                {theme === 'dark' ? <Sun size={18} color="var(--accent-orange)" /> : <Moon size={18} color="#0f172a" />}
             </div>
             <div className="icon-btn badge"><Bell size={18} /></div>
             <div style={{ position: 'relative' }}>
               <div className="avatar" onClick={() => setShowProfileMenu(!showProfileMenu)} style={{ cursor: 'pointer' }}></div>
               {showProfileMenu && (
                 <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '10px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 100, minWidth: '150px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                   <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)', borderBottom: '1px solid var(--panel-border)', marginBottom: '5px' }}>
                     {currentUser?.displayName ? `${currentUser.displayName} (${currentUser.email})` : (currentUser?.email || 'User Profile')}
                   </div>
                   <div onClick={handleChangePassword} style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)', borderRadius: '6px' }} onMouseOver={e => e.target.style.background='var(--sidebar-hover)'} onMouseOut={e => e.target.style.background='transparent'}>
                     Change Password
                   </div>
                   <div onClick={handleLogout} style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', color: 'var(--accent-red)', borderRadius: '6px' }} onMouseOver={e => e.target.style.background='var(--sidebar-hover)'} onMouseOut={e => e.target.style.background='transparent'}>
                     Sign Out
                   </div>
                 </div>
               )}
             </div>
           </div>
        </div>

         {/* THREAT ALERT BANNERS */}
         {liveThreats.map(threat => (
           <div key={threat.id} className="animate-slide-up" style={{ background: threat.threat_level === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: `1px solid ${threat.threat_level === 'High' ? 'var(--accent-red)' : 'var(--accent-orange)'}`, padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
               {threat.threat_level === 'High' ? <Target size={24} color="var(--accent-red)" style={{ animation: 'spin 2s linear infinite' }} /> : <Activity size={24} color="var(--accent-orange)" />}
               <div>
                 <div style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '15px' }}>{threat.threat_level} Threat Detected</div>
                 <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{threat.message}</div>
               </div>
             </div>
             <button onClick={() => setLiveThreats(prev => prev.filter(t => t.id !== threat.id))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><XCircle size={18} /></button>
           </div>
         ))}

         {/* Dashboard Actions */}
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
              {activeView === 'dashboard' ? 'Intelligence Activity Overview' : `${activeView.charAt(0).toUpperCase() + activeView.slice(1)} Agent`}
              {activeView === 'dashboard' && competitors.length > 0 && (
                 <button 
                   onClick={toggleLiveRadar}
                   style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: isMonitoring ? 'rgba(34, 197, 94, 0.1)' : 'var(--input-bg)', border: `1px solid ${isMonitoring ? 'var(--accent-green)' : 'var(--panel-border)'}`, color: isMonitoring ? 'var(--accent-green)' : 'var(--text-muted)', cursor: 'pointer', outline: 'none', transition: 'all 0.2s ease' }}
                 >
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isMonitoring ? 'var(--accent-green)' : 'var(--text-muted)', boxShadow: isMonitoring ? '0 0 8px var(--accent-green)' : 'none', opacity: isMonitoring ? 1 : 0.5 }}></div>
                   {isMonitoring ? 'Live Radar: ON' : 'Live Radar: OFF'}
                 </button>
              )}
            </h2>
             <div style={{ display: 'flex', gap: '10px' }}>
               <input 
                 value={compInput} 
                 onChange={e => setCompInput(e.target.value)} 
                 placeholder="Find competitors..." 
                 className="finance-input" 
                 style={{ width: '250px', background: 'var(--panel-bg)', borderRadius: '20px', padding: '8px 16px' }}
               />
               <button onClick={async () => { 
                 if(compInput) { 
                   setIsValidating(true);
                   try {
                       const res = await fetch(`${API_BASE_URL}/validate?name=${encodeURIComponent(compInput)}`);
                       const data = await res.json();
                       if (!data.valid) {
                          alert("Fake or Unrecognized Company! Please enter a real company.");
                          setIsValidating(false);
                          return;
                       }
                   } catch (err) {}
                   setCompetitors([...competitors, compInput]); 
                   setCompInput(''); 
                   setIsValidating(false);
                 } 
               }} className="finance-btn" style={{ borderRadius: '20px', padding: '8px 16px', opacity: isValidating ? 0.7 : 1 }}>{isValidating ? 'Verifying...' : 'Add Target'}</button>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px', background: 'var(--panel-bg)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--panel-border)' }}>
                 <input type="file" accept=".csv,.txt,.json" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                 <button onClick={() => fileInputRef.current.click()} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '4px' }}>
                   <UploadCloud size={16} color="var(--accent-green)" />
                   <span style={{ fontSize: '13px' }}>{localFileName || 'Upload Internal Data'}</span>
                 </button>
                 {localFileName && <XCircle size={14} color="var(--accent-red)" style={{ cursor: 'pointer', marginLeft: '5px' }} onClick={() => { setLocalFileName(''); setLocalData(''); }} />}
               </div>

               <button onClick={handleDispatch} className="finance-btn" style={{ borderRadius: '20px', padding: '8px 16px', background: 'var(--text-main)', color: 'var(--panel-bg)', marginLeft: '10px' }}>{loading ? 'Scanning...' : 'Analyze'}</button>
            </div>
        </div>

        {/* --- ROUTER RENDER LOGIC --- */}

        {activeView === 'dashboard' && (
          <>
            {/* Metric Cards Row */}
            <div className="metrics-row">
               <div className="bankio-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column' }}>
                  <span className="metric-title">Tracked Targets</span>
                  <div className="metric-value-row">
                    <span className="metric-value">{competitors.length}</span>
                    <div className="pill green" style={{ marginLeft: 'auto' }}><Activity size={12} /> Live Nodes</div>
                  </div>
               </div>

               <div className="bankio-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column' }}>
                  <span className="metric-title">Data Points Processed</span>
                  <div className="metric-value-row">
                    <span className="metric-value">{loading ? '...' : getDataPoints()}</span>
                    <div className="pill green" style={{ marginLeft: 'auto' }}><Database size={12} /> Real-Time Volume</div>
                  </div>
               </div>

               <div className="bankio-panel" style={{ padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                     <span className="metric-title">Threat Level</span>
                     <div className="metric-value-row">
                       <span className="metric-value" style={{ color: data?.threat_level === 'Critical' ? 'var(--accent-red)' : (data ? 'var(--accent-green)' : 'var(--text-muted)') }}>
                         {loading ? 'Scanning...' : (data ? data.threat_level : 'Idle')}
                       </span>
                     </div>
                     {lastScanned && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>Last Scan: {lastScanned}</div>}
                  </div>
                  {data?.marketing_graph && (
                    <div style={{ height: '60px', width: '120px' }}>
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={data.marketing_graph}>
                           <Area type="monotone" dataKey="score" stroke="var(--accent-green)" fill="var(--accent-green-light)" strokeWidth={2} />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                  )}
               </div>
            </div>

            {/* Targets & Sources Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
               <div className="bankio-panel">
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Selected Targets</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                     <div style={{ padding: '8px 12px', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', border: '1px solid var(--panel-border)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                        <Target size={14} /> {userCompany} (Primary)
                        {data?.sector_analysis?.[userCompany] && !data.sector_analysis[userCompany].toLowerCase().includes('commerce') && <span style={{ color: 'var(--accent-orange)', fontSize: '11px', marginLeft: '4px' }}>[{data.sector_analysis[userCompany]}]</span>}
                     </div>
                     {competitors.map((comp, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <Target size={14} color="var(--accent-orange)" /> {comp}
                           {data?.sector_analysis?.[comp] && !data.sector_analysis[comp].toLowerCase().includes('commerce') && <span style={{ color: 'var(--accent-orange)', fontSize: '11px', marginLeft: '4px' }}>[{data.sector_analysis[comp]}]</span>}
                           <XCircle 
                              size={14} 
                              color="var(--accent-red)" 
                              style={{ cursor: 'pointer', marginLeft: '4px' }}
                              onClick={() => {
                                 if(window.confirm(`Are you sure you want to stop tracking ${comp}?`)) {
                                    setCompetitors(competitors.filter((_, i) => i !== idx));
                                 }
                              }}
                           />
                        </div>
                     ))}
                  </div>
               </div>

               <div className="bankio-panel">
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     Intelligence Sources
                     {data?.sources?.length > 3 && (
                        <span onClick={() => setShowAllSources(!showAllSources)} style={{ fontSize: '12px', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 'normal' }}>
                           {showAllSources ? 'Show Less' : `+${data.sources.length - 3} More`}
                        </span>
                     )}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                     {loading && <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>Establishing uplinks...</div>}
                     
                     {!loading && data?.sources && (showAllSources ? data.sources : data.sources.slice(0, 3)).map((source, idx) => (
                        <div key={idx} className="animate-slide-up" style={{ padding: '8px 12px', background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <Database size={14} color="var(--accent-green)" /> {source}
                        </div>
                     ))}
                     {!loading && !data && <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '13px' }}>Run analysis to discover sources</div>}
                  </div>
               </div>
            </div>

            {/* Live Agent Terminal / Executive Brief */}
            {loading && (
              <div className="bankio-panel animate-slide-up" style={{ padding: '0', overflow: 'hidden', background: '#0a0a0a', border: '1px solid #333' }}>
                 <div style={{ background: '#111', padding: '10px 15px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-green)', fontFamily: 'monospace', fontSize: '13px' }}>
                   <RefreshCw size={14} className="spin-anim" /> root@marketwatch-swarm:~
                 </div>
                 <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '60px', fontFamily: '"Fira Code", monospace', fontSize: '13px' }}>
                   <span style={{ color: '#888' }}>&gt;</span>
                   <div style={{ color: 'var(--accent-green)', flex: 1 }}>
                     {terminalLogs[0] || 'Awaiting swarm dispatch...'}
                   </div>
                   <div style={{ color: 'var(--accent-green)', animation: 'pulse 1s infinite' }}>_</div>
                 </div>
                 <style dangerouslySetInnerHTML={{__html: `
                    .spin-anim { animation: spin 2s linear infinite; }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
                 `}} />
              </div>
            )}
            
            {!loading && data && (
              <div className="bankio-panel animate-slide-up" style={{ padding: '30px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div>
                     <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                       <BrainCircuit size={20} color="var(--accent-green)" /> Executive Strategy Brief
                     </h3>
                     <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px 0' }}>
                       Synthesized high-level overview generated by the Chief Strategic Advisor AI.
                     </p>
                   </div>
                   <button onClick={() => downloadPDF('strategy-report-content', 'Executive_Strategy')} className="finance-btn" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                     <Download size={14} /> Download PDF
                   </button>
                 </div>
                 <div id="strategy-report-content" className="markdown-body" style={{ color: 'var(--text-main)', lineHeight: '1.7', fontSize: '14px', padding: '20px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '15px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
                      Report Generated: {lastScanned || new Date().toLocaleString()}
                    </div>
                    <ReactMarkdown>{data.strategy_data}</ReactMarkdown>
                 </div>
              </div>
            )}
          </>
        )}

        {/* AGENT VIEWS */}
        {activeView !== 'dashboard' && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Agent Graph Panel */}
            <div className="bankio-panel" style={{ height: '350px', padding: '30px' }}>
               <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: 'var(--text-main)' }}>Interactive Metric Analysis</h3>
               {data ? (
                 <div style={{ width: '100%', height: 'calc(100% - 40px)' }}>
                   {activeView === 'strategy' ? (
                     <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data.radar_data}>
                          <PolarGrid stroke="var(--panel-border)" />
                          <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                          <PolarRadiusAxis stroke="var(--text-muted)" />
                          <Radar name={userCompany} dataKey="A" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.5} />
                          <Radar name="Competitor Avg" dataKey="B" stroke="var(--accent-orange)" fill="var(--accent-orange)" fillOpacity={0.5} />
                          <Legend wrapperStyle={{ color: 'var(--text-main)' }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }} />
                        </RadarChart>
                     </ResponsiveContainer>
                   ) : (
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={data[`${activeView}_graph`]} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                         <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                         <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                         <RechartsTooltip cursor={{fill: 'var(--sidebar-hover)'}} contentStyle={{ backgroundColor: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '8px', color: 'var(--text-main)' }} />
                         <Bar dataKey="score" fill="var(--accent-green)" radius={[4,4,0,0]} barSize={40} />
                       </BarChart>
                     </ResponsiveContainer>
                   )}
                 </div>
               ) : (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                   Please click 'Analyze' to generate data for this agent.
                 </div>
               )}
            </div>

            {/* Agent Text Report Panel */}
            <div className="bankio-panel" style={{ padding: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Intelligence Feed</h3>
                {data && (
                  <button onClick={() => downloadPDF('agent-report-content', activeView)} className="finance-btn" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Download size={14} /> Download PDF
                  </button>
                )}
              </div>
              {data ? (
                 <div id="agent-report-content" className="markdown-body" style={{ color: 'var(--text-main)', lineHeight: '1.7', fontSize: '14px', padding: '20px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '15px', borderBottom: '1px solid #cbd5e1', paddingBottom: '10px' }}>
                      Report Generated: {lastScanned || new Date().toLocaleString()}
                    </div>
                    <ReactMarkdown>{data[`${activeView}_data`]}</ReactMarkdown>
                 </div>
              ) : (
                 <div style={{ color: 'var(--text-muted)' }}>Waiting for swarm intelligence...</div>
              )}
            </div>

          </div>
        )}

        {/* HISTORY VIEW */}
        {activeView === 'history' && (
          <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="bankio-panel" style={{ padding: '30px' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <History size={20} color="var(--accent-green)" /> Previous Intelligence Reports
                </h3>
                
                {isHistoryLoading ? (
                  <div style={{ color: 'var(--text-muted)' }}>Fetching historical data...</div>
                ) : historyData.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>No historical reports found. Run an analysis first!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {historyData.map((hist) => (
                      <div key={hist.id} style={{ padding: '20px', border: '1px solid var(--panel-border)', borderRadius: '12px', background: 'var(--input-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                               {new Date(hist.timestamp).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                               {hist.user_company} vs {hist.competitors?.join(', ') || 'None'}
                            </div>
                         </div>
                         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: hist.report.threat_level === 'Critical' ? 'var(--accent-red)' : 'var(--accent-green)', marginRight: '15px', fontWeight: 'bold' }}>
                               {hist.report.threat_level}
                            </span>
                            <button 
                               onClick={() => {
                                  setData(hist.report);
                                  setCompetitors(hist.competitors || []);
                                  setActiveView('dashboard');
                               }} 
                               className="finance-btn" 
                               style={{ padding: '6px 12px', fontSize: '12px', background: 'transparent', border: '1px solid var(--accent-green)', color: 'var(--accent-green)' }}
                            >
                               Load Report
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {/* FLOATING CHATBOT UI */}
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '15px' }}>
          {isChatOpen && (
             <div className="animate-slide-up" style={{ width: '350px', height: '450px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                <div style={{ background: '#114b3e', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontWeight: 'bold' }}>
                      <BrainCircuit size={18} color="#22c55e" /> MarketWatch Copilot
                   </div>
                   <button onClick={() => setIsChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
                </div>
                <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', background: 'var(--bg-primary)' }}>
                   {chatMessages.map((msg, idx) => (
                      <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                         <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                            {msg.role === 'user' ? 'You' : 'Copilot'}
                         </div>
                         <div style={{ background: msg.role === 'user' ? 'var(--accent-green)' : 'var(--input-bg)', color: msg.role === 'user' ? '#fff' : 'var(--text-main)', padding: '10px 15px', borderRadius: '8px', border: msg.role === 'user' ? 'none' : '1px solid var(--panel-border)', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                         </div>
                      </div>
                   ))}
                   {isChatLoading && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                         <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>Copilot</div>
                         <div style={{ background: 'var(--input-bg)', color: 'var(--text-muted)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--panel-border)', fontSize: '13px' }}>
                            <div className="spin-anim" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%' }}></div> Thinking...
                         </div>
                      </div>
                   )}
                   <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleChatSubmit} style={{ padding: '15px', background: 'var(--panel-bg)', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '10px' }}>
                   <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask about the strategy..." className="finance-input" style={{ flex: 1, padding: '10px 15px' }} />
                   <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="finance-btn" style={{ padding: '10px', background: (!chatInput.trim() || isChatLoading) ? '#333' : 'var(--accent-green)', opacity: (!chatInput.trim() || isChatLoading) ? 0.5 : 1 }}>
                      <Send size={16} />
                   </button>
                </form>
             </div>
          )}
          <button 
             onClick={() => setIsChatOpen(!isChatOpen)}
             style={{ width: '55px', height: '55px', borderRadius: '50%', background: 'var(--accent-green)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)', transition: 'transform 0.2s' }}
             onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
             onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
             {isChatOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;
