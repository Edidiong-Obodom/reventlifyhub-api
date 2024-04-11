export interface CreateRegimeType {
  regimeName: string;
  regimeType: RegimeType;
  regimeDescription: string;
  regimeAddress: string;
  regimePricing: any[];
  regimeCity: string;
  regimeState: string;
  regimeCountry: string;
  regimeWithdrawalPin: string;
  regimeMediaBase64: string;
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
  | "talent-show";
