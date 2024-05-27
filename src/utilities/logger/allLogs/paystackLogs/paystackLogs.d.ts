export interface PaystackEditLogs {
    actor: string;
    regimeId: string;
    pricingId: string;
    transactionId: string;
    status: string;
    errorMessage?: string;
    date: Date;
    action: string;
  }
  