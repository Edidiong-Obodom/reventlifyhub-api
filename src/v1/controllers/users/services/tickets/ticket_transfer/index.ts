import { Response } from "express";
import * as nodemailer from "nodemailer";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../helpers";
import { pool } from "../../../../../../db";
import { capitalize } from "lodash";

export const ticketTransfer = async (req: ExtendedRequest, res: Response) => {
  const { user, userName } = req;
  const fields = ["beneficiary", "ticket"];

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
    return res
      .status(400)
      .json({ message: "You can't share a ticket to yourself." });
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
      return res.status(400).json({ message: "User does not exist." });
    }

    if (ticketDetails.rows.length === 0) {
      return res.status(400).json({ message: "Ticket does not exist." });
    }
    const currentDate = new Date();
    const regimeStart = new Date(
      ticketDetails.rows[0].start_date + " " + ticketDetails.rows[0].start_time
    );

    if (currentDate > regimeStart) {
      return res.status(400).json({
        message: "You can't share a ticket after the event has started.",
      });
    }

    await pool.query(
      `UPDATE tickets SET owner_id = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [beneficiary, ticket]
    );

    // Send email notification
    const transporter = nodemailer.createTransport(Helpers.mailCredentials);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: beneficiaryDetails.rows[0].email,
      subject: "Ticket Transfer",
      text: `${capitalize(userName)} transferred one ${
        ticketDetails.rows[0].pricing_name
      } ticket(${ticket}) to you for the ${
        ticketDetails.rows[0].regime_name
      } event.`,
      html: `${capitalize(userName)} transferred one ${
        ticketDetails.rows[0].pricing_name
      } ticket(${ticket}) to you for the ${
        ticketDetails.rows[0].regime_name
      } event.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(`Error sending email: ${error.message}`);
      }
    });

    return res.status(200).json({
      message: `Ticket transfer successful, ${capitalize(
        beneficiaryDetails.rows[0].user_name
      )} now owns this ticket`,
      data: {
        ticket,
        beneficiary,
      },
    });
  } catch (error) {
    console.log(error.message);
    console.log(error);
    return res.status(500).json({ message: "Sorry, something went wrong." });
  }
};
