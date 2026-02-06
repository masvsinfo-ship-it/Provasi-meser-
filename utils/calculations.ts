
import { Member, Expense, ExpenseType, MessSummary, MemberBalance } from '../types';

export const calculateMessSummary = (members: Member[], expenses: Expense[]): MessSummary => {
  // ১. মোট ম্যাচের বাজার (Shared)
  const totalShared = expenses
    .filter(e => e.type === ExpenseType.SHARED)
    .reduce((sum, e) => sum + e.amount, 0);

  // Initialize a map for calculating balances per member
  const balancesMap = new Map<string, MemberBalance>();
  members.forEach(m => {
    balancesMap.set(m.id, {
      member: m,
      paid: 0,
      sharedShare: 0,
      personalTotal: 0,
      netBalance: 0
    });
  });

  // ২. প্রতিটি খরচের জন্য আলাদাভাবে হিসাব করা
  expenses.forEach(exp => {
    // কে টাকা দিয়েছে তার পকেট থেকে খরচ (Paid out of pocket) ট্র্যাক করা
    const payerBalance = balancesMap.get(exp.payerId);
    if (payerBalance) {
      payerBalance.paid += exp.amount;
    }

    if (exp.type === ExpenseType.SHARED) {
      // এই খরচটি যখন হয়েছে তখন মেসে কতজন মেম্বার ছিল তা বের করা
      const activeAtTime = members.filter(m => m.joinDate <= exp.date);
      if (activeAtTime.length > 0) {
        const slice = exp.amount / activeAtTime.length;
        activeAtTime.forEach(m => {
          const b = balancesMap.get(m.id);
          if (b) b.sharedShare += slice;
        });
      }
    } else if (exp.type === ExpenseType.PERSONAL && exp.targetMemberId) {
      // ব্যক্তিগত খরচটি সরাসরি ওই ব্যক্তির নামে যোগ করা
      const target = balancesMap.get(exp.targetMemberId);
      if (target) {
        target.personalTotal += exp.amount;
      }
    }
  });

  // ৩. মেম্বারদের ফাইনাল ব্যালেন্স বের করা
  const memberBalances = Array.from(balancesMap.values()).map(b => ({
    ...b,
    netBalance: b.sharedShare + b.personalTotal
  }));

  // গড় খরচ (সাধারণ তথ্যের জন্য)
  const average = members.length > 0 ? totalShared / members.length : 0;

  return {
    totalSharedExpense: totalShared,
    averagePerPerson: average,
    memberBalances: memberBalances
  };
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(amount).replace('SAR', 'SR');
};
