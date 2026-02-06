
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';
const USERS_KEY = 'mess_tracker_auth_users';

const INITIAL_MEMBERS: Member[] = [
  { id: '1', name: 'বিল্লাল', avatar: 'https://picsum.photos/seed/billal/100', joinDate: Date.now() - 86400000 },
  { id: '2', name: 'জামাল', avatar: 'https://picsum.photos/seed/jamal/100', joinDate: Date.now() - 86400000 },
  { id: '3', name: 'আব্দুর', avatar: 'https://picsum.photos/seed/abdur/100', joinDate: Date.now() - 86400000 },
];

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [tempPhone, setTempPhone] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (userPhone) {
      const savedMembers = localStorage.getItem(`${APP_PREFIX}${userPhone}_members`);
      const savedExpenses = localStorage.getItem(`${APP_PREFIX}${userPhone}_expenses`);
      setMembers(savedMembers ? JSON.parse(savedMembers) : INITIAL_MEMBERS);
      setExpenses(savedExpenses ? JSON.parse(savedExpenses) : []);
    }
  }, [userPhone]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
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

  const handleLogout = () => {
    if (window.confirm("আপনি কি লগআউট করতে চান? সব তথ্য সংরক্ষিত থাকবে।")) {
      localStorage.removeItem('logged_in_phone');
      setUserPhone(null);
      setTempPhone('');
      setTempPassword('');
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    if (userPhone && (members.length > 0 || expenses.length > 0)) {
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
  }, [members, expenses, userPhone]);

  const summary = useMemo(() => calculateMessSummary(members, expenses), [members, expenses]);

  const [aiInsight, setAiInsight] = useState<string>('হিসাব বিশ্লেষণ করছি...');
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
  
  const activeMembers = useMemo(() => members.filter(m => !m.leaveDate), [members]);
  const [targetId, setTargetId] = useState('');

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

  const leaveMess = (id: string) => {
    if (window.confirm("আজ থেকে এই মেম্বারের নামে কোনো বাকি হিসাব যোগ হবে না। নিশ্চিত?")) {
      setMembers(members.map(m => m.id === id ? { ...m, leaveDate: Date.now() } : m));
      showToast("হিসাব স্থগিত করা হয়েছে");
    }
  };

  const rejoinMess = (id: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, leaveDate: undefined, joinDate: Date.now() } : m));
    showToast("মেম্বার আবার জয়েন করেছেন");
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
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: expenseDesc,
      amount,
      type: expenseType,
      payerId: 'shop',
      targetMemberId: expenseType === ExpenseType.PERSONAL ? targetId : undefined,
      date: Date.now(),
    };
    setExpenses([newExpense, ...expenses]);
    setExpenseDesc('');
    setExpenseAmount('');
    showToast("বাকিতে কেনাকাটা সেভ হয়েছে!");
    setActiveTab('dashboard');
  };

  if (!userPhone) {
    return (
      <div className="min-h-screen bg-indigo-800 flex flex-col justify-center p-6 text-white max-w-md mx-auto relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-40 translate-x-40 blur-3xl"></div>
        <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center text-5xl shadow-2xl rotate-3">🏪</div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">{isLoginMode ? 'লগইন' : 'নতুন অ্যাকাউন্ট'}</h1>
            <p className="text-indigo-200 font-medium">দোকানে বাকির ডিজিটাল হিসাব</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="tel" 
              placeholder="মোবাইল নাম্বার" 
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold placeholder:text-white/30 focus:bg-white focus:text-indigo-900 outline-none transition-all text-center"
              value={tempPhone}
              onChange={(e) => setTempPhone(e.target.value)}
            />
            <input 
              type="password" 
              placeholder="পাসওয়ার্ড" 
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-4 text-lg font-bold placeholder:text-white/30 focus:bg-white focus:text-indigo-900 outline-none transition-all text-center"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
            <button className="w-full bg-white text-indigo-800 font-black py-5 rounded-2xl text-xl shadow-xl active:scale-95 transition-all">
              {isLoginMode ? 'প্রবেশ করুন' : 'নিবন্ধন করুন'}
            </button>
          </form>

          <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-indigo-200 font-bold underline underline-offset-4">
            {isLoginMode ? 'নতুন মেছ? অ্যাকাউন্ট খুলুন' : 'আগে থেকেই আছে? লগইন করুন'}
          </button>
          
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

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end px-2">
        <div>
          <h2 className="text-slate-900 font-black text-2xl">বাকি ড্যাশবোর্ড</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">বাকালাই বাকি হিসাব</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
          <span className="text-[10px] font-black text-slate-500">Auto Saved</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100">
            <p className="text-rose-600 text-[10px] font-black uppercase tracking-wider mb-1">মোট দোকান বাকি</p>
            <p className="text-rose-700 text-2xl font-black">{formatCurrency(summary.totalSharedExpense)}</p>
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">সক্রিয় মেম্বার</p>
            <p className="text-slate-900 text-2xl font-black">{activeMembers.length} জন</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex gap-3">
          <span className="text-xl">💡</span>
          <p className="text-[12px] text-slate-600 font-medium leading-relaxed">{aiInsight}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-slate-900 font-black text-lg px-2">মেম্বার প্রতি দেনার হিসাব</h2>
        {summary.memberBalances.map((mb) => (
          <div key={mb.member.id} className={`bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-slate-100 ${mb.member.leaveDate ? 'opacity-50 grayscale' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={mb.member.avatar} className="w-12 h-12 rounded-full border-2 border-indigo-100" alt="" />
                <div>
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    {mb.member.name}
                    {mb.member.leaveDate && <span className="text-[8px] bg-slate-200 px-2 py-0.5 rounded font-black">EX-MEMBER</span>}
                  </p>
                  <p className="text-[10px] text-slate-400 font-black uppercase">দোকানদার পাবে</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-rose-600">{formatCurrency(Math.abs(mb.netBalance))}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
              <div className="bg-slate-50/50 p-2 rounded-xl">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5">মেস বাজার (শেয়ার)</p>
                <p className="text-[11px] font-black text-slate-700">{formatCurrency(mb.sharedShare)}</p>
              </div>
              <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100/50">
                <p className="text-[8px] font-black text-rose-400 uppercase mb-0.5">ব্যক্তিগত খরচ (বাকি)</p>
                <p className="text-[11px] font-black text-rose-700">{formatCurrency(mb.personalTotal)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddExpense = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <h2 className="text-2xl font-black text-slate-900 mb-8 text-center">দোকানে বাকি বাজার</h2>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">কি কেনা হয়েছে?</label>
            <input 
              type="text" 
              placeholder="চাল, ডাল, রুম ভাড়া বা পার্সোনাল আইটেম" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">টাকার পরিমাণ (বাকি)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-2xl text-rose-600"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setExpenseType(ExpenseType.SHARED)}
              className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
            >
              <span className="text-2xl">🍛</span>
              <span className="text-[10px] font-black uppercase">সবার বাজার</span>
            </button>
            <button 
              onClick={() => setExpenseType(ExpenseType.PERSONAL)}
              className={`py-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
            >
              <span className="text-2xl">👤</span>
              <span className="text-[10px] font-black uppercase">ব্যক্তিগত বাকি</span>
            </button>
          </div>

          {expenseType === ExpenseType.PERSONAL && (
            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-in zoom-in-95 duration-300">
              <p className="text-[10px] font-black text-rose-500 uppercase mb-3">কার ব্যক্তিগত খাতায় লিখবো?</p>
              <div className="grid grid-cols-3 gap-2">
                {activeMembers.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setTargetId(m.id)}
                    className={`p-2 rounded-xl text-[10px] font-bold border-2 transition-all flex flex-col items-center gap-1 ${targetId === m.id ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-300 border-rose-100'}`}
                  >
                    <img src={m.avatar} className="w-6 h-6 rounded-full" alt="" />
                    <span className="truncate w-full text-center">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
            <span className="text-xl">🏪</span>
            <p className="text-[10px] text-amber-800 font-bold leading-tight">এটি সরাসরি মেসের বাকি হিসেবে দোকানদারের খাতায় যোগ হবে।</p>
          </div>

          <button 
            onClick={addExpense}
            className="w-full bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-indigo-800 transition-all text-lg active:scale-95"
          >
            বাকি হিসাব সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-xl font-black text-slate-900 px-2 flex justify-between items-center">
        দোকান বাকি খাতা
        <span className="text-[10px] font-black text-slate-400 bg-white border px-3 py-1 rounded-full">{expenses.length} Records</span>
      </h2>
      {expenses.length === 0 ? (
        <div className="py-20 text-center opacity-20 font-black grayscale flex flex-col items-center gap-4">
          <span className="text-6xl">📖</span>
          <span>খাতা একদম খালি!</span>
        </div>
      ) : (
        expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex justify-between items-center">
            <div className="flex gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
                {exp.type === ExpenseType.SHARED ? '🍛' : '👤'}
              </div>
              <div>
                <p className="font-black text-slate-800">{exp.description}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase">
                  {exp.type === ExpenseType.SHARED ? 'সবার খরচ' : `ব্যক্তিগত (${members.find(m => m.id === exp.targetMemberId)?.name})`} • {new Date(exp.date).toLocaleDateString('bn-BD')}
                </p>
              </div>
            </div>
            <p className="font-black text-rose-600 text-lg">{formatCurrency(exp.amount)}</p>
          </div>
        ))
      )}
    </div>
  );

  const renderSummary = () => (
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
            <div key={m.id} className={`flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 ${m.leaveDate ? 'opacity-60 grayscale' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-4">
                  <img src={m.avatar} className="w-10 h-10 rounded-full border border-indigo-200" alt="" />
                  <div>
                    <span className="font-black text-slate-800">{m.name}</span>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{m.leaveDate ? 'EX-MEMBER' : 'ACTIVE'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => deleteMember(m.id)} className="text-rose-400 p-2 bg-white rounded-lg border border-rose-50 shadow-sm active:scale-90 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                {!m.leaveDate ? (
                  <button onClick={() => leaveMess(m.id)} className="flex-1 bg-white text-amber-600 border border-amber-100 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">হিসাব স্থগিত (Leaved)</button>
                ) : (
                  <button onClick={() => rejoinMess(m.id)} className="flex-1 bg-white text-emerald-600 border border-emerald-100 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm">আবার জয়েন করান</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-900 mb-4 text-xl">অ্যাকাউন্ট সেটিংস</h3>
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest border border-rose-100 shadow-sm flex items-center justify-center gap-2"
        >
          লগআউট (Logout)
        </button>
      </div>
      
      <p className="text-center text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] pt-10 pb-4">বিল্লাল জামালপুর</p>
    </div>
  );

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'expenses' && renderAddExpense()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'summary' && renderSummary()}
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
