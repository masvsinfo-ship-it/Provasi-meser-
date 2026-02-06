
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency, getAutoDetectedCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currencyCode, setCurrencyCode] = useState<string>(() => {
    return localStorage.getItem(`${APP_PREFIX}global_currency`) || getAutoDetectedCurrency();
  });
  
  useEffect(() => {
    if (userPhone) {
      const savedMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const savedExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      setMembers(savedMembers ? JSON.parse(savedMembers) : []);
      setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);
    }
  }, [userPhone]);

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
    if (tempPhone.length < 10 || tempPassword.length < 4) {
      showToast("সঠিক তথ্য দিন (পাসওয়ার্ড ৪ অক্ষর)", "error");
      return;
    }
    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};

    if (isLoginMode) {
      if (users[tempPhone] && users[tempPhone] === tempPassword) {
        localStorage.setItem('logged_in_phone', tempPhone);
        setUserPhone(tempPhone);
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
        setUserPhone(tempPhone);
        showToast("রেজিস্ট্রেশন সফল!");
      }
    }
  };

  const handleLogout = () => {
    if (window.confirm("লগআউট করতে চান?")) {
      localStorage.removeItem('logged_in_phone');
      setUserPhone(null);
      setActiveTab('dashboard');
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
    if (!tempPhone) return; // safety
    const nameInput = (document.getElementById('member-name-input') as HTMLInputElement)?.value;
    if (!nameInput?.trim()) return;
    
    const newMember: Member = {
      id: Date.now().toString(),
      name: nameInput.trim(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(nameInput)}`,
      joinDate: Date.now(),
    };
    const updated = [...members, newMember];
    setMembers(updated);
    (document.getElementById('member-name-input') as HTMLInputElement).value = '';
    showToast(`${newMember.name} যোগ হয়েছে`);
    saveToDisk(updated, expenses);
  };

  const deleteMemberRecord = (id: string) => {
    if (window.confirm("আপনি কি নিশ্চিতভাবে এই মেম্বারকে ডিলিট করতে চান? তার সকল ডাটা চিরতরে মুছে যাবে।")) {
      const updatedMembers = members.filter(m => m.id !== id);
      const updatedExpenses = expenses.filter(e => e.targetMemberId !== id);
      setMembers(updatedMembers);
      setExpenses(updatedExpenses);
      saveToDisk(updatedMembers, updatedExpenses);
      showToast("মেম্বার রেকর্ড ডিলিট করা হয়েছে", "error");
    }
  };

  const leaveMember = (id: string) => {
    if (window.confirm("এই মেম্বার কি মেছ ছেড়ে দিচ্ছেন? তার হিসাব আর নতুন বাজারের সাথে যোগ হবে না।")) {
      const updated = members.map(m => m.id === id ? { ...m, leaveDate: Date.now() } : m);
      setMembers(updated);
      saveToDisk(updated, expenses);
      showToast("মেম্বারকে নিষ্ক্রিয় করা হয়েছে", "warning");
    }
  };

  const rejoinMember = (id: string) => {
    const updated = members.map(m => m.id === id ? { ...m, leaveDate: undefined } : m);
    setMembers(updated);
    saveToDisk(updated, expenses);
    showToast("মেম্বার পুনরায় সক্রিয়");
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

  const deleteExpense = (id: string) => {
    if (window.confirm("লেনদেনটি ডিলিট করতে চান?")) {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      saveToDisk(members, updated);
      showToast("ডিলিট করা হয়েছে", "warning");
    }
  };

  const activeMembers = members.filter(m => !m.leaveDate);
  const leftMembers = members.filter(m => m.leaveDate);

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-16 -translate-y-16 blur-2xl"></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">মোট দোকান বাকি</p>
          <h1 className="text-4xl font-black">{formatCurrency(summary.grandTotalDebt, currencyCode)}</h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white/10 p-2 rounded-xl">
              <p className="text-[8px] text-white/60 font-black uppercase">সবার বাজার</p>
              <p className="text-xs font-black">{formatCurrency(summary.totalSharedExpense, currencyCode)}</p>
            </div>
            <div className="bg-white/10 p-2 rounded-xl">
              <p className="text-[8px] text-white/60 font-black uppercase">ব্যক্তিগত</p>
              <p className="text-xs font-black">{formatCurrency(summary.totalPersonalExpense, currencyCode)}</p>
            </div>
            <div className="bg-emerald-500/20 p-2 rounded-xl">
              <p className="text-[8px] text-emerald-200 font-black uppercase">মোট জমা</p>
              <p className="text-xs font-black">{formatCurrency(summary.totalPayments, currencyCode)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-center">
        <span className="text-2xl">💡</span>
        <p className="text-xs text-slate-600 font-medium italic leading-relaxed">{aiInsight}</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-slate-900 px-2 uppercase text-[10px] tracking-widest flex justify-between">
          <span>মেম্বার ভিত্তিক হিসাব</span>
          <span className="text-slate-400">কারেন্সি: {currencyCode}</span>
        </h3>
        <div className="grid gap-4">
          {summary.memberBalances.map((mb) => (
            <div key={mb.member.id} className={`bg-white rounded-3xl p-5 shadow-sm border ${mb.member.leaveDate ? 'border-slate-200 opacity-75' : 'border-slate-100'} space-y-4 relative overflow-hidden`}>
              {mb.member.leaveDate && (
                <div className="absolute top-0 right-0 bg-slate-200 text-slate-600 text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase">প্রাক্তন</div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={mb.member.avatar} className="w-12 h-12 rounded-full border-2 border-slate-50 bg-slate-100" />
                  <div>
                    <span className="font-black text-slate-800 text-lg">{mb.member.name}</span>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{mb.member.leaveDate ? 'হিসাব বন্ধ' : 'সক্রিয় খাতা'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(mb.netBalance, currencyCode)}
                  </p>
                  <p className="text-[8px] font-black uppercase text-slate-400">নিট ব্যালেন্স</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-50">
                <div className="bg-indigo-50/50 p-2 rounded-2xl text-center">
                  <p className="text-[7px] font-black text-indigo-400 uppercase mb-1">শেয়ার</p>
                  <p className="text-xs font-black text-indigo-700">{formatCurrency(mb.sharedShare, currencyCode)}</p>
                </div>
                <div className="bg-rose-50/50 p-2 rounded-2xl text-center">
                  <p className="text-[7px] font-black text-rose-400 uppercase mb-1">ব্যক্তিগত</p>
                  <p className="text-xs font-black text-rose-700">{formatCurrency(mb.personalTotal, currencyCode)}</p>
                </div>
                <div className="bg-emerald-50/50 p-2 rounded-2xl text-center">
                  <p className="text-[7px] font-black text-emerald-400 uppercase mb-1">মোট জমা</p>
                  <p className="text-xs font-black text-emerald-700">{formatCurrency(mb.paid, currencyCode)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (!userPhone) {
    return (
      <div className="min-h-screen bg-indigo-800 flex flex-col justify-center p-6 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 space-y-8 max-w-sm mx-auto w-full">
          <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-2xl rotate-3 mb-4">🏪</div>
          <h1 className="text-3xl font-black tracking-tight">{isLoginMode ? 'লগইন' : 'নতুন মেছ'}</h1>
          <form onSubmit={handleAuth} className="space-y-3">
            <input type="tel" placeholder="মোবাইল নাম্বার" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold outline-none text-center focus:bg-white focus:text-indigo-900 transition-all" value={tempPhone} onChange={e => setTempPhone(e.target.value)} />
            <input type="password" placeholder="পাসওয়ার্ড" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold outline-none text-center focus:bg-white focus:text-indigo-900 transition-all" value={tempPassword} onChange={e => setTempPassword(e.target.value)} />
            <button className="w-full bg-white text-indigo-800 font-black py-4 rounded-2xl text-lg shadow-xl active:scale-95 transition-all">{isLoginMode ? 'প্রবেশ করুন' : 'অ্যাকাউন্ট খুলুন'}</button>
          </form>
          <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-indigo-200 font-bold underline decoration-2 underline-offset-4">{isLoginMode ? 'নতুন মেছ? অ্যাকাউন্ট খুলুন' : 'আগের মেছ? লগইন করুন'}</button>
          
          {/* Developer & Help Line Section */}
          <div className="pt-8 border-t border-white/10 space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Developer</p>
              <a href="https://fb.com/billal8795" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-5 py-3 rounded-2xl border border-white/10 transition-all group">
                <svg className="w-6 h-6 fill-current text-white group-hover:text-blue-400" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                <span className="font-bold text-sm">fb.com/billal8795</span>
              </a>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Help Line</p>
              <a href="https://wa.me/8801735308795" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 px-5 py-3 rounded-2xl border border-white/10 transition-all group">
                <svg className="w-6 h-6 fill-current text-white group-hover:text-emerald-400" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.7 17.8 69.4 27.2 106.2 27.2 122.4 0 222-99.6 222-222 0-59.3-23-115.1-65-117.1zM223.9 445.3c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 365.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.7-186.6 184.7zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.2-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.4-11.3 2.5-2.4 5.5-6.5 8.3-9.8 2.8-3.2 3.7-5.5 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.7 23.5 9.2 31.6 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                <span className="font-bold text-sm">+8801735308795</span>
              </a>
            </div>
            
            <p className="text-[10px] text-white/30 tracking-[0.3em] font-black pt-4 uppercase">Developed for expatriates</p>
          </div>
        </div>
        {toast && (
          <div className={`fixed bottom-10 left-6 right-6 z-50 p-4 rounded-2xl text-center font-bold text-sm bg-rose-500 shadow-2xl animate-in slide-in-from-bottom-4`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-24">
        {activeTab === 'dashboard' && renderDashboard()}
        
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black text-center mb-6 text-slate-900">নতুন এন্ট্রি যোগ করুন</h2>
              <div className="space-y-5">
                <input type="text" placeholder="খরচের বিবরণ" className="w-full bg-slate-50 border rounded-2xl px-5 py-3 font-bold" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} />
                <input type="number" placeholder="টাকার পরিমাণ" className="w-full bg-slate-50 border rounded-2xl px-5 py-3 font-black text-xl" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setExpenseType(ExpenseType.SHARED)} className={`py-3 rounded-xl border-2 font-black text-[10px] ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>সবার বাজার</button>
                  <button onClick={() => setExpenseType(ExpenseType.PERSONAL)} className={`py-3 rounded-xl border-2 font-black text-[10px] ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white' : 'bg-white text-slate-400'}`}>ব্যক্তিগত বাকি</button>
                  <button onClick={() => setExpenseType(ExpenseType.PAYMENT)} className={`py-3 rounded-xl border-2 font-black text-[10px] ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}>টাকা জমা</button>
                </div>
                {expenseType !== ExpenseType.SHARED && (
                  <select className="w-full bg-slate-50 border rounded-2xl px-5 py-3 font-bold" value={targetId} onChange={e => setTargetId(e.target.value)}>
                    <option value="">মেম্বার সিলেক্ট করুন...</option>
                    {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    {leftMembers.length > 0 && <optgroup label="প্রাক্তন মেম্বার">
                        {leftMembers.map(m => <option key={m.id} value={m.id}>{m.name} (প্রাক্তন)</option>)}
                    </optgroup>}
                  </select>
                )}
                <button onClick={addExpense} className="w-full bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-lg">সেভ করুন</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black px-2 text-slate-900">লেনদেন খাতা</h2>
            {expenses.map(exp => (
              <div key={exp.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm">
                <div>
                  <p className="font-black text-slate-800 text-sm">{exp.description}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                    {exp.type === ExpenseType.SHARED ? 'সবার বাজার' : members.find(m => m.id === exp.targetMemberId)?.name || 'অজানা'} • {new Date(exp.date).toLocaleDateString('bn-BD')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-black ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {exp.type === ExpenseType.PAYMENT ? '+' : '-'}{formatCurrency(exp.amount, currencyCode)}
                  </span>
                  <button onClick={() => deleteExpense(exp.id)} className="text-slate-300 hover:text-rose-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-900 mb-4">কারেন্সি সেটিংস</h3>
              <select className="w-full bg-slate-50 border rounded-2xl px-5 py-3 font-bold" value={currencyCode} onChange={(e) => {setCurrencyCode(e.target.value); localStorage.setItem(`${APP_PREFIX}global_currency`, e.target.value);}}>
                <option value="BDT">৳ BDT</option><option value="SAR">SR SAR</option><option value="AED">DH AED</option>
                <option value="QAR">QR QAR</option><option value="KWD">KD KWD</option><option value="USD">$ USD</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-900 mb-4">মেম্বার ম্যানেজমেন্ট</h3>
              <div className="flex gap-2 mb-6">
                <input id="member-name-input" type="text" placeholder="মেম্বারের নাম" className="flex-1 bg-slate-50 border rounded-2xl px-5 py-3 font-bold" />
                <button onClick={addMember} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">যোগ</button>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-indigo-500 uppercase px-1">চলমান মেম্বার</p>
                  {activeMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
                      <span className="font-black text-slate-800">{m.name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => leaveMember(m.id)} className="text-amber-600 bg-amber-50 px-3 py-2 rounded-xl text-[10px] font-black">মেছ ছেড়েছেন</button>
                        <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-400 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </div>
                  ))}
                </div>
                {leftMembers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase px-1">প্রাক্তন মেম্বার</p>
                    {leftMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-4 bg-slate-100 rounded-2xl border opacity-70">
                        <span className="font-black text-slate-500">{m.name}</span>
                        <div className="flex gap-2">
                          <button onClick={() => rejoinMember(m.id)} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl text-[10px] font-black">পুনরায় যোগ</button>
                          <button onClick={() => deleteMemberRecord(m.id)} className="text-rose-300 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleLogout} className="w-full py-5 rounded-2xl bg-rose-50 text-rose-600 font-black text-xs uppercase border border-rose-100">লগআউট (Logout)</button>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'}`}>
          <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
