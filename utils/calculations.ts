
import { Member, Expense, ExpenseType, MessSummary, MemberBalance } from '../types.ts';

export const calculateMessSummary = (members: Member[], expenses: Expense[]): MessSummary => {
  const totalShared = expenses
    .filter(e => e.type === ExpenseType.SHARED)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPersonal = expenses
    .filter(e => e.type === ExpenseType.PERSONAL)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPayments = expenses
    .filter(e => e.type === ExpenseType.PAYMENT)
    .reduce((sum, e) => sum + e.amount, 0);

  const grandTotalDebt = (totalShared + totalPersonal) - totalPayments;

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

  // Calculate costs and payments
  expenses.forEach(exp => {
    if (exp.type === ExpenseType.SHARED) {
      // Logic fix: Check if member was active during this specific expense date
      const activeAtTime = members.filter(m => {
        if (m.periods && m.periods.length > 0) {
          // Check if any active period contains the expense date
          return m.periods.some(p => 
            p.join <= exp.date && 
            (!p.leave || p.leave >= exp.date)
          );
        }
        // Fallback for older data without periods array
        return m.joinDate <= exp.date && (!m.leaveDate || m.leaveDate >= exp.date);
      });

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
    } else if (exp.type === ExpenseType.PAYMENT && exp.targetMemberId) {
      const target = balancesMap.get(exp.targetMemberId);
      if (target) {
        target.paid += exp.amount;
      }
    }
  });

  // Finalize totals and balances
  const memberBalances = Array.from(balancesMap.values()).map(b => {
    const totalCost = b.sharedShare + b.personalTotal;
    return {
      ...b,
      totalCost,
      netBalance: b.paid - totalCost
    };
  });

  const activeCount = members.filter(m => !m.leaveDate).length;
  const average = activeCount > 0 ? totalShared / activeCount : 0;

  return {
    totalSharedExpense: totalShared,
    totalPersonalExpense: totalPersonal,
    totalPayments: totalPayments,
    grandTotalDebt,
    averagePerPerson: average,
    memberBalances: memberBalances
  };
};

/**
 * Formats a currency amount with an optional currency code.
 */
export const formatCurrency = (amount: number, currencyCode: string = 'SAR') => {
  const absAmount = Math.abs(amount);
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2
    }).format(absAmount);
    
    const result = currencyCode === 'SAR' ? formatted.replace('SAR', 'SR') : formatted;
    
    return amount < 0 ? `-${result}` : result;
  } catch (e) {
    return `${amount < 0 ? '-' : ''}${currencyCode} ${absAmount.toFixed(2)}`;
  }
};

/**
 * Detects the default currency for the user.
 */
export const getAutoDetectedCurrency = (): string => {
  return 'SAR';
};
