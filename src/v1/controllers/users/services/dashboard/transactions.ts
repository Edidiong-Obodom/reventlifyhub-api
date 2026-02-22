import { Request, Response } from "express";
import { pool } from "../../../../../db";

type AllowedRole = "creator" | "super_admin" | "admin";
const DAY_MS = 24 * 60 * 60 * 1000;
const setAudit = (req: Request, action: string, details: string) => {
  req.auditData = { action, details };
};

const parsePositiveInt = (value: string, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const dashboardTransactions = async (req: Request, res: Response) => {
  const userId = req.user;
  const { regimeId, page = "1", limit = "20", duration, fromDate, toDate } = req.query as {
    regimeId?: string;
    page?: string;
    limit?: string;
    duration?: string;
    fromDate?: string;
    toDate?: string;
  };

  if (!regimeId) {
    setAudit(req, "Dashboard transactions", "failed: regimeId is required");
    return res.status(400).json({ message: "regimeId is required." });
  }

  const pageNumber = parsePositiveInt(page, 1);
  const limitNumber = parsePositiveInt(limit, 20);
  const offset = (pageNumber - 1) * limitNumber;
  const isAllTime = duration === "all_time";

  try {
    const regimeAccess = await pool.query(
      `SELECT
        r.id,
        r.creator_id,
        rp.participant_role
      FROM regimes r
      LEFT JOIN regime_participant rp
        ON rp.regime_id = r.id
        AND rp.participant_id = $2
        AND rp.is_deleted = false
      WHERE r.id = $1
        AND r.is_deleted = false`,
      [regimeId, userId],
    );

    if (regimeAccess.rows.length === 0) {
      setAudit(req, "Dashboard transactions", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    const accessRow = regimeAccess.rows[0];
    const participantRole = String(accessRow.participant_role ?? "").toLowerCase();
    const effectiveRole =
      accessRow.creator_id === userId
        ? "creator"
        : (participantRole as AllowedRole | "");

    const allowedRoles: AllowedRole[] = ["creator", "super_admin", "admin"];
    if (!effectiveRole || !allowedRoles.includes(effectiveRole as AllowedRole)) {
      setAudit(
        req,
        "Dashboard transactions",
        "failed: forbidden role for transactions view",
      );
      return res.status(403).json({
        message: "Your role does not permit viewing regime transactions.",
      });
    }

    const today = startOfUtcDay(new Date());
    let parsedFrom = fromDate ? parseIsoDate(fromDate) : null;
    let parsedTo = toDate ? parseIsoDate(toDate) : null;

    if (isAllTime && (fromDate || toDate)) {
      setAudit(
        req,
        "Dashboard transactions",
        "failed: fromDate/toDate cannot be used with all_time",
      );
      return res.status(400).json({
        message: "fromDate and toDate cannot be used when duration is all_time.",
      });
    }

    if (!isAllTime && ((fromDate && !toDate) || (!fromDate && toDate))) {
      setAudit(
        req,
        "Dashboard transactions",
        "failed: both fromDate and toDate are required for range",
      );
      return res.status(400).json({
        message: "Both fromDate and toDate are required when filtering by custom range.",
      });
    }

    if (!isAllTime) {
      if (!parsedFrom || !parsedTo) {
        parsedTo = today;
        parsedFrom = new Date(parsedTo.getTime() - 6 * DAY_MS);
      }

      if (parsedFrom > parsedTo) {
        setAudit(
          req,
          "Dashboard transactions",
          "failed: fromDate cannot be later than toDate",
        );
        return res.status(400).json({ message: "fromDate cannot be later than toDate." });
      }

      if (parsedFrom > today || parsedTo > today) {
        setAudit(req, "Dashboard transactions", "failed: future dates are not allowed");
        return res.status(400).json({ message: "Future dates are not allowed." });
      }
    }

    const dateClause = isAllTime
      ? ""
      : "AND DATE(t.created_at) BETWEEN $2 AND $3";
    const baseParams: any[] = isAllTime
      ? [regimeId]
      : [regimeId, toIsoDate(parsedFrom as Date), toIsoDate(parsedTo as Date)];

    const whereClause = `
      t.regime_id = $1
      AND t.status = 'success'
      AND t.treated IS TRUE
      AND t.is_deleted = false
      ${dateClause}
      AND (
        (t.transaction_type = 'inter-debit' AND t.client_id IS NOT NULL)
        OR
        (t.transaction_type = 'intra-debit' AND t.beneficiary IS NOT NULL AND t.client_id IS NULL)
      )
    `;

    const countResult = await pool.query(
      `SELECT
        COUNT(*)::int AS total_transactions,
        COUNT(*) FILTER (
          WHERE t.transaction_type = 'inter-debit'
            AND t.client_id IS NOT NULL
        )::int AS sales_count,
        COUNT(*) FILTER (
          WHERE t.transaction_type = 'intra-debit'
            AND t.beneficiary IS NOT NULL
            AND t.client_id IS NULL
        )::int AS transfer_debit_count
      FROM transactions t
      WHERE ${whereClause}`,
      baseParams,
    );

    const listParams = [...baseParams, limitNumber, offset];
    const listResult = await pool.query(
      `SELECT
        t.id,
        t.created_at,
        t.transaction_type,
        t.transaction_action,
        t.payment_gateway,
        t.description,
        t.amount,
        t.actual_amount,
        t.company_charge,
        t.payment_gateway_charge,
        CASE
          WHEN t.transaction_type = 'inter-debit' THEN t.affiliate_amount
          ELSE NULL
        END AS affiliate_amount,
        t.local_bank,
        t.local_account_no,
        t.local_account_name,
        buyer.id AS buyer_id,
        buyer.user_name AS buyer_user_name,
        buyer.email AS buyer_email,
        beneficiary.id AS beneficiary_id,
        beneficiary.user_name AS beneficiary_user_name,
        beneficiary.email AS beneficiary_email
      FROM transactions t
      LEFT JOIN clients buyer ON buyer.id = t.client_id
      LEFT JOIN clients beneficiary ON beneficiary.id = t.beneficiary
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const transactions = listResult.rows.map((row) => {
      const isSale = row.transaction_type === "inter-debit";
      return {
        id: row.id,
        createdAt: row.created_at,
        type: isSale ? "ticket_sale" : "transfer_debit",
        transactionAction: row.transaction_action,
        paymentGateway: row.payment_gateway,
        description: row.description ?? "",
        amount: Number(row.amount ?? 0),
        actualAmount: Number(row.actual_amount ?? 0),
        companyCharge: Number(row.company_charge ?? 0),
        paymentGatewayCharge: Number(row.payment_gateway_charge ?? 0),
        affiliateAmount: isSale ? Number(row.affiliate_amount ?? 0) : null,
        actor: isSale
          ? {
              id: row.buyer_id,
              name: row.buyer_user_name ?? "",
              email: row.buyer_email ?? "",
            }
          : {
              id: row.beneficiary_id,
              name: row.beneficiary_user_name ?? "",
              email: row.beneficiary_email ?? "",
            },
        transferMeta: isSale
          ? null
          : {
              bankName: row.local_bank ?? "",
              accountNumber: row.local_account_no ?? "",
              accountName: row.local_account_name ?? "",
            },
      };
    });

    const summary = countResult.rows[0] ?? {
      total_transactions: 0,
      sales_count: 0,
      transfer_debit_count: 0,
    };

    setAudit(
      req,
      "Dashboard transactions",
      `success: fetched dashboard transactions for regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      data: {
        regimeId,
        page: pageNumber,
        limit: limitNumber,
        range: isAllTime
          ? {
              duration: "all_time",
            }
          : {
              duration: "range",
              fromDate: toIsoDate(parsedFrom as Date),
              toDate: toIsoDate(parsedTo as Date),
            },
        summary: {
          totalTransactions: Number(summary.total_transactions ?? 0),
          salesCount: Number(summary.sales_count ?? 0),
          transferDebitCount: Number(summary.transfer_debit_count ?? 0),
        },
        transactions,
      },
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard transactions",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};
