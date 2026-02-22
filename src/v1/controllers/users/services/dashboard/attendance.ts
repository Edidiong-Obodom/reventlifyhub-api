import { Request, Response } from "express";
import { pool } from "../../../../../db";

type AllowedRole = "creator" | "super_admin" | "admin" | "bouncer" | "usher";
type AttendanceFilter = "present" | "stepped-out" | "yet-to-attend";
const setAudit = (req: Request, action: string, details: string) => {
  req.auditData = { action, details };
};

const parsePositiveInt = (value: string, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeRole = (value: string | null | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const filterToTicketStatus = (filter: AttendanceFilter): string => {
  if (filter === "yet-to-attend") return "active";
  if (filter === "stepped-out") return "stepped_out";
  return "present";
};

const parseFilters = (value?: string): AttendanceFilter[] => {
  if (!value?.trim()) return ["present", "stepped-out", "yet-to-attend"];
  const normalized = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const mapped = normalized
    .map((item) => {
      if (item === "active" || item === "yet-to-attend") return "yet-to-attend";
      if (item === "present") return "present";
      if (item === "stepped_out" || item === "stepped-out") return "stepped-out";
      return null;
    })
    .filter(Boolean) as AttendanceFilter[];

  return mapped.length > 0
    ? Array.from(new Set(mapped))
    : ["present", "stepped-out", "yet-to-attend"];
};

const getRegimeAccessRole = async (regimeId: string, userId: string) => {
  const regimeAccess = await pool.query(
    `SELECT
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

  if (regimeAccess.rows.length === 0) return null;
  const row = regimeAccess.rows[0];
  const role =
    row.creator_id === userId
      ? "creator"
      : (normalizeRole(row.participant_role) as AllowedRole | "");
  return role || null;
};

const buildAttendanceWhere = (
  baseParamOffset: number,
  statuses: string[],
  withSearch: boolean,
) => {
  const statusParams = statuses.map((_, idx) => `$${baseParamOffset + idx}`).join(", ");
  const statusClause = `AND t.status IN (${statusParams})`;
  const searchClause = withSearch
    ? `AND (
      LOWER(owner.user_name) LIKE LOWER($${baseParamOffset + statuses.length})
      OR LOWER(owner.email) LIKE LOWER($${baseParamOffset + statuses.length})
      OR LOWER(t.id) LIKE LOWER($${baseParamOffset + statuses.length})
      OR LOWER(p.name) LIKE LOWER($${baseParamOffset + statuses.length})
    )`
    : "";

  return { statusClause, searchClause };
};

const runAttendanceList = async ({
  regimeId,
  filters,
  pageNumber,
  limitNumber,
  search,
}: {
  regimeId: string;
  filters: AttendanceFilter[];
  pageNumber: number;
  limitNumber: number;
  search?: string;
}) => {
  const mappedStatuses = filters.map(filterToTicketStatus);
  const offset = (pageNumber - 1) * limitNumber;
  const withSearch = Boolean(search?.trim());

  const baseParams: any[] = [regimeId];
  baseParams.push(...mappedStatuses);
  if (withSearch) baseParams.push(`%${search?.trim()}%`);

  const countWhere = buildAttendanceWhere(2, mappedStatuses, withSearch);
  const countQuery = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM tickets t
     JOIN pricings p ON p.id = t.pricing_id
     JOIN clients owner ON owner.id = t.owner_id
     WHERE p.regime_id = $1
       AND t.is_deleted = false
       ${countWhere.statusClause}
       ${countWhere.searchClause}`,
    baseParams,
  );

  const listParams = [...baseParams, limitNumber, offset];
  const listWhere = buildAttendanceWhere(2, mappedStatuses, withSearch);
  const listQuery = await pool.query(
    `SELECT
      t.id AS ticket_id,
      t.status,
      t.created_at,
      owner.id AS owner_id,
      owner.user_name,
      owner.email,
      p.id AS pricing_id,
      p.name AS pricing_name
     FROM tickets t
     JOIN pricings p ON p.id = t.pricing_id
     JOIN clients owner ON owner.id = t.owner_id
     WHERE p.regime_id = $1
       AND t.is_deleted = false
       ${listWhere.statusClause}
       ${listWhere.searchClause}
     ORDER BY t.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  );

  const summaryQuery = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE t.status = 'present')::int AS present,
      COUNT(*) FILTER (WHERE t.status = 'stepped_out')::int AS stepped_out,
      COUNT(*) FILTER (WHERE t.status = 'active')::int AS yet_to_attend
     FROM tickets t
     JOIN pricings p ON p.id = t.pricing_id
     WHERE p.regime_id = $1
       AND t.is_deleted = false`,
    [regimeId],
  );

  const total = Number(countQuery.rows[0]?.total ?? 0);
  const summary = summaryQuery.rows[0] ?? {
    present: 0,
    stepped_out: 0,
    yet_to_attend: 0,
  };

  return {
    page: pageNumber,
    limit: limitNumber,
    total,
    totalPages: Math.max(1, Math.ceil(total / limitNumber)),
    summary: {
      present: Number(summary.present ?? 0),
      steppedOut: Number(summary.stepped_out ?? 0),
      yetToAttend: Number(summary.yet_to_attend ?? 0),
    },
    data: listQuery.rows.map((row) => ({
      ticketId: row.ticket_id,
      ownerId: row.owner_id,
      userName: row.user_name ?? "",
      email: row.email ?? "",
      pricingId: row.pricing_id,
      pricingName: row.pricing_name ?? "",
      status:
        row.status === "stepped_out"
          ? "stepped-out"
          : row.status === "present"
            ? "present"
            : "yet-to-attend",
      lastAction:
        row.status === "present"
          ? "Checked in"
          : row.status === "stepped_out"
            ? "Stepped out"
            : "Pending check-in",
      createdAt: row.created_at,
    })),
  };
};

export const dashboardAttendanceList = async (req: Request, res: Response) => {
  const userId = req.user;
  const { regimeId, page = "1", limit = "30", filters } = req.query as {
    regimeId?: string;
    page?: string;
    limit?: string;
    filters?: string;
  };

  if (!regimeId) {
    setAudit(req, "Dashboard attendance list", "failed: regimeId is required");
    return res.status(400).json({ message: "regimeId is required." });
  }

  try {
    const role = await getRegimeAccessRole(regimeId, userId);
    if (!role) {
      setAudit(req, "Dashboard attendance list", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }
    const allowedRoles: AllowedRole[] = [
      "creator",
      "super_admin",
      "admin",
      "bouncer",
      "usher",
    ];
    if (!allowedRoles.includes(role as AllowedRole)) {
      setAudit(
        req,
        "Dashboard attendance list",
        "failed: forbidden role for attendance list",
      );
      return res.status(403).json({
        message: "Your role does not permit viewing attendance data.",
      });
    }

    const result = await runAttendanceList({
      regimeId,
      filters: parseFilters(filters),
      pageNumber: parsePositiveInt(page, 1),
      limitNumber: parsePositiveInt(limit, 30),
    });

    setAudit(
      req,
      "Dashboard attendance list",
      `success: fetched attendance list for regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard attendance list",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const dashboardAttendanceSearch = async (req: Request, res: Response) => {
  const userId = req.user;
  const { regimeId, query = "", page = "1", limit = "30", filters } = req.query as {
    regimeId?: string;
    query?: string;
    page?: string;
    limit?: string;
    filters?: string;
  };

  if (!regimeId) {
    setAudit(req, "Dashboard attendance search", "failed: regimeId is required");
    return res.status(400).json({ message: "regimeId is required." });
  }

  try {
    const role = await getRegimeAccessRole(regimeId, userId);
    if (!role) {
      setAudit(req, "Dashboard attendance search", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }
    const allowedRoles: AllowedRole[] = [
      "creator",
      "super_admin",
      "admin",
      "bouncer",
      "usher",
    ];
    if (!allowedRoles.includes(role as AllowedRole)) {
      setAudit(
        req,
        "Dashboard attendance search",
        "failed: forbidden role for attendance search",
      );
      return res.status(403).json({
        message: "Your role does not permit viewing attendance data.",
      });
    }

    const result = await runAttendanceList({
      regimeId,
      filters: parseFilters(filters),
      pageNumber: parsePositiveInt(page, 1),
      limitNumber: parsePositiveInt(limit, 30),
      search: query,
    });

    setAudit(
      req,
      "Dashboard attendance search",
      `success: searched attendance list for regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard attendance search",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};
