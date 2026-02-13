import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency, getAutoDetectedCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';
const BREAKFAST_DESC = "সকালের নাস্তা জমা";

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem('is_admin') === 'true');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAdminTab, setIsAdminTab] = useState(false);
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    return localStorage.getItem(`${APP_PREFIX}global_currency`) || getAutoDetectedCurrency();
  });

  const [breakfastInputs, setBreakfastInputs] = useState<Record<string, string>>({});
  
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
    if (tempPhone.length < 10 || tempPassword.length < 4) {
      showToast("সঠিক তথ্য দিন", "error");
      return;
    }
    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};
    if (isLoginMode) {
      if (users[tempPhone] && users[tempPhone] === tempPassword) {
        localStorage.setItem('logged_in_phone', tempPhone);
        localStorage.setItem('is_admin', 'false');
        setUserPhone(tempPhone);
        setIsAdmin(false);
        showToast("লগইন সফল!");
      } else {
        showToast("নাম্বার বা পাসওয়ার্ড ভুল!", "error");
      }
    } else {
      if (users[tempPhone]) {
        showToast("এই নাম্বার আগে থেকেই আছে", "error");
      } else {
        users[tempPhone] = tempPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        localStorage.setItem('logged_in_phone', tempPhone);
        localStorage.setItem('is_admin', 'false');
        setUserPhone(tempPhone);
        setIsAdmin(false);
        showToast("রেজিস্ট্রেশন সফল!");
      }
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
      setActiveTab('dashboard');
      showToast("সফলভাবে লগআউট হয়েছে");
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      alert("ব্রাউজারের মেনু থেকে 'Install App' এ ক্লিক করুন।");
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
    const amount = parseFloat(breakfastInputs[memberId] || '');
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

  const renderAdminView = () => (
    <div className="space-y-4 animate-in fade-in duration-500 text-[12px]">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h2 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">🛠️ এডমিন কন্ট্রোল প্যানেল</h2>
        <div className="space-y-2">
          {Object.keys(JSON.parse(localStorage.getItem(USERS_KEY) || '{}')).map(phone => (
            <div key={phone} className="w-full p-3 rounded-xl border bg-slate-50 flex justify-between items-center">
              <div>
                <p className="font-black text-[13px]">{phone}</p>
                <p className="text-[10px] text-slate-400 font-bold">Pass: {JSON.parse(localStorage.getItem(USERS_KEY) || '{}')[phone]}</p>
              </div>
              <button onClick={() => deleteUser(phone)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-600 text-white font-black text-[11px] uppercase">এডমিন লগআউট</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-4 animate-in fade-in duration-500 text-[13px]">
      <div className="bg-indigo-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">মোট দোকান বাকি</p>
        <h1 className="text-3xl font-black">{formatCurrency(summary.grandTotalDebt, currencyCode)}</h1>
        <div className="mt-3 grid grid-cols-4 gap-1 text-center">
          <div className="bg-white/10 p-2 rounded-lg">
            <p className="text-[6px] font-black opacity-60">শেয়ার</p>
            <p className="text-[9px] font-black">{formatCurrency(summary.totalSharedExpense, currencyCode)}</p>
          </div>
          <div className="bg-white/10 p-2 rounded-lg">
            <p className="text-[6px] font-black opacity-60">ব্যক্তিগত</p>
            <p className="text-[9px] font-black">{formatCurrency(summary.totalPersonalExpense, currencyCode)}</p>
          </div>
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <p className="text-[6px] font-black text-emerald-200">জমা</p>
            <p className="text-[9px] font-black">{formatCurrency(summary.totalPayments, currencyCode)}</p>
          </div>
          <div className="bg-amber-500/20 p-2 rounded-lg">
            <p className="text-[6px] font-black text-amber-200">নাস্তা জমা</p>
            <p className="text-[9px] font-black">{formatCurrency(summary.totalBreakfastPayments, currencyCode)}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex gap-3 items-center">
        <span className="text-xl">💡</span>
        <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">{aiInsight}</p>
      </div>
      <div className="grid gap-3">
        {summary.memberBalances.map(mb => (
          <div key={mb.member.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${mb.member.leaveDate ? 'border-slate-200 opacity-75' : 'border-slate-100'} space-y-3 relative overflow-hidden`}>
            {mb.member.leaveDate && <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase">নিষ্ক্রিয়</div>}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={mb.member.avatar} className="w-10 h-10 rounded-full border border-slate-50 bg-slate-100" />
                <span className="font-black text-slate-800 text-[13px]">{mb.member.name}</span>
              </div>
              <div className="text-right">
                <p className={`text-[16px] font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(mb.netBalance, currencyCode)}</p>
                <p className="text-[7px] font-black uppercase text-slate-400">ব্যালেন্স</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-50">
              <div className="bg-indigo-50/50 p-1.5 rounded-xl text-center"><p className="text-[5px] font-black text-indigo-400 uppercase">শেয়ার</p><p className="text-[8px] font-black text-indigo-700">{formatCurrency(mb.sharedShare, currencyCode)}</p></div>
              <div className="bg-rose-50/50 p-1.5 rounded-xl text-center"><p className="text-[5px] font-black text-rose-400 uppercase">ব্যক্তিগত</p><p className="text-[8px] font-black text-rose-700">{formatCurrency(mb.personalTotal, currencyCode)}</p></div>
              <div className="bg-emerald-50/50 p-1.5 rounded-xl text-center"><p className="text-[5px] font-black text-emerald-400 uppercase">জমা</p><p className="text-[8px] font-black text-emerald-700">{formatCurrency(mb.paid, currencyCode)}</p></div>
              <div className="bg-amber-50/50 p-1.5 rounded-xl text-center"><p className="text-[5px] font-black text-amber-500 uppercase">নাস্তা জমা</p><p className="text-[8px] font-black text-amber-700">{formatCurrency(mb.breakfastPaid, currencyCode)}</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!userPhone && !isAdmin) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col justify-center p-6 text-white text-center">
        <h2 className="text-xl font-black mb-6">মেছের হিসাব</h2>
        <form onSubmit={handleAuth} className="space-y-4 max-w-sm mx-auto w-full">
          {!isAdminTab && <input type="tel" placeholder="মোবাইল নাম্বার" className="w-full bg-white/10 border rounded-xl px-5 py-3 font-bold text-center" value={tempPhone} onChange={e => setTempPhone(e.target.value)} />}
          <input type="password" placeholder="পাসওয়ার্ড" className="w-full bg-white/10 border rounded-xl px-5 py-3 font-bold text-center" value={tempPassword} onChange={e => setTempPassword(e.target.value)} />
          <button className="w-full bg-white text-indigo-900 font-black py-4 rounded-xl shadow-xl">প্রবেশ করুন</button>
        </form>
        <button onClick={() => setIsLoginMode(!isLoginMode)} className="mt-4 text-indigo-200 text-sm underline">{isLoginMode ? 'অ্যাকাউন্ট খুলুন' : 'লগইন করুন'}</button>
        <button onClick={() => setIsAdminTab(!isAdminTab)} className="mt-2 text-white/40 text-[10px] font-black uppercase">{isAdminTab ? 'ইউজার লগইন' : 'এডমিন লগইন'}</button>
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-24 px-1">
        {isAdmin && !userPhone && renderAdminView()}
        {userPhone && (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'expenses' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border space-y-4">
                <input type="text" placeholder="বিবরণ" className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold outline-none" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                <input type="number" placeholder="টাকা" className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-black text-lg" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setExpenseType(ExpenseType.SHARED)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>সবার বাজার</button>
                  <button onClick={() => setExpenseType(ExpenseType.PERSONAL)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white' : 'bg-white text-slate-400'}`}>ব্যক্তিগত</button>
                  <button onClick={() => setExpenseType(ExpenseType.PAYMENT)} className={`py-2 rounded-lg border font-black text-[9px] uppercase ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}>জমা</button>
                </div>
                {expenseType !== ExpenseType.SHARED && (
                  <select className="w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold" value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">মেম্বার সিলেক্ট করুন</option>
                    {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <button onClick={addExpense} className="w-full py-4 rounded-xl bg-indigo-700 text-white font-black shadow-lg">সেভ করুন</button>
              </div>
            )}
            {activeTab === 'breakfast' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h2 className="text-lg font-black mb-4 flex items-center gap-2">☕ নাস্তার টাকা জমা</h2>
                  <div className="space-y-3">
                    {activeMembers.map(m => (
                      <div key={m.id} className="bg-slate-50 rounded-2xl p-4 border flex items-center justify-between gap-4">
                        <span className="font-black text-slate-800 text-[12px] truncate">{m.name}</span>
                        <div className="flex gap-2">
                          <input type="number" placeholder="টাকা" className="w-20 bg-white border rounded-xl px-2 py-2 text-xs font-black text-center" value={breakfastInputs[m.id] || ''} onChange={e => setBreakfastInputs(prev => ({ ...prev, [m.id]: e.target.value }))} />
                          <button onClick={() => addBreakfastDeposit(m.id)} className="bg-indigo-600 text-white text-[9px] font-black px-3 py-2 rounded-xl">জমা</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">নাস্তা জমার ইতিহাস</h3>
                    {expenses.some(e => e.description === BREAKFAST_DESC) && (
                      <button onClick={clearAllBreakfast} className="text-[9px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">সব মুছুন</button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {expenses.filter(e => e.description === BREAKFAST_DESC).map(exp => (
                      <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <p className="font-black text-slate-700 text-[11px] truncate">{members.find(m => m.id === exp.targetMemberId)?.name || 'অজানা'}</p>
                          <p className="text-[7px] text-slate-400 font-bold">{new Date(exp.date).toLocaleDateString('bn-BD')} • {new Date(exp.date).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-emerald-600 text-[11px]">{formatCurrency(exp.amount, currencyCode)}</span>
                          <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 p-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1"><h2 className="text-lg font-black">লেনদেন খাতা</h2><button onClick={clearAllExpenses} className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border">সব মুছুন</button></div>
                {expenses.map(exp => (
                  <div key={exp.id} className="bg-white p-3 rounded-xl border flex justify-between items-center shadow-sm">
                    <div><p className="font-black text-[13px]">{exp.description}</p><p className="text-[8px] text-slate-400 font-bold">{new Date(exp.date).toLocaleDateString('bn-BD')}</p></div>
                    <div className="flex items-center gap-3"><span className={`font-black text-[13px] ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(exp.amount, currencyCode)}</span><button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500 p-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'summary' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl p-5 shadow-sm border">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">মেম্বার ম্যানেজমেন্ট</h3>
                  <div className="flex gap-2 mb-4"><input id="member-name-input" type="text" placeholder="নাম" className="flex-1 bg-slate-50 border rounded-xl px-4 py-2 font-bold" /><button onClick={addMember} className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-black text-[10px]">যোগ</button></div>
                  <div className="space-y-3">
                    {activeMembers.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border"><span className="font-black text-slate-800 text-[12px]">{m.name}</span><div className="flex gap-2"><button onClick={() => leaveMember(m.id)} className="text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg text-[8px] font-black">নিষ্ক্রিয়</button><button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></div>
                    ))}
                    {inactiveMembers.map(m => (
                      <div key={m.id} className="flex justify-between items-center p-3 bg-slate-100 rounded-xl border opacity-70"><span className="font-black text-slate-400 text-[12px] line-through">{m.name}</span><button onClick={() => reactivateMember(m.id)} className="text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-lg text-[8px] font-black">সক্রিয়</button></div>
                    ))}
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-rose-50 text-rose-600 font-black text-[11px] border border-rose-100">লগআউট</button>
              </div>
            )}
          </>
        )}
      </div>
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
