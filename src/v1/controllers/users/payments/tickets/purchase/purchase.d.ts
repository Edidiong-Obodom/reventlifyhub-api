export interface TicketPurchase {
  paymentStatus: string;
  event: string;
  realAmount: number;
  amount: number;
  reference: string;
  userId: string;
  regimeId: string;
  pricingId: string;
  affiliateId: string;
  numberOfTickets: number;
  transactionType?: string;
}
