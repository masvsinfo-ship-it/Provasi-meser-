
export enum ExpenseType {
  SHARED = 'SHARED',
  PERSONAL = 'PERSONAL',
  PAYMENT = 'PAYMENT'
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
  paid: number;         // Total amount this person paid/deposited
  sharedShare: number;  // Their share of mess market
  personalTotal: number; // Their personal specific expenses
  totalCost: number;    // sharedShare + personalTotal
  netBalance: number;   // paid - totalCost (positive means surplus, negative means debt)
}

export interface MessSummary {
  totalSharedExpense: number;
  totalPersonalExpense: number;
  totalPayments: number;
  grandTotalDebt: number;
  averagePerPerson: number;
  memberBalances: MemberBalance[];
}
