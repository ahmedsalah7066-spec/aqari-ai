export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
}

export interface Contract {
  id: string;
  userId: string;
  title: string;
  unitDetails?: string;
  totalPrice?: number;
  legalAdvice?: string;
  deliveryDate?: string;
  deliveryGracePeriod?: string;
  maintenanceDeposit?: number;
  maintenanceDepositDueDate?: string;
  maintenanceType?: 'standalone' | 'integrated';
  isMaintenancePaid?: boolean;
  unitArea?: number;
  rentalStatus?: 'vacant' | 'rented';
  rentalAmount?: number;
  rentalDuration?: string;
  rentalStartDate?: string;
  contractDate?: string;
  usdPriceAtContract?: number;
  exchangeRateAtContract?: number;
  lastVacancyDate?: string;
  createdAt: string;
}

export interface Installment {
  id: string;
  contractId: string;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  description?: string;
  orderIndex?: number;
}

export interface ContractAnalysis {
  title: string;
  unitDetails: string;
  totalPrice: number;
  contractDate: string;
  deliveryDate: string;
  deliveryGracePeriod: string;
  maintenanceDeposit: number;
  maintenanceDepositDueDate: string;
  maintenanceType: 'standalone' | 'integrated';
  unitArea: number;
  rentalAmount: number;
  usdPriceAtContract: number;
  exchangeRateAtContract: number;
  installments: {
    amount: number;
    dueDate: string;
    description: string;
  }[];
  legalAdvice: string;
}
