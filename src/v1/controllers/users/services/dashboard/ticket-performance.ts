import { Request, Response } from "express";
import { pool } from "../../../../../db";

type AllowedRole =
  | "creator"
  | "super_admin"
  | "admin"
  | "marketer";

const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toIsoDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export const dashboardTicketPerformance = async (req: Request, res: Response) => {
  const userId = req.user;
  const {
    regimeId,
    pricingId = "all",
    duration,
    fromDate,
    toDate,
  } = req.query as {
    regimeId?: string;
    pricingId?: string;
    duration?: string;
    fromDate?: string;
    toDate?: string;
  };

  if (!regimeId) {
    return res.status(400).json({ message: "regimeId is required." });
  }

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
      return res.status(404).json({ message: "Regime not found." });
    }

    const accessRow = regimeAccess.rows[0];
    const participantRole = accessRow.participant_role as string | null;
    const effectiveRole =
      accessRow.creator_id === userId
        ? "creator"
        : (participantRole as AllowedRole | null);

    if (!effectiveRole) {
      return res.status(403).json({ message: "You do not have access to this regime." });
    }

    const allowedRoles: AllowedRole[] = [
      "creator",
      "super_admin",
      "admin",
      "marketer",
    ];

    if (!allowedRoles.includes(effectiveRole as AllowedRole)) {
      return res.status(403).json({
        message: "Your role does not permit viewing ticket performance.",
      });
    }

    const isAllTime = duration === "all_time";
    const today = startOfUtcDay(new Date());
    let parsedFrom = fromDate ? parseIsoDate(fromDate) : null;
    let parsedTo = toDate ? parseIsoDate(toDate) : null;

    if (!isAllTime && ((fromDate && !toDate) || (!fromDate && toDate))) {
      return res.status(400).json({
        message: "Both fromDate and toDate are required when filtering by custom range.",
      });
    }

    if (isAllTime && (fromDate || toDate)) {
      return res.status(400).json({
        message: "fromDate and toDate cannot be used when duration is all_time.",
      });
    }

    let pricingName = "All Pricings";
    let soldTotal = 0;
    let totalSeats = 0;
    let availableSeats = 0;

    if (pricingId !== "all") {
      const pricingResult = await pool.query(
        `SELECT id, name, total_seats, available_seats
         FROM pricings
         WHERE id = $1 AND regime_id = $2`,
        [pricingId, regimeId],
      );

      if (pricingResult.rows.length === 0) {
        return res.status(404).json({ message: "Pricing not found for this regime." });
      }

      const pricing = pricingResult.rows[0];
      pricingName = pricing.name;
      totalSeats = Number(pricing.total_seats ?? 0);
      availableSeats = Number(pricing.available_seats ?? 0);
      soldTotal = Math.max(totalSeats - availableSeats, 0);
    } else {
      const allPricingTotals = await pool.query(
        `SELECT
          COALESCE(SUM(total_seats), 0) AS total_seats,
          COALESCE(SUM(available_seats), 0) AS available_seats
         FROM pricings
         WHERE regime_id = $1`,
        [regimeId],
      );

      totalSeats = Number(allPricingTotals.rows[0]?.total_seats ?? 0);
      availableSeats = Number(allPricingTotals.rows[0]?.available_seats ?? 0);
      soldTotal = Math.max(totalSeats - availableSeats, 0);
    }

    if (isAllTime) {
      const allTimeRangeResult = await pool.query(
        `SELECT COALESCE(MIN(DATE(t.created_at))::text, '') AS first_sale_date
         FROM tickets t
         JOIN pricings p ON p.id = t.pricing_id
         WHERE p.regime_id = $1
           AND t.is_deleted = false
           ${pricingId !== "all" ? "AND t.pricing_id = $2" : ""}`,
        pricingId !== "all" ? [regimeId, pricingId] : [regimeId],
      );

      const firstSaleDate = allTimeRangeResult.rows[0]?.first_sale_date as string;
      parsedTo = today;
      parsedFrom = firstSaleDate ? parseIsoDate(firstSaleDate) : new Date(today.getTime() - 6 * DAY_MS);
    } else {
      if (!parsedFrom || !parsedTo) {
        parsedTo = today;
        parsedFrom = new Date(parsedTo.getTime() - 6 * DAY_MS);
      }

      if (parsedFrom > parsedTo) {
        return res.status(400).json({ message: "fromDate cannot be later than toDate." });
      }

      if (parsedFrom > today || parsedTo > today) {
        return res.status(400).json({ message: "Future dates are not allowed." });
      }

      const rangeDays = Math.floor((parsedTo.getTime() - parsedFrom.getTime()) / DAY_MS) + 1;
      if (rangeDays !== 7) {
        return res.status(400).json({
          message: "Date range must be exactly 7 days.",
        });
      }
    }

    if (!parsedFrom || !parsedTo) {
      return res.status(500).json({ message: "Failed to determine date range." });
    }

    const fromIso = toIsoDate(parsedFrom);
    const toIso = toIsoDate(parsedTo);
    const rangeDays = Math.floor((parsedTo.getTime() - parsedFrom.getTime()) / DAY_MS) + 1;

    const weeklyParams: any[] = [regimeId, fromIso, toIso];
    let pricingWhereClause = "";

    if (pricingId !== "all") {
      weeklyParams.push(pricingId);
      pricingWhereClause = `AND t.pricing_id = $${weeklyParams.length}`;
    }

    const weeklySalesResult = await pool.query(
      `SELECT
        DATE(t.created_at) AS sale_date,
        COUNT(*)::int AS sold
       FROM tickets t
       JOIN pricings p ON p.id = t.pricing_id
       WHERE p.regime_id = $1
         AND t.is_deleted = false
         AND DATE(t.created_at) BETWEEN $2 AND $3
         ${pricingWhereClause}
       GROUP BY DATE(t.created_at)
       ORDER BY DATE(t.created_at) ASC`,
      weeklyParams,
    );

    const weeklyLookup = weeklySalesResult.rows.reduce<Record<string, number>>(
      (acc, row) => {
        acc[toIsoDate(new Date(row.sale_date))] = Number(row.sold ?? 0);
        return acc;
      },
      {},
    );

    const weeklySales = Array.from({ length: rangeDays }).map((_, index) => {
      const current = new Date(parsedFrom.getTime() + index * DAY_MS);
      const iso = toIsoDate(current);
      const day = current.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });

      return {
        date: iso,
        day,
        sold: weeklyLookup[iso] ?? 0,
      };
    });

    const left = Math.max(totalSeats - soldTotal, 0);
    const soldPercentage =
      totalSeats > 0 ? Math.round((soldTotal / totalSeats) * 100) : 0;

    req.auditData = {
      action: "Dashboard ticket performance",
      details: `Fetched ticket performance for regime ${regimeId}`,
    };

    return res.status(200).json({
      success: true,
      data: {
        regimeId,
        pricingId,
        pricingName,
        range: {
          fromDate: fromIso,
          toDate: toIso,
          days: rangeDays,
          duration: isAllTime ? "all_time" : "weekly",
        },
        soldProgress: {
          sold: soldTotal,
          total: totalSeats,
          left,
          soldPercentage,
        },
        weeklyTicketSales: weeklySales,
      },
    });
  } catch (error) {
    req.auditData = {
      action: "Dashboard ticket performance",
      details: error?.message ?? error?.toString(),
    };

    return res.status(500).json({ message: "Internal server error" });
  }
};
