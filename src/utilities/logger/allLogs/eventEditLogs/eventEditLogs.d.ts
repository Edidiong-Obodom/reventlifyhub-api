export interface EventEditLogs {
  actor: string;
  actorId: string;
  eventId: string;
  eventName: string;
  status: string;
  details: string;
  data: string;
  date: Date;
  action: string;
  error?: string;
}
