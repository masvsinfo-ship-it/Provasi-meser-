import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency, getAutoDetectedCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';
const BREAKFAST_DESC = "সকালের নাস্তা জমা";

const COUNTRIES = [
  { name: 'Bangladesh', code: '+880', flag: '🇧🇩' },
  { name: 'Saudi Arabia', code: '+966', flag: '🇸🇦' },
  { name: 'UAE', code: '+971', flag: '🇦🇪' },
  { name: 'Qatar', code: '+974', flag: '🇶🇦' },
  { name: 'Oman', code: '+968', flag: '🇴🇲' },
  { name: 'Kuwait', code: '+965', flag: '🇰🇼' },
  { name: 'Bahrain', code: '+973', flag: '🇧🇭' },
  { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
];

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem('is_admin') === 'true');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAdminTab, setIsAdminTab] = useState(false);
  
  // Auth States
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[1]); // Default Saudi
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
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
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
    } else {
      setMembers([]);
      setExpenses([]);
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

  const handleSendOtp = () => {
    if (tempPhone.length < 6 || tempPassword.length < 4) {
      showToast("সঠিক নাম্বার ও পাসওয়ার্ড দিন", "error");
      return;
    }
    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};
    
    // Check if user exists with or without country code
    if (users[fullPhone] || users[tempPhone]) {
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

    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};

    if (isLoginMode) {
      let finalLoginPhone = fullPhone;
      let loginSuccess = false;

      // 1. Check with country code
      if (users[fullPhone] && users[fullPhone] === tempPassword) {
        loginSuccess = true;
      } 
      // 2. Check without country code (Compatibility for old users)
      else if (users[tempPhone] && users[tempPhone] === tempPassword) {
        // Migrate old data to new key with country code
        const oldPhone = tempPhone;
        users[fullPhone] = users[oldPhone];
        delete users[oldPhone];
        
        // Migrate mess data
        const oldMembers = localStorage.getItem(`${APP_PREFIX}${oldPhone}_members`);
        const oldExpenses = localStorage.getItem(`${APP_PREFIX}${oldPhone}_expenses`);
        if (oldMembers) localStorage.setItem(`${APP_PREFIX}${fullPhone}_members`, oldMembers);
        if (oldExpenses) localStorage.setItem(`${APP_PREFIX}${fullPhone}_expenses`, oldExpenses);
        
        // Remove old keys
        localStorage.removeItem(`${APP_PREFIX}${oldPhone}_members`);
        localStorage.removeItem(`${APP_PREFIX}${oldPhone}_expenses`);
        
        // Update users list in disk
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        
        loginSuccess = true;
        finalLoginPhone = fullPhone;
      }

      if (loginSuccess) {
        localStorage.setItem('logged_in_phone', finalLoginPhone);
        localStorage.setItem('is_admin', 'false');
        setUserPhone(finalLoginPhone);
        setIsAdmin(false);
        showToast("লগইন সফল!");
      } else {
        showToast("নাম্বার বা পাসওয়ার্ড ভুল!", "error");
      }
    } else {
      // Signup with OTP check
      if (userEnteredOtp !== generatedOtp) {
        showToast("ভুল OTP দিয়েছেন!", "error");
        return;
      }
      users[fullPhone] = tempPassword;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
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
      setTempPassword('');
      setTempPhone('');
      setOtpSent(false);
      setActiveTab('dashboard');
      showToast("সফলভাবে লগআউট হয়েছে");
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        showToast("অ্যাপটি ইনস্টল হচ্ছে...");
      }
    } else {
      alert("আপনার ব্রাউজারের থ্রি-ডট মেনু থেকে 'Install App' বা 'Add to Home Screen' বাটনে ক্লিক করে এন্ড্রয়েড অ্যাপ হিসেবে ব্যবহার করুন।");
    }
  };

  const deleteUser = (phoneToDelete: string) => {
    if (window.confirm(`${phoneToDelete} এর সকল ডাটা চিরতরে মুছে ফেলতে চান?`)) {
      const storedUsersRaw = localStorage.getItem(USERS_KEY);
      if (storedUsersRaw) {
        const users = JSON.parse(storedUsersRaw);
        delete users[phoneToDelete];
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        localStorage.removeItem(`${APP_PREFIX}${phoneToDelete}_members`);
        localStorage.removeItem(`${APP_PREFIX}${phoneToDelete}_expenses`);
        if (userPhone === phoneToDelete) setUserPhone(null);
        showToast(`${phoneToDelete} ডিলিট করা হয়েছে`, 'error');
      }
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
    if (window.confirm("আপনি কি নিশ্চিতভাবে এই মেম্বারকে ডিলিট করতে চান?")) {
      const updatedMembers = members.filter(m => m.id !== id);
      const updatedExpenses = expenses.filter(e => e.targetMemberId !== id);
      setMembers(updatedMembers);
      setExpenses(updatedExpenses);
      saveToDisk(updatedMembers, updatedExpenses);
      showToast("মেম্বার ডিলিট করা হয়েছে", "error");
    }
  };

  const leaveMember = (id: string) => {
    if (window.confirm("এই মেম্বার কি মেছ ছেড়ে দিচ্ছেন?")) {
      const now = Date.now();
      const updated = members.map(m => {
        if (m.id === id) {
          const periods = m.periods || [{ join: m.joinDate }];
          const lastPeriod = periods[periods.length - 1];
          if (lastPeriod && !lastPeriod.leave) lastPeriod.leave = now;
          return { ...m, leaveDate: now, periods };
        }
        return m;
      });
      setMembers(updated);
      saveToDisk(updated, expenses);
      showToast("মেম্বারকে নিষ্ক্রিয় করা হয়েছে", "warning");
    }
  };

  const reactivateMember = (id: string) => {
    if (window.confirm("এই মেম্বারকে কি আবার সক্রিয় করতে চান?")) {
      const now = Date.now();
      const updated = members.map(m => {
        if (m.id === id) {
          const periods = m.periods || [{ join: m.joinDate, leave: m.leaveDate }];
          periods.push({ join: now });
          return { ...m, leaveDate: undefined, periods };
        }
        return m;
      });
      setMembers(updated);
      saveToDisk(updated, expenses);
      showToast("মেম্বার সক্রিয় করা হয়েছে", "success");
    }
  };

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(ExpenseType.SHARED);
  const [targetId, setTargetId] = useState('');

  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amount)) {
      showToast("সব তথ্য দিন", "error");
      return;
    }
    if (expenseType !== ExpenseType.SHARED && !targetId) {
      showToast("মেম্বার সিলেক্ট করুন", "error");
      return;
    }
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: expenseDesc,
      amount,
      type: expenseType,
      payerId: 'shop',
      targetMemberId: expenseType === ExpenseType.SHARED ? undefined : targetId,
      date: Date.now(),
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    setExpenseDesc('');
    setExpenseAmount('');
    showToast("হিসাব সেভ হয়েছে!");
    saveToDisk(members, updated);
    setActiveTab('dashboard');
  };

  const addBreakfastDeposit = (memberId: string) => {
    const amountRaw = breakfastInputs[memberId];
    const amount = parseFloat(amountRaw || '');
    const member = members.find(m => m.id === memberId);
    if (!member || isNaN(amount) || amount <= 0) {
      showToast("সঠিক টাকার পরিমাণ দিন", "error");
      return;
    }
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
    showToast(`${member.name} এর নাস্তার টাকা জমা হয়েছে`);
    saveToDisk(members, updated);
  };

  const deleteExpense = (id: string) => {
    if (window.confirm("লেনদেনটি ডিলিট করতে চান?")) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      saveToDisk(members, updated);
      showToast("ডিলিট করা হয়েছে", "warning");
    }
  };

  const clearAllExpenses = () => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে সকল লেনদেন মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।")) {
      setExpenses([]);
      saveToDisk(members, []);
      showToast("সকল লেনদেন মুছে ফেলা হয়েছে", "warning");
    }
  };

  const clearAllBreakfast = () => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে সকল নাস্তার হিসাব মুছে ফেলতে চান?")) {
      const updated = expenses.filter(e => e.description !== BREAKFAST_DESC);
      setExpenses(updated);
      saveToDisk(members, updated);
      showToast("সকল নাস্তার হিসাব মুছে ফেলা হয়েছে", "warning");
    }
  };

  const activeMembers = members.filter(m => !m.leaveDate);
  const inactiveMembers = members.filter(m => !!m.leaveDate);

  const getAllUsersData = () => {
    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    if (!storedUsersRaw) return [];
    const users = JSON.parse(storedUsersRaw);
    return Object.keys(users).map(phone => ({
      phone,
      password: users[phone]
    }));
  };

  const renderAdminView = () => (
    <div className="space-y-4 animate-in fade-in duration-500 text-[12px]">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
          <span className="text-xl">🛠️</span> এডমিন কন্ট্রোল প্যানেল
        </h2>
        <div className="space-y-2">
          {getAllUsersData().map(user => (
            <div key={user.phone} className={`w-full p-3 rounded-xl border flex justify-between items-center ${userPhone === user.phone ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700'}`}>
              <div className="flex-1 cursor-pointer" onClick={() => setUserPhone(user.phone)}>
                <p className="font-black text-[13px]">{user.phone}</p>
                <p className={`text-[10px] ${userPhone === user.phone ? 'text-indigo-200' : 'text-slate-400'} font-bold`}>Pass: {user.password}</p>
              </div>
              <button onClick={() => deleteUser(user.phone)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      {!userPhone && (
        <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-600 text-white font-black text-[11px] uppercase shadow-lg">এডমিন লগআউট</button>
      )}
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 text-[13px]">
      <div className="bg-indigo-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-2xl"></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">মোট দোকান বাকি</p>
          <h1 className="text-3xl font-black">{formatCurrency(summary.grandTotalDebt, currencyCode)}</h1>
          <div className="mt-3 grid grid-cols-4 gap-1 text-center">
            <div className="bg-white/10 p-1.5 rounded-lg"><p className="text-[6px] font-black opacity-60">শেয়ার</p><p className="text-[9px] font-black">{formatCurrency(summary.totalSharedExpense, currencyCode)}</p></div>
            <div className="bg-white/10 p-1.5 rounded-lg"><p className="text-[6px] font-black opacity-60">ব্যক্তিগত</p><p className="text-[9px] font-black">{formatCurrency(summary.totalPersonalExpense, currencyCode)}</p></div>
            <div className="bg-emerald-50/20 p-1.5 rounded-lg"><p className="text-[6px] font-black text-emerald-200">জমা</p><p className="text-[9px] font-black">{formatCurrency(summary.totalPayments, currencyCode)}</p></div>
            <div className="bg-amber-500/20 p-1.5 rounded-lg"><p className="text-[6px] font-black text-amber-200">নাস্তা</p><p className="text-[9px] font-black">{formatCurrency(summary.totalBreakfastPayments, currencyCode)}</p></div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex gap-3 items-center">
        <span className="text-xl shrink-0">💡</span>
        <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">{aiInsight}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-black text-slate-900 px-1 uppercase text-[9px] tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> মেম্বার ভিত্তিক হিসাব
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {summary.memberBalances.map((mb) => (
            <div key={mb.member.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${mb.member.leaveDate ? 'border-slate-200 opacity-60' : 'border-slate-100'} flex flex-col space-y-3 relative overflow-hidden transition-all active:scale-[0.98]`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={mb.member.avatar} className="w-12 h-12 rounded-full border-2 border-indigo-50 bg-slate-50 shadow-sm" />
                    {!mb.member.leaveDate && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-[14px] truncate">{mb.member.name}</p>
                    <p className={`text-[7px] font-black uppercase tracking-wider ${mb.member.leaveDate ? 'text-slate-400' : 'text-indigo-500'}`}>
                      {mb.member.leaveDate ? 'মেছ ছেড়েছেন' : 'বর্তমানে সক্রিয়'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <p className={`text-[18px] font-black leading-none ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(mb.netBalance, currencyCode)}
                  </p>
                  <p className="text-[8px] font-black uppercase text-slate-300 mt-1 tracking-widest">ব্যালেন্স</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-50">
                <div className="bg-indigo-50/40 p-1.5 rounded-xl text-center">
                  <p className="text-[6px] font-black text-indigo-400 uppercase tracking-tighter">শেয়ার</p>
                  <p className="text-[10px] font-black text-indigo-700">{formatCurrency(mb.sharedShare, currencyCode)}</p>
                </div>
                <div className="bg-rose-50/40 p-1.5 rounded-xl text-center">
                  <p className="text-[6px] font-black text-rose-400 uppercase tracking-tighter">ব্যক্তিগত</p>
                  <p className="text-[10px] font-black text-rose-700">{formatCurrency(mb.personalTotal, currencyCode)}</p>
                </div>
                <div className="bg-emerald-50/40 p-1.5 rounded-xl text-center">
                  <p className="text-[6px] font-black text-emerald-400 uppercase tracking-tighter">জমা</p>
                  <p className="text-[10px] font-black text-emerald-700">{formatCurrency(mb.paid, currencyCode)}</p>
                </div>
                <div className="bg-amber-50/40 p-1.5 rounded-xl text-center">
                  <p className="text-[6px] font-black text-amber-500 uppercase tracking-tighter">নাস্তা</p>
                  <p className="text-[10px] font-black text-amber-700">{formatCurrency(mb.breakfastPaid, currencyCode)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!userPhone && !isAdmin) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col justify-center p-6 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 space-y-5 max-w-sm mx-auto w-full py-8">
          <h2 className="text-xl font-black tracking-tight mb-2">ব্যাচেলর দের মেছের হিসাব</h2>
          <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-2xl mb-2">🏪</div>
          <h1 className="text-lg font-bold tracking-tight opacity-90">
            {isAdminTab ? 'এডমিন লগিন' : (isLoginMode ? 'ইউজার লগইন' : 'নতুন অ্যাকাউন্ট')}
          </h1>
          
          <form onSubmit={handleAuth} className="space-y-3">
            {!isAdminTab && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative">
                    <select 
                      className="h-full bg-white/10 border-2 border-white/20 rounded-xl px-2 py-3 text-sm font-bold appearance-none outline-none focus:bg-white focus:text-indigo-900 transition-all cursor-pointer"
                      value={selectedCountry.name}
                      onChange={(e) => setSelectedCountry(COUNTRIES.find(c => c.name === e.target.value) || COUNTRIES[0])}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c.name} value={c.name}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                  </div>
                  <input 
                    type="tel" 
                    placeholder="মোবাইল নাম্বার" 
                    className="flex-1 bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-md font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                    value={tempPhone} 
                    onChange={e => setTempPhone(e.target.value)} 
                    disabled={otpSent && !isLoginMode}
                  />
                </div>
                
                <input 
                  type="password" 
                  placeholder="পাসওয়ার্ড" 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                  value={tempPassword} 
                  onChange={e => setTempPassword(e.target.value)} 
                  disabled={otpSent && !isLoginMode}
                />

                {!isLoginMode && otpSent && (
                  <div className="animate-in slide-in-from-top-2">
                    <input 
                      type="number" 
                      placeholder="৪ সংখ্যার OTP দিন" 
                      className="w-full bg-emerald-500/20 border-2 border-emerald-500/40 rounded-xl px-5 py-3 text-md font-black text-center outline-none focus:bg-white focus:text-indigo-900 transition-all" 
                      value={userEnteredOtp} 
                      onChange={e => setUserEnteredOtp(e.target.value)} 
                    />
                    <p className="text-[10px] text-emerald-300 font-bold mt-2">আপনার ওটিপি: {generatedOtp} (পরীক্ষামূলক)</p>
                  </div>
                )}
              </div>
            )}

            {isAdminTab && (
              <input 
                type="password" 
                placeholder="এডমিন পাসওয়ার্ড" 
                className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none text-center focus:bg-white focus:text-indigo-900 transition-all" 
                value={tempPassword} 
                onChange={e => setTempPassword(e.target.value)} 
              />
            )}

            {!isLoginMode && !otpSent ? (
              <button 
                type="button" 
                onClick={handleSendOtp}
                className="w-full bg-emerald-500 text-white font-black py-3.5 rounded-xl text-md shadow-xl active:scale-95 transition-all"
              >
                OTP পাঠান
              </button>
            ) : (
              <button className="w-full bg-white text-indigo-900 font-black py-3.5 rounded-xl text-md shadow-xl active:scale-95 transition-all">
                {isLoginMode ? 'প্রবেশ করুন' : 'অ্যাকাউন্ট নিশ্চিত করুন'}
              </button>
            )}
          </form>

          <div className="flex flex-col gap-3 items-center">
            {!isAdminTab ? (
              <>
                <button onClick={() => { setIsLoginMode(!isLoginMode); setOtpSent(false); }} className="text-indigo-200 font-bold text-sm underline">
                  {isLoginMode ? 'নতুন মেছ? অ্যাকাউন্ট খুলুন' : 'আগের মেছ? লগইন করুন'}
                </button>
                <button onClick={() => setIsAdminTab(true)} className="text-white/40 font-black text-[10px] uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full mt-2">এডমিন লগিন</button>
              </>
            ) : (
              <button onClick={() => setIsAdminTab(false)} className="text-indigo-200 font-bold text-sm underline">ইউজার লগইনে ফিরে যান</button>
            )}
          </div>
          
          <div className="pt-8 flex flex-col items-center gap-3">
            <button onClick={handleInstallApp} className="group flex items-center gap-4 bg-indigo-600 border border-white/20 hover:bg-indigo-500 transition-all px-8 py-3 rounded-2xl shadow-xl active:scale-95">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.523 15.3414L19.5441 18.8142C19.7431 19.1561 19.626 19.5932 19.2825 19.7922C18.939 19.9912 18.502 19.8741 18.303 19.5306L16.2415 15.9922C15.0001 16.634 13.5653 17 12 17C10.4347 17 9 16.634 7.7585 15.9922L5.69697 19.5306C5.498 19.8741 5.06094 19.9912 4.71746 19.7922C4.37397 19.5932 4.25688 19.1561 4.45591 18.8142L6.47697 15.3414C4.10319 13.8863 2.5 11.3323 2.5 8.39999C2.5 8.08244 2.51863 7.76922 2.55469 7.46143H21.4453C21.4814 7.76922 21.5 8.08244 21.5 8.39999C21.5 11.3323 19.8968 13.8863 17.523 15.3414ZM7 11.5C7.55228 11.5 8 11.0523 8 10.5C8 9.94772 7.55228 9.5 7 9.5C6.44772 9.5 6 9.94772 6 10.5C6 11.0523 6.44772 11.5 7 11.5ZM17 11.5C17.5523 11.5 18 11.0523 18 10.5C18 9.94772 17.5523 9.5 17 9.5C16.4477 9.5 16 9.94772 16 10.5C16 11.0523 16.4477 11.5 17 11.5ZM15.5 3.5C15.5 3.5 15.5 3.5 15.5 3.5C15.5 3.5 15.5 3.5 15.5 3.5ZM15.8285 2.17157L17.2427 0.757359C17.5356 0.464466 18.0104 0.464466 18.3033 0.757359C18.5962 1.05025 18.5962 1.52513 18.3033 1.81802L17.1517 2.9696C18.3562 3.90595 19.3412 5.09337 20.0381 6.46143H3.96191C4.65882 5.09337 5.64379 3.90595 6.84831 2.9696L5.6967 1.81802C5.40381 1.52513 5.40381 1.05025 5.6967 0.757359C5.98959 0.464466 6.46447 0.464466 6.75736 0.757359L8.17157 2.17157C9.3375 1.41113 10.6385 1 12 1C13.3615 1 14.6625 1.41113 15.8285 2.17157Z"/></svg>
              </div>
              <div className="text-left border-l border-white/20 pl-4">
                <p className="text-[10px] font-black uppercase text-indigo-200 mb-1">এন্ড্রয়েড অ্যাপ</p>
                <p className="text-[14px] font-black text-white">ইনস্টল করুন</p>
              </div>
            </button>
            <p className="text-[10px] text-indigo-300/60 font-medium max-w-[200px] leading-tight mt-1">এই অ্যাপটি একবার ইনস্টল করলে আপনি অফলাইনেও ব্যবহার করতে পারবেন।</p>
          </div>
        </div>
        {toast && (
          <div className="fixed bottom-10 left-6 right-6 z-50 p-4 rounded-xl text-center font-bold text-sm bg-rose-500 shadow-2xl animate-in slide-in-from-bottom-4">
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-24 text-[13px]">
        {isAdmin && !userPhone && renderAdminView()}
        {isAdmin && userPhone && (
          <div className="mb-4 flex gap-2 animate-in slide-in-from-top-4">
            <button onClick={() => setUserPhone(null)} className="flex-1 bg-white text-indigo-700 border border-indigo-200 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-sm flex items-center justify-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
              ইউজার লিস্টে ফিরে যান
            </button>
          </div>
        )}
        {userPhone && (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-lg font-black text-center mb-5 text-slate-900">{isAdmin ? 'ইউজার ডাটা এন্ট্রি (Admin)' : 'নতুন এন্ট্রি যোগ করুন'}</h2>
                  <div className="space-y-4">
                    <input type="text" placeholder="খরচের বিবরণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none focus:border-indigo-500" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                    <input type="number" placeholder="টাকার পরিমাণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-black text-lg outline-none focus:border-indigo-500" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setExpenseType(ExpenseType.SHARED)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>সবার বাজার</button>
                      <button onClick={() => setExpenseType(ExpenseType.PERSONAL)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>ব্যক্তিগত</button>
                      <button onClick={() => setExpenseType(ExpenseType.PAYMENT)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>জমা/পেমেন্ট</button>
                    </div>
                    {expenseType !== ExpenseType.SHARED && (
                      <select className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none" value={targetId} onChange={e => setTargetId(e.target.value)}>
                        <option value="">মেম্বার সিলেক্ট করুন...</option>
                        {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                    <button onClick={addExpense} className="w-full py-3.5 rounded-xl font-black shadow-lg bg-indigo-700 text-white active:scale-95">সেভ করুন</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'breakfast' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">☕ নাস্তার টাকা জমা</h2>
                  <div className="space-y-3">
                    {activeMembers.map(m => (
                      <div key={m.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <img src={m.avatar} className="w-10 h-10 rounded-full border bg-white" />
                          <p className="font-black text-slate-800 text-[12px] truncate">{m.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input type="number" placeholder="পরিমাণ" className="w-20 bg-white border rounded-xl px-3 py-2 text-xs font-black text-center" value={breakfastInputs[m.id] || ''} onChange={(e) => setBreakfastInputs(prev => ({ ...prev, [m.id]: e.target.value }))} />
                          <button onClick={() => addBreakfastDeposit(m.id)} className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-2 rounded-xl shadow-md active:scale-90">জমা</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">সাম্প্রতিক নাস্তা জমা</h3>
                  {expenses.some(e => e.description === BREAKFAST_DESC) && <button onClick={clearAllBreakfast} className="text-[9px] font-black uppercase text-rose-500 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">সব মুছুন</button>}</div>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {expenses.filter(e => e.description === BREAKFAST_DESC).map(exp => (
                      <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <p className="font-black text-slate-700 text-[11px] truncate">{members.find(m => m.id === exp.targetMemberId)?.name || 'অজানা'}</p>
                          <p className="text-[7px] text-slate-400 font-bold">{new Date(exp.date).toLocaleDateString('bn-BD')} • {new Date(exp.date).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-emerald-600 text-[11px]">{formatCurrency(exp.amount, currencyCode)}</span>
                          <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 p-1.5 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1"><h2 className="text-lg font-black text-slate-900">লেনদেন খাতা</h2><button onClick={clearAllExpenses} className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">সব মুছুন</button></div>
                {expenses.map(exp => {
                  const targetMember = members.find(m => m.id === exp.targetMemberId);
                  const memberName = exp.type === ExpenseType.SHARED ? "সবার বাজার" : (targetMember?.name || "অজানা");
                  
                  return (
                    <div key={exp.id} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="font-black text-slate-800 text-[13px] truncate">{exp.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[8px] text-slate-400 font-bold uppercase">{new Date(exp.date).toLocaleDateString('bn-BD')}</p>
                          <span className="text-[8px] text-slate-300">•</span>
                          <p className="text-[8px] text-indigo-500 font-black uppercase tracking-wider">{memberName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-black text-[13px] ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(exp.amount, currencyCode)}</span>
                        <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 p-1 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {activeTab === 'summary' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-3">মেম্বার ম্যানেজমেন্ট</h3>
                  <div className="flex gap-2 mb-4">
                    <input id="member-name-input" type="text" placeholder="মেম্বারের নাম" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 font-bold outline-none" />
                    <button onClick={addMember} className="px-5 py-2 rounded-xl font-black shadow-md text-[10px] bg-indigo-600 text-white active:scale-95">যোগ</button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-indigo-500 uppercase px-1">সক্রিয় মেম্বার</p>
                    {activeMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-black text-slate-800 text-[12px]">{m.name}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => leaveMember(m.id)} className="text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase">নিষ্ক্রিয়</button>
                          <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </div>
                    ))}

                    {inactiveMembers.length > 0 && (
                      <div className="space-y-2 pt-4 border-t border-slate-100 mt-4">
                        <p className="text-[9px] font-black text-rose-500 uppercase px-1">নিষ্ক্রিয় মেম্বার</p>
                        {inactiveMembers.map(m => (
                          <div key={m.id} className="flex items-center justify-between p-3 bg-slate-100 rounded-xl border border-slate-200 opacity-70">
                            <span className="font-black text-slate-500 text-[12px] line-through">{m.name}</span>
                            <div className="flex gap-1.5">
                              <button onClick={() => reactivateMember(m.id)} className="text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase">সক্রিয় করুন</button>
                              <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-1.5 hover:bg-rose-50 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase border border-rose-100 shadow-sm">লগআউট ({userPhone})</button>
              </div>
            )}
          </>
        )}
      </div>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;