
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const APP_PREFIX = 'mess_tracker_v3_';

const INITIAL_MEMBERS: Member[] = [
  { id: '1', name: 'বিল্লাল', avatar: 'https://picsum.photos/seed/billal/100', joinDate: Date.now() - 86400000 },
  { id: '2', name: 'জামাল', avatar: 'https://picsum.photos/seed/jamal/100', joinDate: Date.now() - 86400000 },
  { id: '3', name: 'আব্দুর', avatar: 'https://picsum.photos/seed/abdur/100', joinDate: Date.now() - 86400000 },
];

const App: React.FC = () => {
  const [userPhone, setUserPhone] = useState<string | null>(() => localStorage.getItem('logged_in_phone'));
  const [tempPhone, setTempPhone] = useState('');
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
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempPhone.length < 10) {
      showToast("সঠিক মোবাইল নাম্বার দিন", "error");
      return;
    }
    localStorage.setItem('logged_in_phone', tempPhone);
    setUserPhone(tempPhone);
    showToast("লগইন সফল হয়েছে!");
  };

  const handleLogout = () => {
    if (window.confirm("আপনি কি লগআউট করতে চান?")) {
      localStorage.removeItem('logged_in_phone');
      setUserPhone(null);
      setTempPhone('');
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

  const [aiInsight, setAiInsight] = useState<string>('হিসাব চেক করা হচ্ছে...');
  useEffect(() => {
    const fetchInsight = async () => {
      if (expenses.length > 0 && userPhone) {
        const insight = await geminiService.getSmartInsight(summary);
        setAiInsight(insight);
      } else {
        setAiInsight("ম্যাচের কোনো খরচ এখনও যোগ করা হয়নি। খরচগুলো লিখলেই আমি আপনাকে পরামর্শ দিতে পারবো। 😊");
      }
    };
    fetchInsight();
  }, [summary, expenses.length, userPhone]);

  const [newMemberName, setNewMemberName] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(ExpenseType.SHARED);
  
  const activeMembers = useMemo(() => members.filter(m => !m.leaveDate), [members]);
  const [payerId, setPayerId] = useState('');
  const [targetId, setTargetId] = useState('');

  useEffect(() => {
    if (activeMembers.length > 0 && (!payerId || !activeMembers.find(m => m.id === payerId))) {
      setPayerId(activeMembers[0].id);
    }
  }, [activeMembers, payerId]);

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
    if (window.confirm("আজ থেকে এই মেম্বারের মেসের বাজার খরচ বন্ধ হবে। তার পূর্বের হিসাব সংরক্ষিত থাকবে। নিশ্চিত?")) {
      setMembers(members.map(m => m.id === id ? { ...m, leaveDate: Date.now() } : m));
      showToast("হিসাব স্থগিত করা হয়েছে");
    }
  };

  const rejoinMess = (id: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, leaveDate: undefined, joinDate: Date.now() } : m));
    showToast("আবার জয়েন করেছেন");
  };

  const deleteMember = (id: string) => {
    const memberName = members.find(m => m.id === id)?.name;
    if (window.confirm(`${memberName}-কে চিরতরে ডিলিট করতে চান? তার সমস্ত রেকর্ড মুছে যাবে।`)) {
      setMembers(members.filter(m => m.id !== id));
      setExpenses(expenses.filter(e => e.payerId !== id && e.targetMemberId !== id));
      showToast("মেম্বার চিরতরে মুছে ফেলা হয়েছে", "error");
    }
  };

  const addExpense = () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amount) || !payerId) {
      showToast("সব তথ্য সঠিকভাবে পূরণ করুন", "error");
      return;
    }
    const newExpense: Expense = {
      id: Date.now().toString(),
      description: expenseDesc,
      amount,
      type: expenseType,
      payerId,
      targetMemberId: expenseType === ExpenseType.PERSONAL ? targetId : undefined,
      date: Date.now(),
    };
    setExpenses([newExpense, ...expenses]);
    setExpenseDesc('');
    setExpenseAmount('');
    showToast("হিসাব যুক্ত হয়েছে!");
    setActiveTab('dashboard');
  };

  const removeExpense = (id: string) => {
    if (window.confirm("এই খরচের রেকর্ডটি মুছে ফেলতে চান?")) {
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("রেকর্ড মুছে ফেলা হয়েছে", "error");
    }
  };

  if (!userPhone) {
    return (
      <div className="min-h-screen bg-indigo-700 flex flex-col justify-center p-6 text-white max-w-md mx-auto shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="relative z-10 text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto flex items-center justify-center text-5xl shadow-2xl rotate-3">🥘</div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black">প্রভাসিদের মেছ</h1>
            <p className="text-indigo-100 font-medium">মোবাইল নাম্বার দিয়ে লগইন করুন</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="tel" 
              placeholder="01xxxxxxxxx" 
              className="w-full bg-white/10 border-2 border-white/20 rounded-2xl px-6 py-5 text-xl font-bold placeholder:text-white/40 focus:bg-white focus:text-indigo-900 outline-none transition-all text-center"
              value={tempPhone}
              onChange={(e) => setTempPhone(e.target.value)}
            />
            <button className="w-full bg-white text-indigo-700 font-black py-5 rounded-2xl text-xl shadow-xl active:scale-95 transition-all">
              শুরু করুন
            </button>
          </form>
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-black">Design: বিল্লাল জামালপুর</p>
        </div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-slate-900 font-black text-lg">মেস স্ট্যাটাস</h2>
          <p className="text-[10px] font-bold text-slate-400">ID: {userPhone}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Auto Saved</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100">
            <p className="text-indigo-600 text-[10px] font-black uppercase tracking-wider mb-1">মোট বাজার</p>
            <p className="text-slate-900 text-2xl font-black">{formatCurrency(summary.totalSharedExpense)}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100">
            <p className="text-emerald-600 text-[10px] font-black uppercase tracking-wider mb-1">সক্রিয় মেম্বার</p>
            <p className="text-slate-900 text-2xl font-black">{activeMembers.length} জন</p>
          </div>
        </div>
        
        <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 flex gap-4 items-start">
          <div className="text-2xl animate-bounce">🤖</div>
          <p className="text-[12px] text-slate-700 leading-relaxed font-bold">{aiInsight}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-slate-900 font-black text-lg px-2">লেনদেন ও বাকি (Net Balance)</h2>
        {summary.memberBalances.map((mb) => (
          <div key={mb.member.id} className={`bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-slate-100 transition-all ${mb.member.leaveDate ? 'opacity-60 bg-slate-50' : 'hover:border-indigo-200'}`}>
            <div className="flex items-center gap-4">
              <div className="relative">
                <img src={mb.member.avatar} alt="" className={`w-12 h-12 rounded-full border-2 border-white shadow-md ${mb.member.leaveDate ? 'grayscale' : ''}`} />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${mb.member.leaveDate ? 'bg-slate-400' : 'bg-emerald-500'}`}></div>
              </div>
              <div>
                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                  {mb.member.name}
                  {mb.member.leaveDate && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md font-black uppercase">Ex-Member</span>}
                </p>
                <p className="text-[10px] text-slate-400 font-black uppercase">মোট খরচ: {formatCurrency(mb.totalCost)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xl font-black ${mb.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {mb.netBalance > 0 ? '+' : ''}{formatCurrency(mb.netBalance)}
              </p>
              <p className="text-[9px] font-black uppercase text-slate-400">
                {mb.netBalance >= 0 ? 'ফেরত পাবেন' : 'পরিশোধ করতে হবে'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddExpense = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-900 mb-6 text-center">নতুন খরচ এন্ট্রি</h2>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">খরচের বিবরণ</label>
            <input 
              type="text" 
              placeholder="যেমন: আজকের সকালের বাজার" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">টাকা (SR)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 transition-all"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">কে খরচ করেছেন?</label>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-black text-slate-700 transition-all cursor-pointer"
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
              >
                {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">খরচের ক্যাটাগরি</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setExpenseType(ExpenseType.SHARED)}
                className={`py-5 rounded-2xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
              >
                <span className="text-xl">🥘</span>
                <span>সবার বাজার</span>
              </button>
              <button 
                onClick={() => setExpenseType(ExpenseType.PERSONAL)}
                className={`py-5 rounded-2xl text-[11px] font-black border-2 transition-all flex flex-col items-center gap-1 ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}
              >
                <span className="text-xl">🛍️</span>
                <span>ব্যক্তিগত খরচ</span>
              </button>
            </div>
          </div>

          {expenseType === ExpenseType.PERSONAL && (
            <div className="animate-in fade-in zoom-in-95 duration-300 bg-rose-50 p-5 rounded-2xl border border-rose-100">
              <label className="block text-[10px] font-black text-rose-500 uppercase mb-3 tracking-widest">কার ব্যক্তিগত খরচ?</label>
              <div className="grid grid-cols-3 gap-2">
                {activeMembers.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setTargetId(m.id)}
                    className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${targetId === m.id ? 'bg-white border-rose-500 text-rose-600' : 'bg-white/50 border-transparent text-slate-400'}`}
                  >
                    <img src={m.avatar} className="w-8 h-8 rounded-full" alt="" />
                    <span className="text-[9px] font-black truncate w-full text-center">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={addExpense}
            className="w-full bg-indigo-700 text-white font-black py-5 rounded-3xl mt-4 shadow-xl hover:bg-indigo-800 active:scale-95 transition-all text-lg"
          >
            খরচ সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <h2 className="text-xl font-black text-slate-900 px-2 flex justify-between items-center">
        খরচের খাতা
        <span className="text-[10px] font-black text-slate-400 bg-white border px-4 py-2 rounded-full">{expenses.length} Records</span>
      </h2>
      {expenses.length === 0 ? (
        <div className="p-20 text-center opacity-30 font-black grayscale">এখনও কোনো খরচ নেই</div>
      ) : (
        expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex justify-between items-center group relative overflow-hidden">
            <div className="flex gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
                {exp.type === ExpenseType.SHARED ? '🥘' : '🛍️'}
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-black text-slate-800 text-base leading-tight">{exp.description}</p>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  {members.find(m => m.id === exp.payerId)?.name || 'Deleted User'} • {new Date(exp.date).toLocaleDateString('bn-BD')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-black text-slate-900 text-xl">{formatCurrency(exp.amount)}</p>
              <button 
                onClick={() => removeExpense(exp.id)}
                className="w-8 h-8 flex items-center justify-center text-rose-300 hover:text-rose-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-900 mb-6 flex justify-between items-center text-xl">মেম্বার ম্যানেজমেন্ট</h3>
        
        <div className="flex gap-2 mb-8">
          <input 
            type="text" 
            placeholder="নতুন মেম্বারের নাম" 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none font-bold"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
          />
          <button onClick={addMember} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black active:scale-95 transition-all">যোগ</button>
        </div>
        
        <div className="space-y-4">
          {members.map(m => (
            <div key={m.id} className={`flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 ${m.leaveDate ? 'opacity-70 bg-slate-100' : ''}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-4">
                  <img src={m.avatar} className={`w-12 h-12 rounded-full border-2 border-white ${m.leaveDate ? 'grayscale' : ''}`} alt="" />
                  <div>
                    <span className="font-black text-slate-800 text-lg">{m.name}</span>
                    <p className="text-[9px] text-slate-400 font-black uppercase">
                      {m.leaveDate ? `মেছ ছেড়েছেন: ${new Date(m.leaveDate).toLocaleDateString('bn-BD')}` : 'বর্তমানে সক্রিয়'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => deleteMember(m.id)}
                  className="text-rose-400 hover:text-rose-600 p-2 bg-white rounded-xl shadow-sm border border-rose-50 active:scale-90 transition-all"
                  title="চিরতরে ডিলিট করুন"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              
              <div className="flex gap-2">
                {!m.leaveDate ? (
                  <button onClick={() => leaveMess(m.id)} className="flex-1 bg-amber-100 text-amber-700 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm">হিসাব বন্ধ করুন (মেছ ছেড়েছেন)</button>
                ) : (
                  <button onClick={() => rejoinMess(m.id)} className="flex-1 bg-emerald-100 text-emerald-700 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm">আবার জয়েন করান</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-black text-slate-900 mb-4 text-xl">অ্যাপ সেটিংস</h3>
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest border border-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          লগআউট করুন (ID: {userPhone})
        </button>
      </div>
      
      <p className="text-center text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] pt-10 pb-4">বিল্লাল জামালপুর</p>
    </div>
  );

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="max-w-md mx-auto relative px-1">
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
