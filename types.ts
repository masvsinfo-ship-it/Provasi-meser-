
export enum ExpenseType {
  SHARED = 'SHARED',
  PERSONAL = 'PERSONAL',
  PAYMENT = 'PAYMENT'
}

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
  periods?: Array<{ join: number; leave?: number }>;
}

export interface UserProfile {
  name: string;
  avatarSeed: string;
}

export interface MemberBalance {
  member: Member;
  paid: number;
  breakfastPaid: number;
  sharedShare: number;
  personalTotal: number;
  totalCost: number;
  netBalance: number;
}

export interface MessSummary {
  totalSharedExpense: number;
  totalPersonalExpense: number;
  totalPayments: number;
  totalBreakfastPayments: number;
  grandTotalDebt: number;
  averagePerPerson: number;
  memberBalances: MemberBalance[];
}
