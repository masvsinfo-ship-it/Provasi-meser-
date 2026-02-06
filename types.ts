
export enum ExpenseType {
  SHARED = 'SHARED',
  PERSONAL = 'PERSONAL'
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  joinDate: number; // Timestamp when the member joined
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  type: ExpenseType;
  payerId: string; // The person who actually paid
  targetMemberId?: string; // Only for PERSONAL expenses
  date: number; // Timestamp when expense occurred
}

export interface MemberBalance {
  member: Member;
  paid: number;
  sharedShare: number;
  personalTotal: number;
  netBalance: number;
}

export interface MessSummary {
  totalSharedExpense: number;
  averagePerPerson: number;
  memberBalances: MemberBalance[];
}
