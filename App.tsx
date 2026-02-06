
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';
const DEBT_LIMIT = 300; // Threshold for warning
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

  // Fetch data when logged in phone changes
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
    if (tempPhone.length < 10 || tempPassword.length < 4) {
      showToast("সঠিক নাম্বার ও পাসওয়ার্ড (ন্যূনতম ৪ অক্ষর) দিন", "error");
      return;
    }

    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};

    if (isLoginMode) {
      if (users[tempPhone] && users[tempPhone] === tempPassword) {
        localStorage.setItem('logged_in_phone', tempPhone);
        setUserPhone(tempPhone);
        showToast("সফলভাবে লগইন হয়েছে!");
      } else {
        showToast("ভুল মোবাইল নাম্বার বা পাসওয়ার্ড!", "error");
      }
    } else {
      if (users[tempPhone]) {
        showToast("এই নাম্বারটি আগে থেকেই নিবন্ধিত", "error");
      } else {
        users[tempPhone] = tempPassword;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        localStorage.setItem('logged_in_phone', tempPhone);
        setUserPhone(tempPhone);
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

  // Auto-save logic
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
        setAiInsight("দোকানের বাকি হিসাব এখানে যোগ করুন। আমি আপনাকে খরচ নিয়ন্ত্রণে সাহায্য করবো। 😊");
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
    showToast("নাম পরিবর্তন করা হয়েছে");
  };

  const deleteMember = (id: string) => {
    if (window.confirm("এই মেম্বারকে ডিলিট করলে তার সব রেকর্ড মুছে যাবে। নিশ্চিত?")) {
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
    showToast(expenseType === ExpenseType.PAYMENT ? "টাকা জমা সেভ হয়েছে!" : "বাকি বাজার সেভ হয়েছে!");
    setActiveTab('dashboard');
  };

  const deleteExpense = (id: string) => {
    if (window.confirm("আপনি কি এই হিসাবটি ডিলিট করতে চান?")) {
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("হিসাবটি ডিলিট করা হয়েছে", "error");
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-slate-900 font-black text-2xl">বাকি ড্যাশবোর্ড</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">প্রবাসী মেস হিসাব</p>
        </div>
        {!isAdminLoggedIn && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-black text-slate-500">Auto Saved</span>
          </div>
        )}
      </div>

      <div className="bg-indigo-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-16 -translate-y-16 blur-2xl"></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">মোট দোকান বাকি (নিট)</p>
          <h1 className="text-4xl font-black">{formatCurrency(summary.grandTotalDebt)}</h1>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white/10 p-2 rounded-xl border border-white/5">
              <p className="text-[8px] text-white/60 font-black uppercase tracking-tighter">সবার বাজার</p>
              <p className="text-xs font-black">{formatCurrency(summary.totalSharedExpense)}</p>
            </div>
            <div className="bg-white/10 p-2 rounded-xl border border-white/5">
              <p className="text-[8px] text-white/60 font-black uppercase tracking-tighter">ব্যক্তিগত</p>
              <p className="text-xs font-black">{formatCurrency(summary.totalPersonalExpense)}</p>
            </div>
            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/10">
              <p className="text-[8px] text-emerald-200 font-black uppercase tracking-tighter">মোট জমা</p>
              <p className="text-xs font-black text-emerald-300">{formatCurrency(summary.totalPayments)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 items-center">
        <span className="text-2xl">💡</span>
        <p className="text-xs text-slate-600 font-medium leading-relaxed italic">{aiInsight}</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-black text-slate-900 px-2 flex justify-between items-center">
          মেম্বার দেনার হিসাব
          <span className="text-[10px] text-rose-500 font-black uppercase tracking-tighter">Limit: {formatCurrency(DEBT_LIMIT)}</span>
        </h3>
        
        {summary.memberBalances.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-slate-100 text-slate-400 font-bold">
            কোন মেম্বার পাওয়া যায়নি। হিসাব ট্যাব থেকে মেম্বার যোগ করুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {summary.memberBalances.map((mb) => {
              const isOver = mb.netBalance < -DEBT_LIMIT;
              const hasSurplus = mb.netBalance > 0;
              return (
                <div key={mb.member.id} className={`bg-white rounded-2xl border-2 p-4 transition-all shadow-sm ${isOver ? 'border-rose-200 bg-rose-50/20' : hasSurplus ? 'border-emerald-100 bg-emerald-50/10' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img src={mb.member.avatar} className="w-10 h-10 rounded-full border-2 border-slate-100" />
                      <div>
                        <p className="font-black text-slate-800 flex items-center gap-2">
                          {mb.member.name}
                          {isOver && <span className="bg-rose-500 text-[8px] text-white px-2 py-0.5 rounded-full animate-pulse uppercase">Attention</span>}
                        </p>
                        <p className={`text-[9px] font-black uppercase ${hasSurplus ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {hasSurplus ? 'অতিরিক্ত জমা আছে' : 'মেম্বার বাকি (নিট)'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${mb.netBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(mb.netBalance)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                    <div className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                      <p className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter mb-1">বাজার শেয়ার</p>
                      <p className="text-[10px] font-black text-slate-700">{formatCurrency(mb.sharedShare)}</p>
                    </div>
                    <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100">
                      <p className="text-[7px] font-black text-rose-400 uppercase tracking-tighter mb-1">ব্যক্তিগত বাকি</p>
                      <p className="text-[10px] font-black text-slate-700">{formatCurrency(mb.personalTotal)}</p>
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                      <p className="text-[7px] font-black text-emerald-400 uppercase tracking-tighter mb-1">মেম্বার জমা</p>
                      <p className="text-[10px] font-black text-slate-700">{formatCurrency(mb.paid)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderAdminDashboard = () => {
    const storedUsersRaw = localStorage.getItem(USERS_KEY);
    const users = storedUsersRaw ? JSON.parse(storedUsersRaw) : {};
    const userEntries = Object.entries(users);

    const getUserStats = (phone: string) => {
      const m = JSON.parse(localStorage.getItem(`${APP_PREFIX}${phone}_members`) || '[]');
      const e = JSON.parse(localStorage.getItem(`${APP_PREFIX}${phone}_expenses`) || '[]');
      const s = calculateMessSummary(m, e);
      return s;
    };

    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white max-w-md mx-auto flex flex-col">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-2xl font-black">অ্যাডমিন কন্ট্রোল</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Master Overview</p>
          </div>
          <button 
            onClick={() => { setIsAdminLoggedIn(false); setIsAdminMode(false); }} 
            className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">নিবন্ধিত মেস তালিকা ({userEntries.length})</p>
          {userEntries.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-10 text-center text-slate-500 font-bold border-2 border-dashed border-white/5">কোন ইউজার নেই।</div>
          ) : (
            userEntries.map(([phone, pass]) => {
              const userSummary = getUserStats(phone);
              return (
                <div key={phone} className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 font-black text-xs">#</div>
                        <span className="text-xl font-black text-white">{phone}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-slate-500 text-[10px] font-black uppercase">পাসওয়ার্ড:</span>
                        <span className="text-amber-400 font-mono text-sm tracking-widest font-black">••••••</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setUserPhone(phone);
                        setIsAdminLoggedIn(false);
                        setIsAdminMode(false);
                        showToast(`হিসাব লোড হচ্ছে: ${phone}`);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-lg transition-all"
                    >
                      হিসাব দেখুন
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                    <div className="bg-white/5 p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">দোকান বাকি</p>
                      <p className="text-sm font-black text-rose-400">{formatCurrency(userSummary.grandTotalDebt)}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">মোট মেম্বার</p>
                      <p className="text-sm font-black text-indigo-400">{userSummary.memberBalances.length} জন</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <p className="mt-auto text-center text-slate-600 text-[8px] font-black uppercase tracking-[0.5em] pt-20">বিল্লাল জামালপুর - Admin Panel v3.1</p>
      </div>
    );
  };

  if (isAdminLoggedIn) {
    return renderAdminDashboard();
  }

  if (!userPhone) {
    return (
      <div className="min-h-screen bg-indigo-800 flex flex-col justify-center p-6 text-white max-w-md mx-auto relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center text-5xl shadow-2xl rotate-3">🏪</div>
          
          {isAdminMode ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              <h1 className="text-3xl font-black">অ্যাডমিন প্রবেশ</h1>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <input 
                  type="password" 
                  placeholder="সিকিউরিটি পিন দিন" 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-xl font-bold text-center outline-none focus:bg-white focus:text-indigo-900 transition-all"
                  value={adminPassInput}
                  onChange={(e) => setAdminPassInput(e.target.value)}
                  autoFocus
                />
                <button className="w-full bg-white text-indigo-800 font-black py-5 rounded-2xl text-xl shadow-xl active:scale-95 transition-all">প্রবেশ করুন</button>
              </form>
              <button onClick={() => setIsAdminMode(false)} className="text-indigo-200 text-sm font-bold">ইউজার লগইনে ফিরুন</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="text-4xl font-black tracking-tight">{isLoginMode ? 'লগইন' : 'নতুন অ্যাকাউন্ট'}</h1>
                <p className="text-indigo-200 font-medium">প্রবাসী মেছ বাকির ডিজিটাল খাতা</p>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                <input 
                  type="tel" 
                  placeholder="মোবাইল নাম্বার" 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold text-center placeholder:text-white/30 outline-none focus:bg-white focus:text-indigo-900 transition-all"
                  value={tempPhone}
                  onChange={(e) => setTempPhone(e.target.value)}
                />
                <input 
                  type="password" 
                  placeholder="পাসওয়ার্ড" 
                  className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold text-center placeholder:text-white/30 outline-none focus:bg-white focus:text-indigo-900 transition-all"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                />
                <button className="w-full bg-white text-indigo-800 font-black py-5 rounded-2xl text-xl shadow-xl active:scale-95 transition-all">
                  {isLoginMode ? 'প্রবেশ করুন' : 'অ্যাকাউন্ট খুলুন'}
                </button>
              </form>
              <div className="flex flex-col gap-6">
                <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-indigo-200 font-bold underline underline-offset-4 decoration-2">
                  {isLoginMode ? 'নতুন মেছ? অ্যাকাউন্ট খুলুন' : 'আগের অ্যাকাউন্ট? লগইন করুন'}
                </button>
                <div className="pt-10">
                  <button 
                    onClick={() => setIsAdminMode(true)} 
                    className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] bg-white/5 px-6 py-2 rounded-full border border-white/10 hover:text-white transition-all"
                  >
                    অ্যাডমিন লগইন
                  </button>
                </div>
              </div>
            </>
          )}
          
          <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-black pt-12">বিল্লাল জামালপুর</p>
        </div>

        {toast && (
          <div className={`fixed bottom-10 left-6 right-6 z-50 p-4 rounded-2xl text-center font-bold text-sm animate-in slide-in-from-bottom-4 shadow-2xl ${toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto pb-20">
        {activeTab === 'dashboard' && renderDashboard()}
        
        {activeTab === 'expenses' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black text-slate-900 mb-8 text-center">নতুন লেনদেন</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">বিবরণ</label>
                  <input 
                    type="text" 
                    placeholder="কি কেনা হয়েছে বা কি বাবদ জমা?" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">টাকার পরিমাণ</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 transition-all text-2xl ${expenseType === ExpenseType.PAYMENT ? 'text-emerald-600 focus:ring-emerald-500' : 'text-rose-600 focus:ring-indigo-500'}`}
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setExpenseType(ExpenseType.SHARED)}
                    className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <span className="text-xl">🍛</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-center">সবার বাজার</span>
                  </button>
                  <button 
                    onClick={() => setExpenseType(ExpenseType.PERSONAL)}
                    className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <span className="text-xl">👤</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-center">ব্যক্তিগত বাকি</span>
                  </button>
                  <button 
                    onClick={() => setExpenseType(ExpenseType.PAYMENT)}
                    className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    <span className="text-xl">💵</span>
                    <span className="text-[8px] font-black uppercase tracking-tighter text-center">টাকা জমা</span>
                  </button>
                </div>

                {(expenseType === ExpenseType.PERSONAL || expenseType === ExpenseType.PAYMENT) && (
                  <div className={`p-4 rounded-2xl border animate-in zoom-in-95 duration-300 ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                    <p className={`text-[10px] font-black uppercase mb-3 ${expenseType === ExpenseType.PAYMENT ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {expenseType === ExpenseType.PAYMENT ? 'কে টাকা জমা দিচ্ছেন?' : 'কার ব্যক্তিগত বাকি?'}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {activeMembers.map(m => (
                        <button 
                          key={m.id}
                          onClick={() => setTargetId(m.id)}
                          className={`p-2 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-1 ${targetId === m.id ? (expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-rose-600 text-white border-rose-600 shadow-md') : 'bg-white text-slate-300 border-slate-100'}`}
                        >
                          <img src={m.avatar} className="w-6 h-6 rounded-full" />
                          <span className="truncate w-full text-center">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button 
                  onClick={addExpense}
                  className={`w-full font-black py-5 rounded-3xl shadow-xl transition-all text-lg active:scale-95 ${expenseType === ExpenseType.PAYMENT ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-700 hover:bg-indigo-800 text-white'}`}
                >
                  {expenseType === ExpenseType.PAYMENT ? 'জমা হিসেবে সেভ করুন' : 'বাকি হিসেবে সেভ করুন'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-slate-900 px-2 flex justify-between items-center">দোকান খাতা (লেনদেন)</h2>
            {groupedExpenses.length === 0 ? (
              <div className="py-20 text-center opacity-20 font-black grayscale flex flex-col items-center gap-4">
                <span className="text-6xl">📖</span>
                <span>খাতা খালি!</span>
              </div>
            ) : (
              groupedExpenses.map((group) => (
                <div key={group.monthName} className="space-y-3">
                  <div className="flex justify-between items-center px-3 sticky top-[104px] bg-slate-50/95 backdrop-blur-md py-2 z-10 border-b border-slate-100">
                    <span className="text-[11px] font-black uppercase text-indigo-500 tracking-wider">{group.monthName}</span>
                    <span className="text-[10px] font-bold text-slate-400">লেনদেন সংখ্যা: {group.expenses.length}</span>
                  </div>
                  <div className="space-y-3 px-1">
                    {group.expenses.map(exp => (
                      <div key={exp.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex justify-between items-center transition-all hover:border-indigo-100">
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : exp.type === ExpenseType.PAYMENT ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                            {exp.type === ExpenseType.SHARED ? '🍛' : exp.type === ExpenseType.PAYMENT ? '💵' : '👤'}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 leading-tight">{exp.description}</p>
                            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">
                              {exp.type === ExpenseType.SHARED ? 'সবার বাজার' : exp.type === ExpenseType.PAYMENT ? `জমা (${members.find(m => m.id === exp.targetMemberId)?.name})` : `ব্যক্তিগত (${members.find(m => m.id === exp.targetMemberId)?.name})`} • {new Date(exp.date).toLocaleDateString('bn-BD')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={`font-black ${exp.type === ExpenseType.PAYMENT ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {exp.type === ExpenseType.PAYMENT ? '+' : '-'}{formatCurrency(exp.amount)}
                          </p>
                          <button onClick={() => deleteExpense(exp.id)} className="text-rose-300 hover:text-rose-600 p-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-900 mb-6 text-xl">মেম্বার ম্যানেজমেন্ট</h3>
              <div className="flex gap-2 mb-8">
                <input 
                  type="text" 
                  placeholder="নতুন মেম্বার" 
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold outline-none"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
                <button onClick={addMember} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg">যোগ</button>
              </div>
              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4 flex-1">
                      <img src={m.avatar} className="w-10 h-10 rounded-full border border-indigo-200" />
                      <div className="flex-1">
                        {editingMemberId === m.id ? (
                          <div className="flex gap-2 items-center">
                            <input 
                              autoFocus
                              className="bg-white border border-indigo-200 rounded-lg px-2 py-1 font-bold text-slate-800 w-full outline-none"
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveMemberName()}
                            />
                            <button onClick={saveMemberName} className="p-1 bg-indigo-600 text-white rounded-lg">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800">{m.name}</span>
                            <button onClick={() => startEditMember(m)} className="text-slate-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteMember(m.id)} className="text-rose-400 hover:text-rose-600 p-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-black text-slate-900 mb-4 text-xl">সেটিংস</h3>
              <button onClick={handleLogout} className="w-full py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest border border-rose-100">লগআউট (Logout)</button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${toast.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <p className="text-xs font-black uppercase tracking-widest">{toast.message}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
