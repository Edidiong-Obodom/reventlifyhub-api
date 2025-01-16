export interface EventEditLogs {
    actor: string;
    eventId: string;
    eventName: string;
    ticket: string;
    status: string;
    errorMessage?: string;
    date: Date;
    action: string;
  }
  