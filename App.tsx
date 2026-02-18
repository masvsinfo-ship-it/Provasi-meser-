
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary, UserProfile } from './types.ts';
import { calculateMessSummary, formatCurrency, getAutoDetectedCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

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
  { name: 'Canada', code: '+1', flag: '🇨🇦', length: 10 },
  { name: 'UK', code: '+44', flag: '🇬🇧', length: 10 },
  { name: 'Italy', code: '+39', flag: '🇮🇹', length: 10 },
  { name: 'Singapore', code: '+65', flag: '🇸🇬', length: 8 },
  { name: 'Maldives', code: '+960', flag: '🇲🇻', length: 7 },
  { name: 'Lebanon', code: '+961', flag: '🇱🇧', length: 8 },
  { name: 'Jordan', code: '+962', flag: 'জও', length: 9 },
  { name: 'South Korea', code: '+82', flag: '🇰🇷', length: 10 },
  { name: 'Japan', code: '+81', flag: '🇯🇵', length: 10 },
  { name: 'France', code: '+33', flag: '🇫🇷', length: 9 },
  { name: 'Germany', code: '+49', flag: '🇩🇪', length: 11 },
  { name: 'Australia', code: '+61', flag: '🇦🇺', length: 9 },
  { name: 'Spain', code: '+34', flag: '🇪🇸', length: 9 },
  { name: 'Portugal', code: '+351', flag: '🇵🇹', length: 9 },
  { name: 'South Africa', code: '+27', flag: '🇿🇦', length: 9 },
  { name: 'Egypt', code: '+20', flag: '🇪🇬', length: 10 },
  { name: 'Turkey', code: '+90', flag: '🇹🇷', length: 10 },
  { name: 'Greece', code: '+30', flag: '🇬🇷', length: 10 },
  { name: 'Mauritius', code: '+230', flag: '🇲🇺', length: 8 },
  { name: 'Brunei', code: '+673', flag: '🇧🇳', length: 7 },
  { name: 'Hong Kong', code: '+852', flag: '🇭🇰', length: 8 },
  { name: 'Vietnam', code: '+84', flag: '🇻🇳', length: 9 },
  { name: 'Thailand', code: '+66', flag: '🇹🇭', length: 9 },
  { name: 'Switzerland', code: '+41', flag: '🇨🇭', length: 9 },
].sort((a, b) => a.name.localeCompare(b.name));

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem('is_admin') === 'true');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAdminTab, setIsAdminTab] = useState(false);
  
  // Auth States
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.name === 'Saudi Arabia') || COUNTRIES[0]); 
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');

  // Profile Edit States
  const [editName, setEditName] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');
  const [editNewPhone, setEditNewPhone] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');

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

  // Current Profile Info
  const userProfile: UserProfile = useMemo(() => {
    if (!userPhone) return { name: 'ইউজার', avatarSeed: 'default' };
    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
    return profiles[userPhone] || { name: 'ইউজার', avatarSeed: userPhone };
  }, [userPhone]);

  useEffect(() => {
    if (userPhone) {
      const savedMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const savedExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      setMembers(savedMembers ? JSON.parse(savedMembers) : []);
      setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);
      
      // Init edit fields
      setEditName(userProfile.name);
      setEditAvatarSeed(userProfile.avatarSeed);
      setEditNewPhone(userPhone.replace(selectedCountry.code, ''));
    } else {
      setMembers([]);
      setExpenses([]);
    }
  }, [userPhone, userProfile, selectedCountry.code]);

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

  const validatePhoneNumber = (phone: string, country = selectedCountry) => {
    if (phone.length !== country.length) {
      showToast(`${country.name} এর জন্য ${country.length} সংখ্যার সঠিক নাম্বার দিন`, "error");
      return false;
    }
    return true;
  };

  const handleSendOtp = () => {
    if (!validatePhoneNumber(tempPhone)) return;
    
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

    if (!validatePhoneNumber(tempPhone)) return;

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
      profiles[fullPhone] = { name: 'ইউজার', avatarSeed: fullPhone };
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
      setTempPassword('');
      setTempPhone('');
      setOtpSent(false);
      setActiveTab('dashboard');
      showToast("সফলভাবে লগআউট হয়েছে");
    }
  };

  const handleUpdateProfile = () => {
    if (!userPhone) return;
    if (!editName.trim()) {
      showToast("নাম অবশ্যই দিতে হবে", "error");
      return;
    }

    const profiles = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    
    const newFullPhone = `${selectedCountry.code}${editNewPhone}`;
    const isPhoneChanging = newFullPhone !== userPhone;

    if (isPhoneChanging) {
      if (users[newFullPhone]) {
        showToast("এই নাম্বারটি ইতিমধ্যে অন্য কেউ ব্যবহার করছেন", "error");
        return;
      }
      if (!validatePhoneNumber(editNewPhone)) return;

      if (!window.confirm("মোবাইল নাম্বার পরিবর্তন করলে আপনার সকল ডাটা নতুন নাম্বারে স্থানান্তরিত হবে। আপনি কি নিশ্চিত?")) return;

      // Migrate data
      const currentMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const currentExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      
      if (currentMembers) localStorage.setItem(`${APP_PREFIX}${newFullPhone}_members`, currentMembers);
      if (currentExpenses) localStorage.setItem(`${APP_PREFIX}${newFullPhone}_expenses`, currentExpenses);
      
      localStorage.removeItem(`${APP_PREFIX}${userPhone}_members`);
      localStorage.removeItem(`${APP_PREFIX}${userPhone}_expenses`);

      // Update auth
      const oldPassword = users[userPhone];
      users[newFullPhone] = editNewPassword || oldPassword;
      delete users[userPhone];
      
      // Update profile
      profiles[newFullPhone] = { name: editName, avatarSeed: editAvatarSeed };
      delete profiles[userPhone];

      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      localStorage.setItem('logged_in_phone', newFullPhone);
      setUserPhone(newFullPhone);
      showToast("প্রোফাইল আপডেট হয়েছে");
    } else {
      if (editNewPassword) {
        users[userPhone] = editNewPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      
      profiles[userPhone] = { name: editName, avatarSeed: editAvatarSeed };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      showToast("প্রোফাইল আপডেট হয়েছে");
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

  const renderAdminView = () => (
    <div className="space-y-4 animate-in fade-in duration-500 text-[12px]">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">🛠️ এডমিন কন্ট্রোল প্যানেল</h2>
        <div className="space-y-2">
          {Object.keys(JSON.parse(localStorage.getItem(USERS_KEY) || '{}')).map(phone => (
            <div key={phone} className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center">
              <span className="font-bold">{phone}</span>
              <button onClick={() => setUserPhone(phone)} className="text-indigo-600 font-black uppercase text-[10px]">ডাটা দেখুন</button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-600 text-white font-black text-[11px] uppercase">এডমিন লগআউট</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 text-[13px]">
      <div className="bg-indigo-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 -translate-y-12 blur-2xl"></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">মোট দোকান বাকি</p>
          <h1 className="text-3xl font-black">{formatCurrency(summary.grandTotalDebt, currencyCode)}</h1>
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
        {summary.memberBalances.map((mb) => (
          <div key={mb.member.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <img src={mb.member.avatar} className="w-10 h-10 rounded-full bg-slate-50 border" />
              <p className="font-black text-slate-800">{mb.member.name}</p>
            </div>
            <p className={`font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(mb.netBalance, currencyCode)}</p>
          </div>
        ))}
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
                  <select 
                    className="bg-white/10 border-2 border-white/20 rounded-xl px-2 py-3 text-sm font-bold outline-none focus:bg-white focus:text-indigo-900 transition-all cursor-pointer"
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
              <input type="password" placeholder="এডমিন পাসওয়ার্ড" className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-5 py-3 text-md font-bold outline-none text-center focus:bg-white focus:text-indigo-900 transition-all" value={tempPassword} onChange={e => setTempPassword(e.target.value)} />
            )}
            <button className="w-full bg-white text-indigo-900 font-black py-3.5 rounded-xl text-md shadow-xl active:scale-95 transition-all">
              {isAdminTab ? 'প্রবেশ করুন' : (isLoginMode ? 'প্রবেশ করুন' : (otpSent ? 'নিশ্চিত করুন' : 'OTP পাঠান'))}
            </button>
            {!isLoginMode && !otpSent && !isAdminTab && (
              <button type="button" onClick={handleSendOtp} className="hidden"></button>
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
          
          <div className="pt-8">
            <button onClick={handleInstallApp} className="group flex items-center gap-4 bg-indigo-600 border border-white/20 hover:bg-indigo-500 transition-all px-8 py-3 rounded-2xl shadow-xl active:scale-95">
              <p className="text-[14px] font-black text-white uppercase tracking-wider">অ্যাপ ইনস্টল করুন</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-24 text-[13px]">
        {isAdmin && !userPhone && renderAdminView()}
        {userPhone && (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'expenses' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h2 className="text-lg font-black text-center mb-5 text-slate-900">নতুন খরচ যোগ করুন</h2>
                  <div className="space-y-4">
                    <input type="text" placeholder="খরচের বিবরণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                    <input type="number" placeholder="টাকার পরিমাণ" className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-black text-lg outline-none" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => setExpenseType(ExpenseType.SHARED)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>সবার বাজার</button>
                      <button onClick={() => setExpenseType(ExpenseType.PERSONAL)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>ব্যক্তিগত</button>
                      <button onClick={() => setExpenseType(ExpenseType.PAYMENT)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : 'bg-white text-slate-400'}`}>জমা/পেমেন্ট</button>
                    </div>
                    {expenseType !== ExpenseType.SHARED && (
                      <select className="w-full bg-slate-50 border rounded-xl px-4 py-2.5 font-bold outline-none" value={targetId} onChange={e => setTargetId(e.target.value)}>
                        <option value="">মেম্বার সিলেক্ট করুন...</option>
                        {members.filter(m => !m.leaveDate).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                    {members.filter(m => !m.leaveDate).map(m => (
                      <div key={m.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <img src={m.avatar} className="w-10 h-10 rounded-full border bg-white" />
                          <p className="font-black text-slate-800 text-[12px]">{m.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" placeholder="পরিমাণ" className="w-20 bg-white border rounded-xl px-3 py-2 text-xs font-black text-center" value={breakfastInputs[m.id] || ''} onChange={(e) => setBreakfastInputs(prev => ({ ...prev, [m.id]: e.target.value }))} />
                          <button onClick={() => addBreakfastDeposit(m.id)} className="bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-2 rounded-xl shadow-md">জমা</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1"><h2 className="text-lg font-black text-slate-900">লেনদেন খাতা</h2></div>
                {expenses.map(exp => (
                  <div key={exp.id} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-black text-slate-800 text-[13px] truncate">{exp.description}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase">{new Date(exp.date).toLocaleDateString('bn-BD')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-black text-[13px] ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(exp.amount, currencyCode)}</span>
                      <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'summary' && (
              <div className="space-y-5 pb-10">
                {/* Profile Management */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-5">
                  <div className="flex flex-col items-center gap-3 mb-2">
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editAvatarSeed || userProfile.avatarSeed}`} 
                      className="w-24 h-24 rounded-full border-4 border-indigo-50 bg-slate-50 shadow-md"
                      alt="Profile"
                    />
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">প্রোফাইল সেটিংস</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">আপনার নাম</label>
                      <input type="text" className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold outline-none" value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">অ্যাভাটার সিড (Seed)</label>
                      <input type="text" className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold outline-none" value={editAvatarSeed} onChange={e => setEditAvatarSeed(e.target.value)} placeholder="যেকোনো নাম লিখুন" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">মোবাইল নাম্বার</label>
                      <div className="flex gap-2">
                        <div className="bg-slate-100 border rounded-xl px-3 py-3 text-sm font-bold text-slate-500 flex items-center">{selectedCountry.code}</div>
                        <input type="tel" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 font-bold outline-none" value={editNewPhone} onChange={e => setEditNewPhone(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">নতুন পাসওয়ার্ড (ঐচ্ছিক)</label>
                      <input type="password" placeholder="বদলাতে চাইলে লিখুন" className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold outline-none" value={editNewPassword} onChange={e => setEditNewPassword(e.target.value)} />
                    </div>
                    <button onClick={handleUpdateProfile} className="w-full py-4 rounded-xl bg-indigo-600 text-white font-black text-[12px] uppercase shadow-lg active:scale-95 transition-all">পরিবর্তন সেভ করুন</button>
                  </div>
                </div>

                {/* Member Management */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h3 className="font-black text-[10px] uppercase tracking-wider text-slate-400 mb-3">মেম্বার ম্যানেজমেন্ট</h3>
                  <div className="flex gap-2 mb-4">
                    <input id="member-name-input" type="text" placeholder="মেম্বারের নাম" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 font-bold outline-none" />
                    <button onClick={addMember} className="px-5 py-2 rounded-xl font-black shadow-md text-[10px] bg-indigo-600 text-white active:scale-95">যোগ</button>
                  </div>
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-black text-slate-800 text-[12px]">{m.name}</span>
                        <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-1.5 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-50 text-rose-600 font-black text-[11px] uppercase border border-rose-100 shadow-sm">লগআউট করুন ({userPhone})</button>
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
