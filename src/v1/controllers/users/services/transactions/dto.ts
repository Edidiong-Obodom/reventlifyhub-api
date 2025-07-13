/**
 * Represents a transaction record returned from the database.
 */
export interface TransactionRow {
  id: string;
  parent: string | null;
  client_id: string;
  beneficiary: string | null;
  regime_id: string | null;
  affiliate_id: string | null;
  company: string | null;
  transaction_type:
    | "inter-credit"
    | "inter-debit"
    | "intra-credit"
    | "intra-debit";
  actual_amount: string;
  balance_after_transaction: string;
  company_charge: string;
  payment_gateway_charge: string;
  affiliate_amount: string;
  amount: string;
  currency: string;
  transaction_reference: string | null;
  local_bank: string | null;
  local_account_no: string | null;
  local_account_name: string | null;
  is_recursion: boolean;
  treated: boolean;
  transaction_action: string;
  description: string | null;
  status: "success" | "pending" | "failed";
  payment_gateway: string;
  modified_at: string;
  created_at: string;
  regime_name: string | null;
  affiliate_user_name: string | null;

  // Added during classification logic (not from DB)
  transaction_recipient?: "company" | "regime" | "client";
}
