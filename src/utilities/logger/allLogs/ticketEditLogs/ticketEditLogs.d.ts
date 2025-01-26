export interface TicketEditLogs {
  sender: string;
  beneficiary: string;
  ticket: string;
  status: string;
  errorMessage?: string;
  date?: Date;
  name: string;
}
