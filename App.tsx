
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary, UserProfile } from './types.ts';
import { calculateMessSummary, formatCurrency, getAutoDetectedCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';
import { jsPDF } from 'jspdf';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';
const PROFILES_KEY = 'mess_tracker_user_profiles';
const BREAKFAST_DESC = "সকালের নাস্তা জমা";

const COUNTRIES = [
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩', length: 11 },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦', length: 9 },
  { name: 'UAE', code: '+971', flag: '🇦🇪', length: 9 },
  { name: 'Qatar', code: '+974', flag: '🇶🇦', length: 8 },
  { name: 'Oman', code: '+968', flag: '🇴🇲', length: 8 },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼', length: 8 },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭', length: 8 },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾', length: 9 },
  { name: 'India', code: '+91', flag: '🇮🇳', length: 10 },
  { name: 'Pakistan', code: '+92', flag: '🇵🇰', length: 10 },
  { name: 'Nepal', code: '+977', flag: '🇳🇵', length: 10 },
  { name: 'Sri Lanka', code: '+94', flag: '🇱🇰', length: 9 },
  { name: 'USA', code: '+1', flag: '🇺🇸', length: 10 },
  { name: 'UK', code: '+44', flag: '🇬🇧', length: 10 },
].sort((a, b) => a.name.localeCompare(b.name));

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem('is_admin') === 'true');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAdminTab, setIsAdminTab] = useState(false);
  
  // Auth States
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.name === 'Saudi Arabia') || COUNTRIES[0]); 
  const [tempName, setTempName] = useState('');
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');

  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currencyCode] = useState<string>(() => {
    return localStorage.getItem(`${APP_PREFIX}global_currency`) || getAutoDetectedCurrency();
  });

  const [breakfastInputs, setBreakfastInputs] = useState<Record<string, string>>({});
  
  const fullPhone = `${selectedCountry.code}${tempPhone}`;

  useEffect(() => {
    if (userPhone) {
      const savedMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const savedExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      setMembers(savedMembers ? JSON.parse(savedMembers) : []);
      setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);
    }
  }, [userPhone]);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        showToast("অ্যাপ ইনস্টল হচ্ছে...");
      }
    } else {
      alert("আপনার ব্রাউজার মেনু থেকে 'Install App' বা 'Add to Home Screen' ক্লিক করে সরাসরি অ্যাপ হিসেবে ব্যবহার করুন।");
    }
  };

  const saveToDisk = (updatedMembers: Member[], updatedExpenses: Expense[]) => {
    if (userPhone) {
      localStorage.setItem(`${APP_PREFIX}${userPhone}_members`, JSON.stringify(updatedMembers));
      localStorage.setItem(`${APP_PREFIX}${userPhone}_expenses`, JSON.stringify(updatedExpenses));
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const validatePhoneNumber = () => {
    if (tempPhone.length !== selectedCountry.length) {
      showToast(`${selectedCountry.name} এর জন্য ${selectedCountry.length} সংখ্যার সঠিক নাম্বার দিন`, "error");
      return false;
    }
    return true;
  };

  const handleSendOtp = () => {
    if (!tempName.trim()) {
      showToast("আপনার নাম দিন", "error");
      return;
    }
    if (!validatePhoneNumber()) return;
    
    if (tempPassword.length < 4) {
      showToast("পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের দিন", "error");
      return;
    }

    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};
    
    if (users[fullPhone]) {
      showToast("এই নাম্বার আগে থেকেই আছে", "error");
      return;
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    setOtpSent(true);
    alert(`আপনার রেজিস্ট্রেশন কোড (OTP): ${newOtp}`);
    showToast("আপনার মোবাইলে OTP পাঠানো হয়েছে", "success");
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdminTab) {
      if (tempPassword === '8795') {
        localStorage.setItem('is_admin', 'true');
        setIsAdmin(true);
        setUserPhone(null);
        showToast("এডমিন লগিন সফল!");
      } else {
        showToast("ভুল এডমিন পাসওয়ার্ড!", "error");
      }
      return;
    }

    if (!validatePhoneNumber()) return;

    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};

    if (isLoginMode) {
      if (users[fullPhone] && users[fullPhone] === tempPassword) {
        localStorage.setItem('logged_in_phone', fullPhone);
        localStorage.setItem('is_admin', 'false');
        setUserPhone(fullPhone);
        setIsAdmin(false);
        showToast("লগইন সফল!");
      } else {
        showToast("নাম্বার বা পাসওয়ার্ড ভুল!", "error");
      }
    } else {
      if (userEnteredOtp !== generatedOtp) {
        showToast("ভুল OTP দিয়েছেন!", "error");
        return;
      }
      users[fullPhone] = tempPassword;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
      profiles[fullPhone] = { name: tempName };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));

      localStorage.setItem('logged_in_phone', fullPhone);
      localStorage.setItem('is_admin', 'false');
      setUserPhone(fullPhone);
      setIsAdmin(false);
      showToast("রেজিস্ট্রেশন সফল!");
    }
  };

  const handleLogout = () => {
    if (window.confirm("লগআউট করতে চান?")) {
      localStorage.removeItem('logged_in_phone');
      localStorage.removeItem('is_admin');
      setUserPhone(null);
      setIsAdmin(false);
      setIsAdminTab(false);
      setActiveTab('dashboard');
      showToast("সফলভাবে লগআউট হয়েছে");
    }
  };

  const handleShareReport = async () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('bn-BD');
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
    const messName = userPhone ? (profiles[userPhone]?.name || 'মেছ হিসাব') : 'মেছ হিসাব';

    doc.setFontSize(22);
    doc.text(messName, 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('মেছ খরচের রিপোর্ট', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`তারিখ: ${date}`, 105, 38, { align: 'center' });

    doc.setDrawColor(200);
    doc.rect(20, 45, 170, 35);
    doc.setFontSize(11);
    doc.text(`মোট বাজার খরচ: ${formatCurrency(summary.totalSharedExpense, currencyCode)}`, 30, 55);
    doc.text(`মোট ব্যক্তিগত খরচ: ${formatCurrency(summary.totalPersonalExpense, currencyCode)}`, 30, 62);
    doc.text(`মোট জমা: ${formatCurrency(summary.totalPayments, currencyCode)}`, 30, 69);
    doc.setFontSize(12);
    doc.text(`বাকি: ${formatCurrency(summary.grandTotalDebt, currencyCode)}`, 140, 62);

    doc.setFontSize(14);
    doc.text('মেম্বার ভিত্তিক ব্যালেন্স', 20, 95);
    doc.line(20, 97, 190, 97);
    
    let y = 105;
    doc.setFontSize(11);
    summary.memberBalances.forEach((mb) => {
      doc.text(mb.member.name, 20, y);
      const balanceText = formatCurrency(mb.netBalance, currencyCode);
      doc.setTextColor(mb.netBalance < 0 ? 200 : 0, mb.netBalance < 0 ? 0 : 150, 0);
      doc.text(balanceText, 190, y, { align: 'right' });
      doc.setTextColor(0);
      y += 10;
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
    });

    const footerY = 280;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Generated by: ব্যাচেলর দের মেছের হিসাব', 105, footerY, { align: 'center' });
    doc.text('Developer: Billal | FB: fb.com/billal8795', 105, footerY + 7, { align: 'center' });

    const pdfBlob = doc.output('blob');
    const fileName = `Mess_Report_${date}.pdf`;

    if (navigator.share) {
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      try {
        await navigator.share({
          files: [file],
          title: 'মেছের হিসাব রিপোর্ট',
          text: `তারিখ: ${date} এর মেছ হিসাব রিপোর্ট। ডেবলপার: বিল্লাল (fb.com/billal8795)`
        });
      } catch (err) {
        doc.save(fileName);
      }
    } else {
      doc.save(fileName);
      showToast("পিডিএফ ডাউনলোড হয়েছে");
    }
  };

  const summary = useMemo(() => calculateMessSummary(members, expenses), [members, expenses]);

  const [aiInsight, setAiInsight] = useState<string>('বিশ্লেষণ করছি...');
  useEffect(() => {
    const fetchInsight = async () => {
      if (expenses.length > 0 && userPhone) {
        const insight = await geminiService.getSmartInsight(summary, currencyCode);
        setAiInsight(insight);
      } else {
        setAiInsight("মেম্বার ও খরচ যোগ করলে আমি আপনাকে পরামর্শ দিবো। 😊");
      }
    };
    fetchInsight();
  }, [summary, expenses.length, userPhone, currencyCode]);

  const addMember = () => {
    const nameInput = (document.getElementById('member-name-input') as HTMLInputElement)?.value;
    if (!nameInput?.trim()) return;
    const now = Date.now();
    const newMember: Member = {
      id: now.toString(),
      name: nameInput.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nameInput)}`,
      joinDate: now,
      periods: [{ join: now }]
    };
    const updated = [...members, newMember];
    setMembers(updated);
    (document.getElementById('member-name-input') as HTMLInputElement).value = '';
    showToast(`${newMember.name} যোগ হয়েছে`);
    saveToDisk(updated, expenses);
  };

  const deleteMemberRecord = (id: string) => {
    if (window.confirm("মেম্বার ডিলিট করতে চান?")) {
      const updatedMembers = members.filter(m => m.id !== id);
      const updatedExpenses = expenses.filter(e => e.targetMemberId !== id);
      setMembers(updatedMembers);
      setExpenses(updatedExpenses);
      saveToDisk(updatedMembers, updatedExpenses);
      showToast("ডিলিট হয়েছে", "error");
    }
  };

  const addExpense = () => {
    const amount = parseFloat((document.getElementById('expense-amount') as HTMLInputElement).value);
    const desc = (document.getElementById('expense-desc') as HTMLInputElement).value;
    const type = (document.getElementById('expense-type') as HTMLSelectElement).value as ExpenseType;
    const target = (document.getElementById('expense-target') as HTMLSelectElement)?.value;

    if (!desc || isNaN(amount)) {
      showToast("সব তথ্য দিন", "error");
      return;
    }
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: desc,
      amount,
      type,
      payerId: 'shop',
      targetMemberId: type === ExpenseType.SHARED ? undefined : target,
      date: Date.now(),
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    (document.getElementById('expense-amount') as HTMLInputElement).value = '';
    (document.getElementById('expense-desc') as HTMLInputElement).value = '';
    showToast("সেভ হয়েছে!");
    saveToDisk(members, updated);
    setActiveTab('dashboard');
  };

  const addBreakfastDeposit = (memberId: string) => {
    const amountRaw = breakfastInputs[memberId];
    const amount = parseFloat(amountRaw || '');
    if (isNaN(amount) || amount <= 0) return;
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: BREAKFAST_DESC,
      amount,
      type: ExpenseType.PAYMENT,
      payerId: 'shop',
      targetMemberId: memberId,
      date: Date.now(),
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setBreakfastInputs(prev => ({ ...prev, [memberId]: '' }));
    showToast("জমা হয়েছে");
    saveToDisk(members, updated);
  };

  if (!userPhone && !isAdmin) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col justify-center p-6 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 space-y-5 max-w-sm mx-auto w-full py-8">
          <h2 className="text-xl font-black tracking-tight mb-2">ব্যাচেলর দের মেছের হিসাব</h2>
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-2xl mb-2">🏪</div>
          <h1 className="text-lg font-bold tracking-tight opacity-90">
            {isAdminTab ? '🔐 এডমিন লগিন' : (isLoginMode ? '👋 ইউজার লগইন' : '📝 নতুন অ্যাকাউন্ট')}
          </h1>
          
          <form onSubmit={handleAuth} className="space-y-3">
            {!isAdminTab && (
              <div className="space-y-3">
                {!isLoginMode && (
                  <input 
                    type="text" 
                    placeholder="আপনার নাম" 
                    className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                    value={tempName} 
                    onChange={e => setTempName(e.target.value)} 
                  />
                )}
                <div className="flex gap-2">
                  <select 
                    className="bg-white/10 border-2 border-white/20 rounded-xl px-2 py-3 text-sm font-bold outline-none"
                    value={selectedCountry.name}
                    onChange={(e) => setSelectedCountry(COUNTRIES.find(c => c.name === e.target.value) || COUNTRIES[0])}
                  >
                    {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.flag} {c.code}</option>)}
                  </select>
                  <input 
                    type="tel" 
                    placeholder="মোবাইল নাম্বার" 
                    className="flex-1 bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-md font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                    value={tempPhone} 
                    onChange={e => setTempPhone(e.target.value)} 
                  />
                </div>
                <input 
                  type="password" 
                  placeholder="পাসওয়ার্ড" 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                  value={tempPassword} 
                  onChange={e => setTempPassword(e.target.value)} 
                />
                {!isLoginMode && otpSent && (
                  <input 
                    type="number" 
                    placeholder="ওটিপি দিন" 
                    className="w-full bg-emerald-500/20 border-2 border-emerald-500/40 rounded-xl px-5 py-3 text-md font-black text-center" 
                    value={userEnteredOtp} 
                    onChange={e => setUserEnteredOtp(e.target.value)} 
                  />
                )}
              </div>
            )}
            {isAdminTab && <input type="password" placeholder="পাসওয়ার্ড লিখুন" className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none text-center" value={tempPassword} onChange={e => setTempPassword(e.target.value)} />}

            <button type={!isLoginMode && !otpSent && !isAdminTab ? 'button' : 'submit'} onClick={!isLoginMode && !otpSent && !isAdminTab ? handleSendOtp : undefined} className="w-full bg-white text-indigo-900 font-black py-3.5 rounded-xl text-md shadow-xl active:scale-95 transition-all">
              {isAdminTab ? 'প্রবেশ করুন' : (isLoginMode ? 'প্রবেশ করুন' : (otpSent ? 'নিশ্চিত করুন' : 'OTP পাঠান'))}
            </button>
          </form>

          <div className="flex flex-col gap-3 items-center">
            {!isAdminTab ? (
              <button onClick={() => { setIsLoginMode(!isLoginMode); setOtpSent(false); }} className="text-indigo-200 font-bold text-sm underline">
                {isLoginMode ? 'নতুন মেছ? অ্যাকাউন্ট খুলুন' : 'আগের মেছ? লগইন করুন'}
              </button>
            ) : <button onClick={() => setIsAdminTab(false)} className="text-indigo-200 font-bold text-sm underline">ইউজার লগইনে ফিরুন</button>}
            
            {/* Install Button at Bottom */}
            <button 
              onClick={handleInstallApp} 
              className="mt-6 flex items-center gap-2 bg-indigo-600/30 border border-white/20 hover:bg-indigo-600/50 transition-all px-6 py-2.5 rounded-2xl shadow-xl active:scale-95 group"
            >
              <svg className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              <p className="text-[12px] font-black text-white uppercase tracking-wider">এন্ড্রয়েড অ্যাপ ইনস্টল করুন</p>
            </button>

            <button onClick={() => setIsAdminTab(!isAdminTab)} className="text-white/20 text-[10px] uppercase font-black tracking-widest mt-4">এডমিন লগিন</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-24 text-[13px]">
        {userPhone && (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-indigo-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-2xl"></div>
                  <p className="text-indigo-200 text-[10px] font-black uppercase mb-1">মোট দোকান বাকি</p>
                  <h1 className="text-3xl font-black">{formatCurrency(summary.grandTotalDebt, currencyCode)}</h1>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex gap-3 items-center">
                  <span className="text-xl shrink-0">💡</span>
                  <p className="text-[11px] text-slate-600 font-medium italic">{aiInsight}</p>
                </div>
                <div className="space-y-3">
                  <h3 className="font-black text-slate-900 px-1 uppercase text-[9px] tracking-widest">মেম্বার ভিত্তিক হিসাব</h3>
                  {summary.memberBalances.map(mb => (
                    <div key={mb.member.id} className="bg-white p-4 rounded-xl border flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <img src={mb.member.avatar} className="w-10 h-10 rounded-full bg-slate-50 border" />
                        <p className="font-black text-slate-800">{mb.member.name}</p>
                      </div>
                      <p className={`font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(mb.netBalance, currencyCode)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'expenses' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
                <h2 className="text-lg font-black text-slate-900 text-center">নতুন খরচ</h2>
                <input id="expense-desc" type="text" placeholder="খরচের বিবরণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none" />
                <input id="expense-amount" type="number" placeholder="টাকার পরিমাণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-black text-lg outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <select id="expense-type" className="bg-slate-50 border rounded-xl px-4 py-2 font-bold outline-none" onChange={(e) => {
                    const targetEl = document.getElementById('expense-target-container');
                    if (targetEl) targetEl.style.display = e.target.value === ExpenseType.SHARED ? 'none' : 'block';
                  }}>
                    <option value={ExpenseType.SHARED}>সবার বাজার</option>
                    <option value={ExpenseType.PERSONAL}>ব্যক্তিগত</option>
                    <option value={ExpenseType.PAYMENT}>জমা</option>
                  </select>
                  <div id="expense-target-container" style={{display: 'none'}}>
                    <select id="expense-target" className="w-full bg-slate-50 border rounded-xl px-4 py-2 font-bold outline-none">
                      <option value="">মেম্বার...</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addExpense} className="w-full py-3.5 rounded-xl font-black bg-indigo-700 text-white shadow-lg active:scale-95">সেভ করুন</button>
              </div>
            )}
            {activeTab === 'breakfast' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
                  <h2 className="text-lg font-black text-slate-900 mb-2">☕ নাস্তার টাকা জমা</h2>
                  {members.map(m => (
                    <div key={m.id} className="bg-slate-50 rounded-2xl p-4 border flex items-center justify-between gap-4">
                      <p className="font-black text-slate-800 text-[12px]">{m.name}</p>
                      <div className="flex gap-2 shrink-0">
                        <input type="number" placeholder="টাকা" className="w-16 bg-white border rounded-xl px-2 py-2 text-xs font-black text-center" value={breakfastInputs[m.id] || ''} onChange={(e) => setBreakfastInputs(prev => ({ ...prev, [m.id]: e.target.value }))} />
                        <button onClick={() => addBreakfastDeposit(m.id)} className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-2 rounded-xl active:scale-90">জমা</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === 'summary' && (
              <div className="space-y-5 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <button onClick={handleShareReport} className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-[12px] uppercase shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                    হিসাব শেয়ার করুন (PDF)
                  </button>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-3">মেম্বার লিস্ট</h3>
                  <div className="flex gap-2 mb-4">
                    <input id="member-name-input" type="text" placeholder="মেম্বারের নাম" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 font-bold outline-none" />
                    <button onClick={addMember} className="px-5 py-2 rounded-xl font-black bg-indigo-600 text-white text-[10px] uppercase">যোগ</button>
                  </div>
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-black text-slate-800 text-[12px]">{m.name}</span>
                        <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-1.5 transition-colors hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Install Link in Summary too */}
                <button 
                  onClick={handleInstallApp} 
                  className="w-full py-4 rounded-xl bg-slate-800 text-white font-black text-[12px] uppercase shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                  এন্ড্রয়েড অ্যাপ ইনস্টল করুন
                </button>

                <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase border border-rose-100">লগআউট করুন</button>
              </div>
            )}
          </>
        )}
      </div>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full shadow-2xl animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
