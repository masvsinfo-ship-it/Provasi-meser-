
import React, { useState, useEffect, useMemo } from 'react';
import { Member, Expense, ExpenseType, MessSummary } from './types.ts';
import { calculateMessSummary, formatCurrency } from './utils/calculations.ts';
import Layout from './components/Layout.tsx';
import { geminiService } from './services/geminiService.ts';

const STORAGE_KEYS = {
  MEMBERS: 'mess_members_final_v1',
  EXPENSES: 'mess_expenses_final_v1'
};

const INITIAL_MEMBERS: Member[] = [
  { id: '1', name: 'বিল্লাল', avatar: 'https://picsum.photos/seed/billal/100', joinDate: 0 },
  { id: '2', name: 'জামাল', avatar: 'https://picsum.photos/seed/jamal/100', joinDate: 0 },
  { id: '3', name: 'আব্দুর', avatar: 'https://picsum.photos/seed/abdur/100', joinDate: 0 },
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showBackupArea, setShowBackupArea] = useState(false);
  const [backupText, setBackupText] = useState('');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // initialization from storage
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch (e) {
      return INITIAL_MEMBERS;
    }
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [aiInsight, setAiInsight] = useState<string>('হিসাব চেক করা হচ্ছে...');
  const [newMemberName, setNewMemberName] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseType>(ExpenseType.SHARED);
  const [payerId, setPayerId] = useState(members[0]?.id || '');
  const [targetId, setTargetId] = useState('');

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Auto-save logic
  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
        setSaveStatus('saved');
      } catch (e) {
        setSaveStatus('error');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [members, expenses]);

  const summary = useMemo(() => calculateMessSummary(members, expenses), [members, expenses]);

  useEffect(() => {
    const fetchInsight = async () => {
      if (expenses.length > 0) {
        const insight = await geminiService.getSmartInsight(summary);
        setAiInsight(insight);
      } else {
        setAiInsight("ম্যাচের কোনো খরচ এখনও যোগ করা হয়নি। খরচগুলো লিখলেই আমি আপনাকে পরামর্শ দিতে পারবো। 😊");
      }
    };
    fetchInsight();
  }, [summary, expenses.length]);

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
    if (!payerId) setPayerId(newMember.id);
  };

  const removeMember = (id: string) => {
    const member = members.find(m => m.id === id);
    if (!member) return;
    if (window.confirm(`${member.name}-কে কি সত্যি ডিলিট করতে চান?`)) {
      setMembers(members.filter(m => m.id !== id));
      showToast(`${member.name} ডিলিট হয়েছে`, 'error');
    }
  };

  const removeExpense = (id: string) => {
    if (window.confirm("এই খরচের হিসাবটি ডিলিট করতে চান?")) {
      setExpenses(expenses.filter(e => e.id !== id));
      showToast("খরচ ডিলিট হয়েছে", 'error');
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

  const generateBackup = () => {
    const data = { members, expenses };
    const encoded = btoa(JSON.stringify(data));
    setBackupText(encoded);
    setShowBackupArea(true);
    showToast("ব্যাকআপ কোড তৈরি হয়েছে");
  };

  const restoreBackup = () => {
    if (!backupText.trim()) return;
    try {
      const decoded = JSON.parse(atob(backupText));
      if (decoded.members && decoded.expenses) {
        if (window.confirm("রিস্টোর করলে বর্তমান সব হিসাব মুছে যাবে। আপনি কি নিশ্চিত?")) {
          setMembers(decoded.members);
          setExpenses(decoded.expenses);
          showToast("রিস্টোর সফল হয়েছে!");
          setShowBackupArea(false);
          setBackupText('');
        }
      } else {
        showToast("ভুল কোড!", "error");
      }
    } catch (e) {
      showToast("কোডটি সঠিক নয়", "error");
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-slate-900 font-black text-lg">ওভারভিউ</h2>
        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm transition-all">
          <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 animate-pulse'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {saveStatus === 'saved' ? 'Vercel Deployment: Live' : 'সেভ হচ্ছে...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 group transition-all hover:scale-105 active:scale-95 cursor-pointer">
            <p className="text-indigo-600 text-[10px] font-black uppercase tracking-wider mb-1">মোট খরচ</p>
            <p className="text-slate-900 text-2xl font-black">{formatCurrency(summary.totalSharedExpense)}</p>
          </div>
          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 group transition-all hover:scale-105 active:scale-95 cursor-pointer">
            <p className="text-emerald-600 text-[10px] font-black uppercase tracking-wider mb-1">জনপ্রতি গড়</p>
            <p className="text-slate-900 text-2xl font-black">{formatCurrency(summary.averagePerPerson)}</p>
          </div>
        </div>
        
        <div className="mt-5 p-5 bg-gradient-to-br from-indigo-50/50 to-white rounded-2xl border border-indigo-100/50 flex gap-4 items-start shadow-sm relative overflow-hidden">
          <div className="text-2xl animate-pulse relative z-10">🤖</div>
          <p className="text-[12px] text-slate-700 leading-relaxed font-bold relative z-10">{aiInsight}</p>
          <div className="absolute top-0 right-0 p-1">
             <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">AI INSIGHT</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center px-2">
          <h2 className="text-slate-900 font-black text-lg">মেম্বারদের বিল</h2>
          <button onClick={() => setActiveTab('summary')} className="text-indigo-600 text-[10px] font-black bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-all active:scale-90 uppercase tracking-wider shadow-sm">ম্যানেজ</button>
        </div>
        
        {summary.memberBalances.map((mb) => (
          <div key={mb.member.id} className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-slate-100 group hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img src={mb.member.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow-md" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
              </div>
              <div>
                <p className="font-bold text-slate-900">{mb.member.name}</p>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">বাজার ভাগ: {formatCurrency(mb.sharedShare)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-slate-900">{formatCurrency(mb.netBalance)}</p>
              <div className="flex items-center justify-end gap-1">
                <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                <p className="text-[9px] text-rose-500 font-black uppercase">ব্যক্তিগত: {formatCurrency(mb.personalTotal)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddExpense = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-900 mb-6 text-center">নতুন খরচ যোগ করুন</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">কি বাবদ খরচ?</label>
            <input 
              type="text" 
              placeholder="আলু, মুরগি বা তেলের খরচ" 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">টাকার পরিমাণ</label>
              <input 
                type="number" 
                placeholder="0.00" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-black text-slate-700 transition-all"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">কে দিয়েছেন?</label>
              <div className="relative">
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none font-black text-slate-700 transition-all"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                >
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest px-1">খরচের ধরন</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setExpenseType(ExpenseType.SHARED)}
                className={`py-4 px-2 rounded-2xl text-[11px] font-black border-2 transition-all active:scale-95 flex flex-col items-center gap-1 ${expenseType === ExpenseType.SHARED ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-100'}`}
              >
                <span>📦</span>
                <span>সবার বাজার</span>
              </button>
              <button 
                onClick={() => setExpenseType(ExpenseType.PERSONAL)}
                className={`py-4 px-2 rounded-2xl text-[11px] font-black border-2 transition-all active:scale-95 flex flex-col items-center gap-1 ${expenseType === ExpenseType.PERSONAL ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200' : 'bg-white text-slate-400 border-slate-100 hover:border-rose-100'}`}
              >
                <span>👤</span>
                <span>ব্যক্তিগত</span>
              </button>
            </div>
          </div>

          {expenseType === ExpenseType.PERSONAL && (
            <div className="animate-in fade-in zoom-in-95 duration-300 bg-rose-50 p-5 rounded-2xl border border-rose-100">
              <label className="block text-[10px] font-black text-rose-500 uppercase mb-3 tracking-widest px-1">কার জন্য?</label>
              <div className="grid grid-cols-3 gap-2">
                {members.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setTargetId(m.id)}
                    className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${targetId === m.id ? 'bg-white border-rose-500 text-rose-600' : 'bg-white/50 border-transparent text-slate-400'}`}
                  >
                    <img src={m.avatar} className="w-8 h-8 rounded-full" alt="" />
                    <span className="text-[9px] font-black">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={addExpense}
            className="w-full bg-indigo-700 text-white font-black py-5 rounded-3xl mt-4 shadow-xl shadow-indigo-100 hover:bg-indigo-800 active:scale-95 transition-all text-lg flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            খরচ যুক্ত করুন
          </button>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-black text-slate-900">খরচের খাতা</h2>
        <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-100 px-4 py-2 rounded-full shadow-sm uppercase tracking-widest">{expenses.length} টি এন্ট্রি</span>
      </div>
      {expenses.length === 0 ? (
        <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-slate-100">
          <p className="text-slate-300 font-black uppercase text-xs tracking-widest">এখনও কোনো খরচ নেই</p>
        </div>
      ) : (
        expenses.map(exp => (
          <div key={exp.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex justify-between items-center group transition-all hover:shadow-md hover:-translate-y-1">
            <div className="flex gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
                {exp.type === ExpenseType.SHARED ? '🥘' : '🛍️'}
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-black text-slate-800 text-base leading-tight">{exp.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    {members.find(m => m.id === exp.payerId)?.name} • {new Date(exp.date).toLocaleDateString('bn-BD')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-black text-slate-900 text-xl">{formatCurrency(exp.amount)}</p>
                <div className="flex justify-end">
                   <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${exp.type === ExpenseType.SHARED ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
                    {exp.type === ExpenseType.SHARED ? 'মেস বাজার' : 'ব্যক্তিগত'}
                   </span>
                </div>
              </div>
              <button 
                onClick={() => removeExpense(exp.id)} 
                className="w-10 h-10 flex items-center justify-center text-rose-200 hover:text-rose-600 transition-colors bg-rose-50 rounded-xl active:scale-90"
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
        <h3 className="font-black text-slate-900 mb-6 flex justify-between items-center text-xl">
          মেম্বার লিস্ট
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full font-black uppercase tracking-wider shadow-sm">{members.length} জন</span>
        </h3>
        
        <div className="flex gap-2 mb-8">
          <input 
            type="text" 
            placeholder="নতুন মেম্বারের নাম" 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold transition-all placeholder:text-slate-300"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
          />
          <button 
            onClick={addMember} 
            className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all"
          >
            যোগ
          </button>
        </div>
        
        <div className="space-y-4">
          {members.map(m => (
            <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all group">
              <div className="flex items-center gap-4">
                <img src={m.avatar} className="w-12 h-12 rounded-full shadow-sm border-2 border-white" alt="" />
                <div className="flex flex-col">
                  <span className="font-black text-slate-800 text-lg leading-tight">{m.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">যোগদান: {m.joinDate === 0 ? 'শুরু থেকে' : new Date(m.joinDate).toLocaleDateString('bn-BD')}</span>
                </div>
              </div>
              <button 
                onClick={() => removeMember(m.id)} 
                className="text-rose-400 bg-white p-3 rounded-xl border border-rose-100 transition-all hover:bg-rose-500 hover:text-white active:scale-90 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -translate-y-16 translate-x-16 -z-10"></div>
        <h3 className="font-black text-slate-900 mb-4 text-xl flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-xl">🛡️</div>
          ব্যাকআপ ও রিস্টোর
        </h3>
        <p className="text-[11px] text-slate-500 font-bold mb-6 leading-relaxed bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
           যেহেতু ডাটা আপনার ফোনের ব্রাউজারে সেভ থাকে, তাই Vercel-এ অ্যাপটি আপডেট হলেও ডাটা হারাবে না। তবে ফোন পরিবর্তন করার সময় অবশ্যই ব্যাকআপ নিয়ে রাখবেন।
        </p>
        
        <div className="space-y-4">
          <button 
            onClick={generateBackup}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            ব্যাকআপ কোড তৈরি করুন
          </button>

          {showBackupArea && (
            <div className="animate-in slide-in-from-top-4 duration-300 space-y-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-indigo-200">
              <textarea 
                className="w-full h-32 bg-white border border-slate-200 rounded-xl p-4 text-[10px] font-mono break-all outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                value={backupText}
                onChange={(e) => setBackupText(e.target.value)}
                placeholder="ব্যাকআপ কোড এখানে পেস্ট করুন"
              />
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(backupText);
                    showToast("কোডটি কপি হয়েছে!");
                  }}
                  className="py-3 rounded-xl bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95"
                >
                  কপি
                </button>
                <button 
                  onClick={restoreBackup}
                  className="py-3 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-100 active:scale-95"
                >
                  রিস্টোর
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-slate-300 text-[9px] font-black uppercase tracking-[0.4em] pt-10 pb-4">
        ডিজাইন ও ডেভেলপমেন্ট: বিল্লাল জামালপুর
      </p>
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

      {/* Custom Toast Notification */}
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