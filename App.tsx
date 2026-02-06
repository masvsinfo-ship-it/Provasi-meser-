
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';
const DEBT_LIMIT = 300;
const ADMIN_PASSWORD = "8795";

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  useEffect(() => {
    if (userPhone) {
      const savedMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const savedExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      setMembers(savedMembers ? JSON.parse(savedMembers) : []);
      setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);
    }
  }, [userPhone]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = tempPhone.trim();
    const pass = tempPassword.trim();

    if (phone.length < 10 || pass.length < 4) {
      showToast("সঠিক মোবাইল নাম্বার ও পাসওয়ার্ড দিন", "error");
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');

    if (isLoginMode) {
      if (storedUsers[phone] && storedUsers[phone] === pass) {
        localStorage.setItem('logged_in_phone', phone);
        setUserPhone(phone);
        showToast("সফলভাবে লগইন হয়েছে!");
      } else {
        showToast("ভুল নাম্বার বা পাসওয়ার্ড!", "error");
      }
    } else {
      if (storedUsers[phone]) {
        showToast("এই নাম্বারটি আগে থেকেই আছে", "error");
      } else {
        storedUsers[phone] = pass;
        localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));
        localStorage.setItem('logged_in_phone', phone);
        setUserPhone(phone);
        showToast("অ্যাকাউন্ট তৈরি সফল হয়েছে!");
      }
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASSWORD) {
      setIsAdminLoggedIn(true);
      showToast("অ্যাডমিন লগইন সফল!");
    } else {
      showToast("ভুল অ্যাডমিন পাসওয়ার্ড!", "error");
    }
  };

  const handleLogout = () => {
    if (window.confirm("আপনি কি লগআউট করতে চান?")) {
      localStorage.removeItem('logged_in_phone');
      setUserPhone(null);
      setIsAdminLoggedIn(false);
      setIsAdminMode(false);
      setAdminPassInput('');
      setTempPhone('');
      setTempPassword('');
      setActiveTab('dashboard');
    }
  };

  const maskPhone = (phone: string) => {
    if (phone.length < 10) return phone;
    return `${phone.substring(0, 3)}***${phone.substring(phone.length - 4)}`;
  };

  useEffect(() => {
    if (userPhone && !isAdminLoggedIn) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(`${APP_PREFIX}${userPhone}_members`, JSON.stringify(members));
          localStorage.setItem(`${APP_PREFIX}${userPhone}_expenses`, JSON.stringify(expenses));
          setSaveStatus('saved');
        } catch (e) {
          setSaveStatus('error');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [members, expenses, userPhone, isAdminLoggedIn]);

  const summary = useMemo(() => calculateMessSummary(members, expenses), [members, expenses]);

  const groupedExpenses = useMemo(() => {
    const groups: { [key: string]: { monthName: string, expenses: Expense[], total: number } } = {};
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[key]) {
        const monthName = new Intl.DateTimeFormat('bn-BD', { month: 'long', year: 'numeric' }).format(date);
        groups[key] = { monthName, expenses: [], total: 0 };
      }
      groups[key].expenses.push(exp);
      groups[key].total += exp.amount;
    });
    return Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(key => groups[key]);
  }, [expenses]);

  const [aiInsight, setAiInsight] = useState<string>('বিশ্লেষণ করছি...');
  useEffect(() => {
    const fetchInsight = async () => {
      if (expenses.length > 0 && userPhone) {
        const insight = await geminiService.getSmartInsight(summary);
        setAiInsight(insight);
      } else {
        setAiInsight("দোকানের বাকি হিসাব এখানে যোগ করুন। আমি আপনাকে সাহায্য করবো। 😊");
      }
    };
    fetchInsight();
  }, [summary, expenses.length, userPhone]);

  const [newMemberName, setNewMemberName] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(ExpenseType.SHARED);
  const [targetId, setTargetId] = useState('');

  const activeMembers = useMemo(() => members.filter(m => !m.leaveDate), [members]);

  const addMember = () => {
    if (!newMemberName.trim()) return;
    const now = Date.now();
    const newMember: Member = {
      id: now.toString(),
      name: newMemberName,
      avatar: `https://picsum.photos/seed/${newMemberName}/100`,
      joinDate: now,
    };
    setMembers([...members, newMember]);
    setNewMemberName('');
    showToast(`${newMemberName} যোগ হয়েছে`);
  };

  const startEditMember = (member: Member) => {
    setEditingMemberId(member.id);
    setEditNameValue(member.name);
  };

  const saveMemberName = () => {
    if (!editNameValue.trim()) return;
    setMembers(members.map(m => m.id === editingMemberId ? { ...m, name: editNameValue.trim() } : m));
    setEditingMemberId(null);
    showToast("নাম পরিবর্তন সফল");
  };

  const deleteMember = (id: string) => {
    if (window.confirm("মেম্বার ডিলিট করলে সব রেকর্ড মুছে যাবে। নিশ্চিত?")) {
      setMembers(members.filter(m => m.id !== id));
      setExpenses(expenses.filter(e => e.targetMemberId !== id));
      showToast("মেম্বার মুছে ফেলা হয়েছে", "error");
    }
  };

  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amount)) {
      showToast("সব তথ্য দিন", "error");
      return;
    }
    if ((expenseType === ExpenseType.PERSONAL || expenseType === ExpenseType.PAYMENT) && !targetId) {
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
    setExpenses([newExpense, ...expenses]);
    setExpenseDesc('');
    setExpenseAmount('');
    showToast(expenseType === ExpenseType.PAYMENT ? "জমা সফল!" : "বাকি সেভ হয়েছে!");
    setActiveTab('dashboard');
  };

  const deleteExpense = (id: string) => {
    if (window.confirm("ডিলিট করতে চান?")) {
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("ডিলিট করা হয়েছে", "error");
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-slate-900 font-black text-2xl tracking-tight">বাকি ড্যাশবোর্ড</h2>
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">ব্যাচেলরদের মেস হিসাব</p>
        </div>
        {!isAdminLoggedIn && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200/60 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-black text-slate-500 uppercase">Auto Sync</span>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full translate-x-20 -translate-y-20 blur-3xl"></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-2 opacity-80">মোট দোকান বাকি (নিট)</p>
          <h1 className="text-5xl font-black tracking-tighter">{formatCurrency(summary.grandTotalDebt)}</h1>
          
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
              <p className="text-[8px] text-indigo-200 font-black uppercase mb-1">সবার বাজার</p>
              <p className="text-sm font-black">{formatCurrency(summary.totalSharedExpense)}</p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
              <p className="text-[8px] text-indigo-200 font-black uppercase mb-1">ব্যক্তিগত</p>
              <p className="text-sm font-black">{formatCurrency(summary.totalPersonalExpense)}</p>
            </div>
            <div className="bg-emerald-400/20 p-3 rounded-2xl border border-emerald-400/10 backdrop-blur-md">
              <p className="text-[8px] text-emerald-200 font-black uppercase mb-1">মোট জমা</p>
              <p className="text-sm font-black text-emerald-300">{formatCurrency(summary.totalPayments)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex gap-4 items-center">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl">💡</div>
        <p className="text-xs text-slate-600 font-bold leading-relaxed">{aiInsight}</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-slate-900 px-2 text-lg">মেম্বার দেনার তালিকা</h3>
        {summary.memberBalances.map((mb) => {
          const isOver = mb.netBalance < -DEBT_LIMIT;
          const hasSurplus = mb.netBalance > 0;
          return (
            <div key={mb.member.id} className={`bg-white rounded-[2.5rem] border p-6 transition-all ${isOver ? 'border-rose-200 bg-rose-50/10' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={mb.member.avatar} className="w-12 h-12 rounded-2xl object-cover border border-slate-100" />
                  <div>
                    <p className="font-black text-slate-800">{mb.member.name}</p>
                    <p className={`text-[9px] font-black uppercase tracking-tighter ${hasSurplus ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {hasSurplus ? 'অতিরিক্ত জমা' : 'নিট দেনা'}
                    </p>
                  </div>
                </div>
                <p className={`text-xl font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(mb.netBalance)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAdminDashboard = () => {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    const userEntries = Object.entries(users);

    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white max-w-md mx-auto flex flex-col">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-black">অ্যাডমিন প্যানেল</h1>
          <button onClick={() => { setIsAdminLoggedIn(false); setIsAdminMode(false); }} className="p-3 bg-white/10 rounded-2xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-4">
          {userEntries.map(([phone]) => (
            <div key={phone} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex justify-between items-center">
              <div>
                <p className="text-xl font-black">{maskPhone(phone)}</p>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">নিবন্ধিত ইউজার</p>
              </div>
              <button onClick={() => { setUserPhone(phone); setIsAdminLoggedIn(false); setIsAdminMode(false); }} className="bg-indigo-600 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">লোড করুন</button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isAdminLoggedIn) return renderAdminDashboard();

  if (!userPhone) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col justify-center p-8 text-white max-w-md mx-auto relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 text-center space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-white rounded-[2rem] mx-auto flex items-center justify-center text-5xl shadow-2xl rotate-3">🏪</div>
          
          {isAdminMode ? (
            <div className="space-y-6">
              <h1 className="text-3xl font-black">অ্যাডমিন প্রবেশ</h1>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <input type="password" placeholder="সিকিউরিটি পিন দিন" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-2xl font-black text-center outline-none focus:bg-white focus:text-indigo-900" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} autoFocus />
                <button className="w-full bg-white text-indigo-900 font-black py-4 rounded-2xl text-xl shadow-xl">প্রবেশ করুন</button>
              </form>
              <button onClick={() => setIsAdminMode(false)} className="text-indigo-200 text-xs font-bold uppercase tracking-widest">ইউজার লগইনে ফিরুন</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight">{isLoginMode ? 'লগইন' : 'রেজিস্ট্রেশন'}</h1>
                <p className="text-indigo-200 text-sm font-black uppercase tracking-widest">ব্যাচেলরদের মেস হিসাব</p>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <input type="tel" placeholder="মোবাইল নাম্বার" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-black text-center placeholder:text-white/20 outline-none focus:bg-white focus:text-indigo-900" value={tempPhone} onChange={(e) => setTempPhone(e.target.value)} />
                <input type="password" placeholder="পাসওয়ার্ড" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-black text-center placeholder:text-white/20 outline-none focus:bg-white focus:text-indigo-900" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
                <button className="w-full bg-white text-indigo-900 font-black py-4 rounded-2xl text-xl shadow-xl active:scale-95 transition-all">
                  {isLoginMode ? 'প্রবেশ করুন' : 'অ্যাকাউন্ট খুলুন'}
                </button>
              </form>
              <div className="flex flex-col gap-8">
                <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-white font-black text-xs uppercase tracking-widest underline underline-offset-8 decoration-2 decoration-indigo-300/50">
                  {isLoginMode ? 'নতুন মেছ? রেজিস্ট্রেশন করুন' : 'আগের অ্যাকাউন্ট? লগইন করুন'}
                </button>
                <button onClick={() => setIsAdminMode(true)} className="text-[9px] font-black text-white/30 hover:text-white/60 uppercase tracking-[0.4em] bg-white/5 px-6 py-2 rounded-full border border-white/5 transition-all">অ্যাডমিন লগইন</button>
              </div>

              {/* Enhanced Footer Section */}
              <div className="pt-16 border-t border-white/10 space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">App Developer</p>
                <div className="flex justify-center gap-12">
                  <a href="https://fb.com/billal8795" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 transition-all border border-white/5 shadow-lg group-hover:scale-110">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                    </div>
                  </a>
                  <a href="https://wa.me/8801735308795" target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center gap-2">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-all border border-white/5 shadow-lg group-hover:scale-110">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 448 512"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.7 17.8 69.4 27.2 106.2 27.2 122.4 0 222-99.6 222-222 0-59.3-23-115.1-65-117.1zM223.9 445.3c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 365.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.7-186.6 184.7zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-5.5-2.8-23.2-8.5-44.2-27.2-16.4-14.6-27.4-32.7-30.6-38.2-3.2-5.6-.3-8.6 2.4-11.3 2.5-2.4 5.5-6.5 8.3-9.8 2.8-3.2 3.7-5.5 5.5-9.3 1.9-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 13.2 5.7 23.5 9.2 31.6 11.8 13.3 4.2 25.4 3.6 35 2.2 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                    </div>
                  </a>
                </div>
                <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.6em]">+8801735308795</p>
              </div>
            </>
          )}
        </div>
        {toast && <div className={`fixed bottom-10 left-6 right-6 z-50 p-5 rounded-3xl text-center font-black text-sm shadow-2xl backdrop-blur-md ${toast.type === 'error' ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'}`}>{toast.message}</div>}
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-20 overflow-x-hidden">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black text-slate-900 mb-8 text-center tracking-tight">নতুন লেনদেন যোগ</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">বিবরণ</label>
                  <input type="text" placeholder="কি কেনা হয়েছে?" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none focus:border-indigo-500" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">টাকা</label>
                  <input type="number" placeholder="0.00" className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-black text-3xl outline-none ${expenseType === ExpenseType.PAYMENT ? 'text-emerald-600 focus:border-emerald-500' : 'text-rose-600 focus:border-indigo-500'}`} value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setExpenseType(ExpenseType.SHARED)} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}><span className="text-xl">🍛</span><span className="text-[8px] font-black uppercase">সবার বাজার</span></button>
                  <button onClick={() => setExpenseType(ExpenseType.PERSONAL)} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-400 border-slate-100'}`}><span className="text-xl">👤</span><span className="text-[8px] font-black uppercase">ব্যক্তিগত</span></button>
                  <button onClick={() => setExpenseType(ExpenseType.PAYMENT)} className={`py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-100'}`}><span className="text-xl">💵</span><span className="text-[8px] font-black uppercase">টাকা জমা</span></button>
                </div>
                {(expenseType === ExpenseType.PERSONAL || expenseType === ExpenseType.PAYMENT) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-3 gap-2">
                    {activeMembers.map(m => (
                      <button key={m.id} onClick={() => setTargetId(m.id)} className={`p-2 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center ${targetId === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-100'}`}>
                        <img src={m.avatar} className="w-6 h-6 rounded-lg mb-1" />
                        <span className="truncate w-full text-center">{m.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={addExpense} className={`w-full font-black py-5 rounded-[1.5rem] shadow-xl text-xl active:scale-95 transition-all ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white' : 'bg-indigo-700 text-white'}`}>সেভ করুন</button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-black text-slate-900 px-3 tracking-tight">লেনদেন লগ</h2>
            {groupedExpenses.map((group) => (
              <div key={group.monthName} className="space-y-3">
                <div className="flex justify-between items-center px-4 sticky top-[110px] bg-slate-50/90 py-3 z-10 border-b border-slate-200/50">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">{group.monthName}</span>
                </div>
                <div className="space-y-3 px-1">
                  {group.expenses.map(exp => (
                    <div key={exp.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 flex justify-between items-center">
                      <div className="flex gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : exp.type === ExpenseType.PAYMENT ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                          {exp.type === ExpenseType.SHARED ? '🍛' : exp.type === ExpenseType.PAYMENT ? '💵' : '👤'}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm leading-tight">{exp.description}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase mt-1 tracking-tighter">
                            {new Date(exp.date).toLocaleDateString('bn-BD')} • {exp.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-black tabular-nums ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(exp.amount)}</p>
                        <button onClick={() => deleteExpense(exp.id)} className="text-rose-200 p-1 hover:text-rose-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'summary' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100">
              <h3 className="font-black text-slate-900 mb-6 text-xl tracking-tight">মেম্বার ম্যানেজমেন্ট</h3>
              <div className="flex gap-3 mb-8">
                <input type="text" placeholder="মেম্বারের নাম" className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold outline-none" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
                <button onClick={addMember} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg">যোগ</button>
              </div>
              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <img src={m.avatar} className="w-10 h-10 rounded-xl" />
                      {editingMemberId === m.id ? (
                        <div className="flex gap-2"><input autoFocus className="bg-white border rounded px-2 py-1 font-bold" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} /><button onClick={saveMemberName} className="p-1 bg-indigo-600 text-white rounded">✓</button></div>
                      ) : (
                        <span className="font-black text-slate-800">{m.name}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!editingMemberId && <button onClick={() => startEditMember(m)} className="text-slate-300">✎</button>}
                      <button onClick={() => deleteMember(m.id)} className="text-rose-300">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleLogout} className="w-full py-5 rounded-3xl bg-rose-50 text-rose-600 font-black text-xs tracking-widest uppercase border border-rose-100">লগআউট (Logout)</button>
          </div>
        )}
      </div>
      {toast && <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-8 duration-500 ${toast.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}><div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]"></div><p className="text-sm font-black uppercase tracking-widest">{toast.message}</p></div>}
    </Layout>
  );
};

export default App;
