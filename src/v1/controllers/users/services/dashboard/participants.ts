import { Request, Response } from "express";
import { pool } from "../../../../../db";
import * as Helpers from "../../../../../helpers";

type AccessRole =
  | "creator"
  | "super_admin"
  | "admin"
  | "bouncer"
  | "usher"
  | "marketer";

type ManageableRole =
  | "super_admin"
  | "admin"
  | "bouncer"
  | "usher"
  | "marketer";

const MANAGEABLE_ROLES: ManageableRole[] = [
  "super_admin",
  "admin",
  "usher",
  "bouncer",
  "marketer",
];

const MANAGEABLE_BY_ROLE: Record<AccessRole, ManageableRole[]> = {
  creator: ["super_admin", "admin", "usher", "bouncer", "marketer"],
  super_admin: ["super_admin", "admin", "usher", "bouncer", "marketer"],
  admin: ["admin", "usher", "bouncer", "marketer"],
  bouncer: [],
  usher: [],
  marketer: [],
};

const VIEWABLE_ROLES: AccessRole[] = ["creator", "super_admin", "admin"];
const MANAGER_ROLES: AccessRole[] = ["creator", "super_admin", "admin"];

type AccessContext = {
  creatorId: string;
  regimeName: string;
  role: AccessRole | null;
};

const normalizeRole = (value: string | null | undefined): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const roleLabel = (value: string) => value.replace(/_/g, " ");
const setAudit = (req: Request, action: string, details: string) => {
  req.auditData = { action, details };
};

const sendParticipantNotification = async ({
  email,
  userName,
  subject,
  actorUserName,
  regimeName,
  actionLine,
}: {
  email: string;
  userName: string;
  subject: string;
  actorUserName: string;
  regimeName: string;
  actionLine: string;
}) => {
  if (!email) return;

  await Helpers.sendMail({
    email,
    subject,
    mailBodyText: `${actionLine} Regime: ${regimeName}.`,
    mailBodyHtml: Helpers.mailHTMLBodyLayout({
      subject,
      body: `
        <h3 style="color: #111827;">Hey ${userName || "there"},</h3>
        <p style="color: #374151;">${actionLine}</p>
        <p style="color: #6b7280;">Regime: <strong>${regimeName}</strong></p>
        <p style="color: #6b7280;">Initiated by: <strong>${actorUserName}</strong></p>
        <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>
      `,
    }),
  });
};

const sendParticipantNotificationInBackground = (
  req: Request,
  action: string,
  payload: Parameters<typeof sendParticipantNotification>[0],
) => {
  void sendParticipantNotification(payload).catch((mailError) => {
    setAudit(
      req,
      action,
      `mail-notification-failed: ${mailError?.message ?? mailError?.toString()}`,
    );
  });
};

const getRegimeAccess = async (
  regimeId: string,
  userId: string,
): Promise<AccessContext | null> => {
  const regimeAccess = await pool.query(
    `SELECT
      r.id,
      r.creator_id,
      r.name AS regime_name,
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
  const participantRole = normalizeRole(row.participant_role);
  const role =
    row.creator_id === userId ? "creator" : (participantRole as AccessRole);

  return {
    creatorId: row.creator_id,
    regimeName: row.regime_name ?? "Unknown Regime",
    role: role || null,
  };
};

const toParticipantPayload = (row: any) => ({
  id: row.id,
  participantId: row.participant_id,
  name: row.user_name ?? "",
  email: row.email ?? "",
  userName: row.user_name ?? "",
  photo: row.photo ?? null,
  participantRole: normalizeRole(row.participant_role),
  balance: Number(row.balance ?? 0),
  createdAt: row.created_at,
});

const getParticipantsForRegime = async (regimeId: string) => {
  const result = await pool.query(
    `SELECT
      rp.id,
      rp.participant_id,
      rp.participant_role,
      rp.balance,
      rp.created_at,
      c.email,
      c.user_name,
      c.photo
    FROM regime_participant rp
    JOIN clients c ON c.id = rp.participant_id
    WHERE rp.regime_id = $1
      AND rp.is_deleted = false
      AND LOWER(rp.participant_role) != 'creator'
    ORDER BY
      CASE LOWER(rp.participant_role)
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'usher' THEN 3
        WHEN 'bouncer' THEN 4
        WHEN 'marketer' THEN 5
        ELSE 6
      END,
      rp.created_at DESC`,
    [regimeId],
  );

  const participants = result.rows.map(toParticipantPayload);
  const byRole = participants.reduce(
    (acc, item) => {
      if (item.participantRole in acc) {
        acc[item.participantRole as keyof typeof acc] += 1;
      }
      return acc;
    },
    {
      super_admin: 0,
      admin: 0,
      usher: 0,
      bouncer: 0,
      marketer: 0,
    },
  );

  return {
    participants,
    summary: {
      total: participants.length,
      byRole,
    },
  };
};

export const dashboardParticipantsList = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user;
  const { regimeId } = req.query as { regimeId?: string };

  if (!regimeId) {
    setAudit(req, "Dashboard participants list", "failed: regimeId is required");
    return res.status(400).json({ message: "regimeId is required." });
  }

  try {
    const access = await getRegimeAccess(regimeId, userId);
    if (!access) {
      setAudit(req, "Dashboard participants list", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    if (!access.role || !VIEWABLE_ROLES.includes(access.role)) {
      setAudit(
        req,
        "Dashboard participants list",
        "failed: forbidden role for participants list",
      );
      return res
        .status(403)
        .json({
          message: "You do not have access to view regime participants.",
        });
    }

    const data = await getParticipantsForRegime(regimeId);

    setAudit(
      req,
      "Dashboard participants list",
      `success: fetched participants for regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      data: {
        regimeId,
        currentUserRole: access.role,
        permissions: {
          canManageParticipants: MANAGER_ROLES.includes(access.role),
          assignableRoles: MANAGEABLE_BY_ROLE[access.role],
        },
        ...data,
      },
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard participants list",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const dashboardParticipantsCreate = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user;
  const actorUserName = req.userName || "Regime Manager";
  const { regimeId, email, participantRole } = req.body as {
    regimeId?: string;
    email?: string;
    participantRole?: string;
  };

  if (!regimeId || !email || !participantRole) {
    setAudit(
      req,
      "Dashboard participants create",
      "failed: regimeId, email, and participantRole are required",
    );
    return res.status(400).json({
      message: "regimeId, email, and participantRole are required.",
    });
  }

  const normalizedRole = normalizeRole(participantRole) as ManageableRole;
  if (!MANAGEABLE_ROLES.includes(normalizedRole)) {
    setAudit(
      req,
      "Dashboard participants create",
      `failed: invalid participantRole ${normalizedRole}`,
    );
    return res.status(400).json({
      message: `participantRole must be one of: ${MANAGEABLE_ROLES.join(", ")}.`,
    });
  }

  try {
    const access = await getRegimeAccess(regimeId, userId);
    if (!access) {
      setAudit(req, "Dashboard participants create", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    if (!access.role || !MANAGER_ROLES.includes(access.role)) {
      setAudit(
        req,
        "Dashboard participants create",
        "failed: forbidden role for participant create",
      );
      return res.status(403).json({
        message: "You do not have permission to manage regime participants.",
      });
    }

    const allowedForRole = MANAGEABLE_BY_ROLE[access.role];
    if (!allowedForRole.includes(normalizedRole)) {
      setAudit(
        req,
        "Dashboard participants create",
        `failed: role ${access.role} cannot assign ${normalizedRole}`,
      );
      return res.status(403).json({
        message: `Your role can only assign these roles: ${allowedForRole.join(", ")}.`,
      });
    }

    const userResult = await pool.query(
      `SELECT id, email, first_name, last_name, user_name, photo
       FROM clients
       WHERE LOWER(email) = LOWER($1)
         AND is_deleted = false
       LIMIT 1`,
      [email],
    );

    if (userResult.rows.length === 0) {
      setAudit(
        req,
        "Dashboard participants create",
        "failed: user with email not found",
      );
      return res
        .status(404)
        .json({ message: "User with this email was not found." });
    }

    const targetUser = userResult.rows[0];
    if (targetUser.id === access.creatorId) {
      setAudit(
        req,
        "Dashboard participants create",
        "failed: creator cannot be added as participant",
      );
      return res.status(400).json({
        message:
          "Regime creator cannot be added via this participant endpoint.",
      });
    }

    const upsertResult = await pool.query(
      `INSERT INTO regime_participant(participant_id, regime_id, participant_role, is_deleted, modified_at)
       VALUES($1, $2, $3, false, CURRENT_TIMESTAMP)
       ON CONFLICT (regime_id, participant_id)
       DO UPDATE SET
         participant_role = EXCLUDED.participant_role,
         is_deleted = false,
         modified_at = CURRENT_TIMESTAMP
       RETURNING *, (xmax = 0) AS inserted`,
      [targetUser.id, regimeId, normalizedRole],
    );

    const wasInserted = upsertResult.rows[0]?.inserted === true;
    sendParticipantNotificationInBackground(
      req,
      "Dashboard participants create",
      {
        email: targetUser.email,
        userName: targetUser.user_name,
        subject: wasInserted
        ? "Added As Regime Participant"
        : "Regime Participant Role Updated",
      actorUserName,
      regimeName: access.regimeName,
        actionLine: wasInserted
          ? `${actorUserName} added you as ${roleLabel(normalizedRole)} in a regime.`
          : `${actorUserName} updated your role to ${roleLabel(normalizedRole)} in a regime.`,
      },
    );

    setAudit(
      req,
      "Dashboard participants create",
      `success: added/updated participant ${targetUser.id} in regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      message: "Participant saved successfully.",
      data: toParticipantPayload({
        ...upsertResult.rows[0],
        ...targetUser,
      }),
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard participants create",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const dashboardParticipantsUpdate = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user;
  const actorUserName = req.userName || "Regime Manager";
  const { regimeId, participantId, participantRole } = req.body as {
    regimeId?: string;
    participantId?: string;
    participantRole?: string;
  };

  if (!regimeId || !participantId || !participantRole) {
    setAudit(
      req,
      "Dashboard participants update",
      "failed: regimeId, participantId, and participantRole are required",
    );
    return res.status(400).json({
      message: "regimeId, participantId, and participantRole are required.",
    });
  }

  const normalizedRole = normalizeRole(participantRole) as ManageableRole;
  if (!MANAGEABLE_ROLES.includes(normalizedRole)) {
    setAudit(
      req,
      "Dashboard participants update",
      `failed: invalid participantRole ${normalizedRole}`,
    );
    return res.status(400).json({
      message: `participantRole must be one of: ${MANAGEABLE_ROLES.join(", ")}.`,
    });
  }

  try {
    const access = await getRegimeAccess(regimeId, userId);
    if (!access) {
      setAudit(req, "Dashboard participants update", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    if (!access.role || !MANAGER_ROLES.includes(access.role)) {
      setAudit(
        req,
        "Dashboard participants update",
        "failed: forbidden role for participant update",
      );
      return res.status(403).json({
        message: "You do not have permission to manage regime participants.",
      });
    }

    const allowedForRole = MANAGEABLE_BY_ROLE[access.role];
    if (!allowedForRole.includes(normalizedRole)) {
      setAudit(
        req,
        "Dashboard participants update",
        `failed: role ${access.role} cannot assign ${normalizedRole}`,
      );
      return res.status(403).json({
        message: `Your role can only assign these roles: ${allowedForRole.join(", ")}.`,
      });
    }

    const existing = await pool.query(
      `SELECT rp.*, c.email, c.user_name, c.photo
       FROM regime_participant rp
       JOIN clients c ON c.id = rp.participant_id
       WHERE rp.regime_id = $1
         AND rp.participant_id = $2
         AND rp.is_deleted = false
       LIMIT 1`,
      [regimeId, participantId],
    );

    if (existing.rows.length === 0) {
      setAudit(
        req,
        "Dashboard participants update",
        "failed: participant not found for regime",
      );
      return res
        .status(404)
        .json({ message: "Participant not found for this regime." });
    }

    const currentRole = normalizeRole(
      existing.rows[0].participant_role,
    ) as AccessRole;
    if (currentRole === "creator") {
      setAudit(
        req,
        "Dashboard participants update",
        "failed: creator role cannot be modified",
      );
      return res
        .status(400)
        .json({ message: "Creator role cannot be modified." });
    }

    if (
      access.role === "admin" &&
      (currentRole === "super_admin" || normalizedRole === "super_admin")
    ) {
      setAudit(
        req,
        "Dashboard participants update",
        "failed: admin cannot modify super_admin role",
      );
      return res.status(403).json({
        message: "Admin cannot modify super admin participants.",
      });
    }

    const updated = await pool.query(
      `UPDATE regime_participant
       SET participant_role = $3,
           modified_at = CURRENT_TIMESTAMP
       WHERE regime_id = $1
         AND participant_id = $2
         AND is_deleted = false
       RETURNING *`,
      [regimeId, participantId, normalizedRole],
    );

    sendParticipantNotificationInBackground(
      req,
      "Dashboard participants update",
      {
        email: existing.rows[0].email,
        userName: existing.rows[0].user_name,
        subject: "Regime Participant Role Updated",
        actorUserName,
        regimeName: access.regimeName,
        actionLine: `${actorUserName} changed your participant role from ${roleLabel(currentRole)} to ${roleLabel(normalizedRole)}.`,
      },
    );

    setAudit(
      req,
      "Dashboard participants update",
      `success: updated participant ${participantId} role to ${normalizedRole} for regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      message: "Participant role updated successfully.",
      data: toParticipantPayload({
        ...updated.rows[0],
        email: existing.rows[0].email,
        user_name: existing.rows[0].user_name,
        photo: existing.rows[0].photo,
      }),
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard participants update",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const dashboardParticipantsDelete = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user;
  const actorUserName = req.userName || "Regime Manager";
  const { regimeId, participantId } = req.body as {
    regimeId?: string;
    participantId?: string;
  };

  if (!regimeId || !participantId) {
    setAudit(
      req,
      "Dashboard participants delete",
      "failed: regimeId and participantId are required",
    );
    return res.status(400).json({
      message: "regimeId and participantId are required.",
    });
  }

  try {
    const access = await getRegimeAccess(regimeId, userId);
    if (!access) {
      setAudit(req, "Dashboard participants delete", "failed: regime not found");
      return res.status(404).json({ message: "Regime not found." });
    }

    if (!access.role || !MANAGER_ROLES.includes(access.role)) {
      setAudit(
        req,
        "Dashboard participants delete",
        "failed: forbidden role for participant delete",
      );
      return res.status(403).json({
        message: "You do not have permission to manage regime participants.",
      });
    }

    const existing = await pool.query(
      `SELECT
        rp.participant_role,
        c.email,
        c.user_name
       FROM regime_participant rp
       JOIN clients c ON c.id = rp.participant_id
       WHERE rp.regime_id = $1
         AND rp.participant_id = $2
         AND rp.is_deleted = false
       LIMIT 1`,
      [regimeId, participantId],
    );

    if (existing.rows.length === 0) {
      setAudit(
        req,
        "Dashboard participants delete",
        "failed: participant not found for regime",
      );
      return res
        .status(404)
        .json({ message: "Participant not found for this regime." });
    }

    const currentRole = normalizeRole(
      existing.rows[0].participant_role,
    ) as AccessRole;
    if (currentRole === "creator") {
      setAudit(
        req,
        "Dashboard participants delete",
        "failed: creator cannot be removed",
      );
      return res.status(400).json({ message: "Creator cannot be removed." });
    }

    if (access.role === "admin" && currentRole === "super_admin") {
      setAudit(
        req,
        "Dashboard participants delete",
        "failed: admin cannot remove super_admin participant",
      );
      return res.status(403).json({
        message: "Admin cannot remove super admin participants.",
      });
    }

    await pool.query(
      `UPDATE regime_participant
       SET is_deleted = true,
           modified_at = CURRENT_TIMESTAMP
       WHERE regime_id = $1
         AND participant_id = $2
         AND is_deleted = false`,
      [regimeId, participantId],
    );

    sendParticipantNotificationInBackground(
      req,
      "Dashboard participants delete",
      {
        email: existing.rows[0].email,
        userName: existing.rows[0].user_name,
        subject: "Removed From Regime Participants",
        actorUserName,
        regimeName: access.regimeName,
        actionLine: `${actorUserName} removed you from regime participants as ${roleLabel(currentRole)}.`,
      },
    );

    setAudit(
      req,
      "Dashboard participants delete",
      `success: removed participant ${participantId} from regime ${regimeId}`,
    );

    return res.status(200).json({
      success: true,
      message: "Participant removed successfully.",
    });
  } catch (error) {
    setAudit(
      req,
      "Dashboard participants delete",
      `failed: ${error?.message ?? error?.toString()}`,
    );
    return res.status(500).json({ message: "Internal server error" });
  }
};
