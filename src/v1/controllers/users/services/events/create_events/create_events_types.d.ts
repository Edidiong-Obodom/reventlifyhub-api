export interface CreateRegimeType {
  regimeName: string;
  regimeType: RegimeType;
  regimeDescription: string;
  regimeAddress: string;
  regimePricing: any[];
  regimeVenue: string;
  regimeCity: string;
  regimeState: string;
  regimeCountry: string;
  regimeWithdrawalPin: string;
  regimeMediaBase64: string;
  regimeMediaBase64I?: string;
  regimeMediaBase64II?: string;
  regimeMediaBase64III?: string;
  regimeMediaBase64IV?: string;
  regimeAffiliate: boolean;
  regimeStartDate: string;
  regimeStartTime: string;
  regimeEndDate: string;
  regimeEndTime: string;
}

export type RegimeType =
  | "concert"
  | "conference"
  | "theatre"
  | "pageantry"
  | "service"
  | "education"
  | "carnival"
  | "festival"
  | "party"
  | "sport"
  | "talent-show"
  | "exhibition"
  | "fashion";
