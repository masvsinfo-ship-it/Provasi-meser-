
import { Member, Expense, ExpenseType, MessSummary, MemberBalance } from '../types.ts';

/**
 * Detects the user's local currency based on their browser settings.
 * Defaults to 'BDT' if detection fails.
 */
const getLocalCurrencyCode = (): string => {
  try {
    // Some browsers might provide a currency in resolvedOptions if initialized with a locale
    const locale = navigator.language || 'bn-BD';
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
    const resolved = formatter.resolvedOptions();
    
    // We try to infer country from locale to map currency
    const country = locale.split('-')[1]?.toUpperCase();
    const countryToCurrency: Record<string, string> = {
      'BD': 'BDT',
      'SA': 'SAR',
      'AE': 'AED',
      'QA': 'QAR',
      'KW': 'KWD',
      'OM': 'OMR',
      'BH': 'BHD',
      'MY': 'MYR',
      'SG': 'SGD',
      'US': 'USD',
      'GB': 'GBP',
      'EU': 'EUR',
      'IT': 'EUR',
      'FR': 'EUR'
    };
    
    return country ? (countryToCurrency[country] || 'SAR') : 'SAR';
  } catch (e) {
    return 'SAR'; // Fallback to Saudi Riyal as per initial app context
  }
};

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
    } else if (exp.type === ExpenseType.PAYMENT && exp.targetMemberId) {
      const target = balancesMap.get(exp.targetMemberId);
      if (target) {
        target.paid += exp.amount;
      }
    }
  });

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

export const formatCurrency = (amount: number) => {
  const absAmount = Math.abs(amount);
  const currencyCode = getLocalCurrencyCode();
  
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(absAmount);
    
    return amount < 0 ? `-${formatted}` : formatted;
  } catch (e) {
    // Extreme fallback if Intl fails
    return `${amount < 0 ? '-' : ''}${currencyCode} ${absAmount.toFixed(2)}`;
  }
};
