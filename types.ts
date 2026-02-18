
export enum ExpenseType {
  SHARED = 'SHARED',
  PERSONAL = 'PERSONAL',
  PAYMENT = 'PAYMENT'
}

// Added the missing Expense interface
export interface Expense {
  id: string;
  description: string;
  amount: number;
  type: ExpenseType;
  payerId: string;
  targetMemberId?: string;
  date: number;
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  joinDate: number;
  leaveDate?: number;
  // Tracks multiple join/leave sessions
  periods?: Array<{ join: number; leave?: number }>;
}

export interface MemberBalance {
  member: Member;
  paid: number;         // সাধারণ জমা (নাস্তা বাদে)
  breakfastPaid: number; // শুধুমাত্র নাস্তা জমা
  sharedShare: number;  // Their share of mess market
  personalTotal: number; // Their personal specific expenses
  totalCost: number;    // sharedShare + personalTotal
  netBalance: number;   // paid - totalCost
}

export interface MessSummary {
  totalSharedExpense: number;
  totalPersonalExpense: number;
  totalPayments: number;      // সাধারণ পেমেন্ট
  totalBreakfastPayments: number; // মোট নাস্তা জমা
  grandTotalDebt: number;     // বাজার খরচ - সাধারণ জমা
  averagePerPerson: number;
  memberBalances: MemberBalance[];
}
