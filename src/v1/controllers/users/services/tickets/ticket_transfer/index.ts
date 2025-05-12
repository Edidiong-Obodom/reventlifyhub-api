import { Response } from "express";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../helpers";
import { pool } from "../../../../../../db";
import { capitalize } from "lodash";
import Log from "../../../../../../utilities/logger";

export const ticketTransfer = async (req: ExtendedRequest, res: Response) => {
  const { user, userName, email } = req;
  const fields = ["beneficiary", "ticket"];
  const currentDate = new Date();

  // check data for each field in the request query param and validate format
  const requiredFields = Helpers.requiredFields(req.body, fields);

  if (!requiredFields.success) {
    return res.status(400).json({ message: requiredFields.message });
  }

  // request body from the clients
  const { beneficiary, ticket, ...rest } = req.body;

  // Check if there are any additional properties in the request query param
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    return res.status(400).json({ message: extraFields.message });
  }

  if (user === beneficiary) {
    // insert ticket edit into logs
    return await Log.ticketEditLogs(
      { req, res },
      {
        sender: email,
        beneficiary,
        ticket,
        status: "failed",
        errorMessage: "You can't share a ticket to yourself.",
        date: currentDate,
        name: "Ticket transfer",
      }
    );
  }

  const queryString = `SELECT 
  tickets.id, 
  tickets.owner_id,
  pricings.name as pricing_name,
  pricings.amount,
  regimes.name as regime_name,
  regimes.status,
  regimes.start_date,
  regimes.start_time
  FROM tickets
  JOIN pricings ON pricings.id = tickets.pricing_id
  JOIN regimes ON regimes.id = pricings.regime_id
  WHERE tickets.id = $1`;

  try {
    const ticketDetails = await pool.query(queryString, [ticket]);
    const beneficiaryDetails = await Helpers.findUserById(beneficiary);

    if (beneficiaryDetails.rows.length === 0) {
      // insert ticket edit into logs
      return await Log.ticketEditLogs(
        { req, res },
        {
          sender: email,
          beneficiary,
          ticket,
          status: "failed",
          errorMessage: "User does not exist.",
          date: currentDate,
          name: "Ticket transfer",
        }
      );
    }

    if (ticketDetails.rows.length === 0) {
      // insert ticket edit into logs
      return await Log.ticketEditLogs(
        { req, res },
        {
          sender: email,
          beneficiary,
          ticket,
          status: "failed",
          errorMessage: "Ticket does not exist.",
          date: currentDate,
          name: "Ticket transfer",
        }
      );
    }
    const regimeStart = new Date(
      ticketDetails.rows[0].start_date + " " + ticketDetails.rows[0].start_time
    );

    if (currentDate > regimeStart) {
      // insert ticket edit into logs
      return await Log.ticketEditLogs(
        { req, res },
        {
          sender: email,
          beneficiary,
          ticket,
          status: "failed",
          errorMessage: "You can't share a ticket after the event has started.",
          date: currentDate,
          name: "Ticket transfer",
        }
      );
    }

    await pool.query(
      `UPDATE tickets SET owner_id = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [beneficiary, ticket]
    );

    // Send email notification
    const mailOptions = {
      from: "Reventlify <no-reply@reventlify.com>",
      to: beneficiaryDetails.rows[0].email,
      subject: "Ticket Transfer",
      text: `${userName} transferred one ${ticketDetails.rows[0].pricing_name} ticket(${ticket}) to you for the ${ticketDetails.rows[0].regime_name} event.`,
      html: `
                                  <h3 style="color: #111827;">Hey ${beneficiaryDetails.rows[0].user_name},</h3>
                                  <p style="color: #374151;">
                                  ${userName} transferred one ${ticketDetails.rows[0].pricing_name} ticket(${ticket}) to you for the ${ticketDetails.rows[0].regime_name} event...
                                  </p>
                                  <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`,
    };

    await Helpers.sendMail({
      email: mailOptions.to,
      subject: mailOptions.subject,
      mailBodyText: mailOptions.text,
      mailBodyHtml: Helpers.mailHTMLBodyLayout({
        subject: mailOptions.subject,
        body: mailOptions.html,
      }),
    });

    // insert ticket edit into logs
    return await Log.ticketEditLogs(
      {
        req,
        res,
        logResponse: {
          message: `Ticket transfer successful, ${capitalize(
            beneficiaryDetails.rows[0].user_name
          )} now owns this ticket`,
          data: {
            ticket,
            beneficiary,
          },
        },
      },
      {
        sender: email,
        beneficiary,
        ticket,
        status: "success",
        date: currentDate,
        name: "Ticket transfer",
      }
    );
  } catch (error) {
    // insert ticket edit into logs
    return await Log.ticketEditLogs(
      { req, res, logStatusCode: 500 },
      {
        sender: email,
        beneficiary,
        ticket,
        status: "failed",
        errorMessage: error.message,
        date: currentDate,
        name: "Ticket transfer",
      }
    );
  }
};
