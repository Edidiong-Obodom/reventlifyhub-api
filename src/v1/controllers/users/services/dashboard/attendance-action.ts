import { Request, Response } from "express";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers";

type AllowedRole = "creator" | "super_admin" | "admin" | "bouncer" | "usher";
type AttendanceAction = "check_in" | "step_out";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const setAudit = (req: Request, action: string, details: string) => {
  req.auditData = { action, details };
};

const normalizeRole = (value: string | null | undefined): string =>
  String(value ?? "").trim().toLowerCase();

const parseScannedData = (value: string) => {
  const normalized = String(value ?? "").trim();
  const parts = normalized.split(":");
  if (parts.length < 2) return null;

  const timestamp = Number(parts[0]);
  const ticketId = parts.slice(1).join(":").trim();
  if (!ticketId || !Number.isFinite(timestamp)) return null;

  return { timestamp, ticketId };
};

const normalizeDateOnly = (input: unknown): { year: number; month: number; day: number } | null => {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  // Support raw YYYY-MM-DD
  const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (plainDateMatch) {
    return {
      year: Number(plainDateMatch[1]),
      month: Number(plainDateMatch[2]),
      day: Number(plainDateMatch[3]),
    };
  }

  // Support Date-like/ISO values returned by PG drivers.
  const asDate = new Date(raw);
  if (Number.isNaN(asDate.getTime())) return null;
  return {
    year: asDate.getUTCFullYear(),
    month: asDate.getUTCMonth() + 1,
    day: asDate.getUTCDate(),
  };
};

const parseRegimeStartDateTime = (startDate: unknown, startTime: unknown): Date | null => {
  const dateParts = normalizeDateOnly(startDate);
  const timeValue = String(startTime ?? "").trim();

  if (!dateParts) return null;

  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeValue);
  if (!timeMatch) return null;

  const year = dateParts.year;
  const month = dateParts.month;
  const day = dateParts.day;
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] ?? "0");

  const eventDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);
  if (Number.isNaN(eventDate.getTime())) return null;
  return eventDate;
};

const sendAttendanceNotificationInBackground = (
  req: Request,
  {
  email,
  userName,
  regimeName,
  actorUserName,
  action,
}: {
  email: string;
  userName: string;
  regimeName: string;
  actorUserName: string;
  action: AttendanceAction;
},
) => {
  if (!email) return;

  const subject =
    action === "check_in" ? "Ticket Checked In" : "Ticket Marked Stepped Out";
  const actionLine =
    action === "check_in"
      ? `${actorUserName} checked you in for ${regimeName}.`
      : `${actorUserName} marked your ticket as stepped out for ${regimeName}.`;

  void Helpers.sendMail({
    email,
    subject,
    mailBodyText: actionLine,
    mailBodyHtml: Helpers.mailHTMLBodyLayout({
      subject,
      body: `
        <h3 style="color: #111827;">Hey ${userName || "there"},</h3>
        <p style="color: #374151;">${actionLine}</p>
        <p style="color: #6b7280;">Regime: <strong>${regimeName}</strong></p>
        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>
      `,
    }),
  }).catch((mailError) => {
    setAudit(
      req,
      "Dashboard attendance action",
      `mail-notification-failed: ${mailError?.message ?? mailError?.toString()}`,
    );
  });
};

const getRegimeAccessRole = async (regimeId: string, userId: string) => {
  const regimeAccess = await pool.query(
    `SELECT
      r.creator_id
      , rp.participant_role
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
  return row.creator_id === userId
    ? "creator"
    : (normalizeRole(row.participant_role) as AllowedRole | "");
};

export const dashboardAttendanceAction = async (req: Request, res: Response) => {
  const userId = req.user;
  const actorUserName = req.userName || "Regime Staff";
  const {
    regimeId,
    scannedData,
    action = "check_in",
  } = req.body as {
    regimeId?: string;
    scannedData?: string;
    action?: AttendanceAction;
  };

  if (!regimeId || !scannedData) {
    setAudit(
      req,
      "Dashboard attendance action",
      "failed: regimeId and scannedData are required",
    );
    return res
      .status(400)
      .json({ message: "regimeId and scannedData are required." });
  }

  if (!["check_in", "step_out"].includes(action)) {
    setAudit(
      req,
      "Dashboard attendance action",
      `failed: invalid action ${action}`,
    );
    return res.status(400).json({ message: "action must be check_in or step_out." });
  }

  const parsed = parseScannedData(scannedData);
  if (!parsed) {
    setAudit(
      req,
      "Dashboard attendance action",
      "failed: invalid scannedData format",
    );
    return res.status(400).json({
      message: "Invalid QR payload. Expected format timestamp:ticketId.",
    });
  }

  try {
    const role = await getRegimeAccessRole(regimeId, userId);
    const allowedRoles: AllowedRole[] = [
      "creator",
      "super_admin",
      "admin",
      "bouncer",
      "usher",
    ];

    if (!role) {
      setAudit(req, "Dashboard attendance action", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    if (!allowedRoles.includes(role as AllowedRole)) {
      setAudit(
        req,
        "Dashboard attendance action",
        "failed: forbidden role for attendance action",
      );
      return res.status(403).json({
        message: "Your role does not permit attendance actions.",
      });
    }

    const now = Date.now();
    if (parsed.timestamp > now || now - parsed.timestamp > THIRTY_MINUTES_MS) {
      setAudit(
        req,
        "Dashboard attendance action",
        `failed: invalid timestamp for ticket ${parsed.ticketId}`,
      );
      return res.status(400).json({
        message:
          "Ticket QR timestamp is invalid/expired. If this is not a screenshot, refresh ticket details page and try again.",
      });
    }

    const ticketQuery = await pool.query(
      `SELECT
        t.id,
        t.status,
        t.owner_id,
        p.regime_id,
        p.name AS pricing_name,
        r.name AS regime_name,
        r.start_date,
        r.start_time,
        c.user_name,
        c.email
      FROM tickets t
      JOIN pricings p ON p.id = t.pricing_id
      JOIN regimes r ON r.id = p.regime_id
      JOIN clients c ON c.id = t.owner_id
      WHERE t.id = $1
        AND p.regime_id = $2
        AND t.is_deleted = false
      LIMIT 1`,
      [parsed.ticketId, regimeId],
    );

    if (ticketQuery.rows.length === 0) {
      setAudit(
        req,
        "Dashboard attendance action",
        `failed: ticket not found ${parsed.ticketId}`,
      );
      return res.status(404).json({ message: "Ticket not found for this regime." });
    }

    const ticket = ticketQuery.rows[0];
    console.log(ticket);
    
    const eventStart = parseRegimeStartDateTime(ticket.start_date, ticket.start_time);
    if (!eventStart) {
      setAudit(
        req,
        "Dashboard attendance action",
        `failed: invalid event start date/time for regime ${regimeId}`,
      );
      return res.status(400).json({
        message:
          "Event start time is invalid. Please contact organizer support.",
      });
    }

    if (eventStart.getTime() - now > FOUR_HOURS_MS) {
      setAudit(
        req,
        "Dashboard attendance action",
        `failed: check-in too early for ticket ${parsed.ticketId}`,
      );
      return res.status(400).json({
        message:
          "Event is yet to start. Check-in starts at least 4 hours before event start time.",
      });
    }

    const currentStatus = String(ticket.status ?? "").toLowerCase();
    if (action === "check_in") {
      if (currentStatus === "present") {
        setAudit(
          req,
          "Dashboard attendance action",
          `success: ticket ${parsed.ticketId} already present`,
        );
        return res.status(200).json({
          success: true,
          alreadyCheckedIn: true,
          message:
            "User already checked in. Someone with this ticket is already inside.",
          data: {
            ticketId: ticket.id,
            status: "present",
            ownerUserName: ticket.user_name,
            pricingName: ticket.pricing_name,
          },
        });
      }

      if (!["active", "stepped_out"].includes(currentStatus)) {
        setAudit(
          req,
          "Dashboard attendance action",
          `failed: invalid status ${currentStatus} for check_in`,
        );
        return res.status(400).json({
          message: "Ticket status does not allow check-in.",
        });
      }

      await pool.query(
        `UPDATE tickets
         SET status = 'present',
             modified_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [ticket.id],
      );

      sendAttendanceNotificationInBackground(req, {
        email: ticket.email,
        userName: ticket.user_name,
        regimeName: ticket.regime_name,
        actorUserName,
        action: "check_in",
      });

      setAudit(
        req,
        "Dashboard attendance action",
        `success: checked in ticket ${ticket.id}`,
      );
      return res.status(200).json({
        success: true,
        alreadyCheckedIn: false,
        message: "Attendee checked in successfully.",
        data: {
          ticketId: ticket.id,
          status: "present",
          ownerUserName: ticket.user_name,
          pricingName: ticket.pricing_name,
        },
      });
    }

    if (currentStatus === "stepped_out") {
      setAudit(
        req,
        "Dashboard attendance action",
        `success: ticket ${parsed.ticketId} already stepped_out`,
      );
      return res.status(200).json({
        success: true,
        alreadySteppedOut: true,
        message: "Attendee is already marked as stepped out.",
        data: {
          ticketId: ticket.id,
          status: "stepped_out",
          ownerUserName: ticket.user_name,
          pricingName: ticket.pricing_name,
        },
      });
    }

    if (currentStatus !== "present") {
      setAudit(
        req,
        "Dashboard attendance action",
        `failed: status ${currentStatus} cannot step_out`,
      );
      return res.status(400).json({
        message: "Only checked-in attendees can be marked stepped out.",
      });
    }

    await pool.query(
      `UPDATE tickets
       SET status = 'stepped_out',
           modified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ticket.id],
    );

    sendAttendanceNotificationInBackground(req, {
      email: ticket.email,
      userName: ticket.user_name,
      regimeName: ticket.regime_name,
      actorUserName,
      action: "step_out",
    });

    setAudit(
      req,
      "Dashboard attendance action",
      `success: stepped out ticket ${ticket.id}`,
    );
    return res.status(200).json({
      success: true,
      alreadySteppedOut: false,
      message: "Attendee marked as stepped out.",
      data: {
        ticketId: ticket.id,
        status: "stepped_out",
        ownerUserName: ticket.user_name,
        pricingName: ticket.pricing_name,
      },
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard attendance action",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};
