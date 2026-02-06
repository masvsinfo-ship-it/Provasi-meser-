
export enum ExpenseType {
  SHARED = 'SHARED',
  PERSONAL = 'PERSONAL'
}

export interface Member {
  id: string;
  name: string;
  avatar: string;
  joinDate: number;
  leaveDate?: number;
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

export interface MemberBalance {
  member: Member;
  paid: number;         // Total amount this person paid out of pocket
  sharedShare: number;  // Their share of mess market (up to leave date)
  personalTotal: number; // Their personal specific expenses
  totalCost: number;    // sharedShare + personalTotal
  netBalance: number;   // paid - totalCost (negative means they owe the shop)
}

export interface MessSummary {
  totalSharedExpense: number;
  totalPersonalExpense: number;
  grandTotalDebt: number;
  averagePerPerson: number;
  memberBalances: MemberBalance[];
}
