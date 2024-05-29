export interface PaystackEditLogs {
    actor: string;
    regimeId: string;
    pricingId: string;
    transactionId: string;
    status: string;
    message?: string;
    date: Date;
    action: string;
  }
  