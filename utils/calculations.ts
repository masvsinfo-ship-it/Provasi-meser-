
import { Member, Expense, ExpenseType, MessSummary, MemberBalance } from '../types.ts';

export const calculateMessSummary = (members: Member[], expenses: Expense[]): MessSummary => {
  const totalShared = expenses
    .filter(e => e.type === ExpenseType.SHARED)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPersonal = expenses
    .filter(e => e.type === ExpenseType.PERSONAL)
    .reduce((sum, e) => sum + e.amount, 0);

  const grandTotalDebt = totalShared + totalPersonal;

  const balancesMap = new Map<string, MemberBalance>();
  members.forEach(m => {
    balancesMap.set(m.id, {
      member: m,
      paid: 0,
      sharedShare: 0,
      personalTotal: 0,
      totalCost: 0,
      netBalance: 0
    });
  });

  // Calculate costs
  expenses.forEach(exp => {
    if (exp.type === ExpenseType.SHARED) {
      const activeAtTime = members.filter(m => 
        m.joinDate <= exp.date && 
        (!m.leaveDate || m.leaveDate >= exp.date) 
      );

      if (activeAtTime.length > 0) {
        const share = exp.amount / activeAtTime.length;
        activeAtTime.forEach(m => {
          const b = balancesMap.get(m.id);
          if (b) b.sharedShare += share;
        });
      }
    } else if (exp.type === ExpenseType.PERSONAL && exp.targetMemberId) {
      const target = balancesMap.get(exp.targetMemberId);
      if (target) {
        target.personalTotal += exp.amount;
      }
    }
  });

  // Finalize totals and balances
  const memberBalances = Array.from(balancesMap.values()).map(b => {
    const totalCost = b.sharedShare + b.personalTotal;
    return {
      ...b,
      totalCost,
      netBalance: -totalCost // Everything is debt to shop
    };
  });

  const activeCount = members.filter(m => !m.leaveDate).length;
  const average = activeCount > 0 ? totalShared / activeCount : 0;

  return {
    totalSharedExpense: totalShared,
    totalPersonalExpense: totalPersonal,
    grandTotalDebt,
    averagePerPerson: average,
    memberBalances: memberBalances
  };
};

export const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(absAmount).replace('SAR', 'SR');
  
  return amount < 0 ? `-${formatted}` : formatted;
};
