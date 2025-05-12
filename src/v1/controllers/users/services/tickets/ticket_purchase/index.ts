import { Response } from "express";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../helpers";
import { pool } from "../../../../../../db";
import axios from "axios";
import { getClientIp } from "../../../../../../utilities/logger/allLogs";
import Log from "../../../../../../utilities/logger";

export const ticketPurchase = async (req: ExtendedRequest, res: Response) => {
  const user = req.user;
  const userName = req.userName;
  const email = req.email;
  const field = ["amount", "pricingId", "regimeId", "counter"];
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);

  // check data for each field in the request query param and validate format
  const requiredFields = Helpers.requiredFields(req.body, field);

  if (!requiredFields.success) {
    return res.status(400).json({ message: requiredFields.message });
  }

  // request body from the clients
  const { amount, pricingId, regimeId, affiliate, counter, ...rest } = req.body;

  // Check if there are any additional properties in the request query param
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success) {
    await Log.auditLogs({
      user: email,
      action: "Ticket Purchase",
      details: extraFields.message,
      endPoint: "v1/user/ticket/purchase",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({ message: extraFields.message });
  }

  if (counter > 10) {
    await Log.auditLogs({
      user: email,
      action: "Ticket Purchase",
      details: "You can not purchase more than 10 tickets at a time.",
      endPoint: "v1/user/ticket/purchase",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(400).json({
      message: "You can not purchase more than 10 tickets at a time.",
    });
  }

  try {
    // Check if regime exists
    const regime = await Helpers.getData("regimes", "id", regimeId);

    if (regime.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "Regime does not exist.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({ message: "Regime does not exist." });
    }

    if (regime.rows[0].status !== "pending") {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "Tickets are not being sold anymore.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res
        .status(400)
        .json({ message: "Tickets are not being sold anymore." });
    }

    // Check if affiliate is a known user
    const affiliateDetails = await Helpers.getData("clients", "id", affiliate);
    if (affiliate && affiliateDetails.rowCount === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "Affiliate does not exist.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({ message: "Affiliate does not exist." });
    }

    // Check if pricing exists
    const pricing = await Helpers.getData("pricings", "id", pricingId);

    if (pricing.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "Pricing does not exist.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({ message: "Pricing does not exist." });
    }

    const pricingAmount = await Helpers.getData_AndOperation(
      "pricings",
      ["id", "amount"],
      [pricingId, amount]
    );

    if (pricingAmount.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "Pricing amount does not match amount given.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res
        .status(400)
        .json({ message: "Pricing amount does not match amount given." });
    }

    // Check if a regime with the pricing exists
    const regimePricing = await Helpers.getData_AndOperation(
      "pricings",
      ["regime_id", "id"],
      [regimeId, pricingId]
    );

    if (regimePricing.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "This pricing does not exist in the regime.",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res
        .status(400)
        .json({ message: "This pricing does not exist in the regime." });
    }

    // Check if the number of tickets is not more than the no of available seats
    const isSeatAvailable = await Helpers.getData_CustomOperation(
      "pricings",
      ["id", "available_seats"],
      [pricingId, counter],
      { ins: ["=", ">="], between: ["AND"] }
    );

    if (isSeatAvailable.rows.length === 0) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details:
          "The number of tickets you want to purchase is more than the number of available seats for this pricing",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "The number of tickets you want to purchase is more than the number of available seats for this pricing",
      });
    }

    const ticketsOwned = await pool.query(
      "SELECT * FROM GetAllTicketsOwned( $1, $2)",
      [user, pricingId]
    );
    const tickets = ticketsOwned.rows.length;

    if (tickets + counter > 10) {
      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details:
          "You can't own more than 10 tickets for any event. You already own " +
          tickets +
          " ticket(s).",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "You can't own more than 10 tickets for any event. You already own " +
          tickets +
          " ticket(s).",
      });
    }

    if (Number(amount) === 0) {
      await pool.query("BEGIN");

      // Insert into transactions table
      const transaction = await pool.query(
        `INSERT INTO transactions 
        (client_id, regime_id, transaction_action, transaction_type, amount, currency, status) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          user,
          regimeId,
          "ticket-purchase",
          "free",
          Number(amount),
          "ngn",
          "success",
        ]
      );
      const transactionId = transaction.rows[0].id;

      // Create tickets
      for (let i = 0; i < counter; i++) {
        await pool.query(
          `INSERT INTO tickets (pricing_id, transaction_id, buyer_id, owner_id, status, affiliate_id) VALUES ($1, $2, $3, $4, $5, $6)`,
          [pricingId, transactionId, user, user, "active", affiliate]
        );
      }

      // Update available seats
      await pool.query(
        `UPDATE pricings SET available_seats = available_seats - $1 WHERE id = $2 RETURNING *`,
        [counter, pricingId]
      );

      await pool.query("COMMIT");

      // Send email notification
      const mailOptions = {
        from: "Reventlify <no-reply@reventlify.com>",
        to: email,
        subject: "Ticket Purchase Successful",
        text: `You have successfully purchased ${counter} ticket(s) for the regime ${regime.rows[0].name}.`,
        html: `
                                  <h3 style="color: #111827;">Hey ${userName},</h3>
                                  <p style="color: #374151;">
                                    You have successfully purchased ${counter} ticket(s) for the regime <strong>${regime.rows[0].name}</strong>, thank you for choosing <strong>Reventlify</strong>.
                                  </p>
                                  <p style="margin-top: 30px; color: #6b7280;">Best regards,<br />The Reventlify Team</p>`,
      };

      await Helpers.sendMail({
        email,
        subject: mailOptions.subject,
        mailBodyText: mailOptions.text,
        mailBodyHtml: Helpers.mailHTMLBodyLayout({
          subject: mailOptions.subject,
          body: mailOptions.html,
        }),
      });

      await Log.auditLogs({
        user: email,
        action: "Ticket Purchase",
        details: "success",
        endPoint: "v1/user/ticket/purchase",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(200).json({
        message: "Tickets successfully created.",
        data: {
          amount,
          pricingId,
          regimeId,
          transactionId,
          counter,
          available_tickets:
            parseFloat(regimePricing.rows[0].available_seats) - counter,
        },
      });
    }

    const realAmount = Number(amount * counter);

    const affiliateId = affiliate && affiliate !== user ? affiliate : "";

    const { charge, paystackCharge, companyCharge, affiliateCharge } =
      Helpers.chargeHandler(realAmount, Number(counter), Number(amount));

    const regimeMoney = realAmount - charge;

    const data = [
      user,
      regimeId,
      "ticket-purchase",
      "inter-debit",
      Number(amount * counter),
      Number(charge - paystackCharge),
      paystackCharge,
      regimeMoney,
      "ngn",
      "pending",
      "Paystack",
    ];

    if (affiliateId) {
      data.push(affiliateId, affiliateCharge);
      data[5] = companyCharge;
    }

    const transaction = await pool.query(
      `INSERT INTO transactions 
      (client_id, regime_id, transaction_action, transaction_type, actual_amount, company_charge, payment_gateway_charge, amount, currency, status, payment_gateway${
        affiliateId ? ", affiliate_id, affiliate_amount" : ""
      }) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11${
        affiliateId ? ", $12, $13" : ""
      }) RETURNING id`,
      data
    );

    const transactionId = transaction.rows[0].id;

    // params
    const params = JSON.stringify({
      email: email,
      amount: Number(amount * counter) * 100,
      metadata: {
        data: {
          regimeId: regimeId,
          pricingId: pricingId,
          affiliateId,
          transactionId,
          buyerId: user,
          numberOfTickets: Number(counter),
          transactionType: "ticket-purchase",
        },
      },
    });

    const response = await axios({
      method: "post",
      url: "https://api.paystack.co/transaction/initialize",
      data: params,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "content-type": "application/json",
        "cache-control": "no-cache",
      },
    });

    const reference = response.data.data.reference;
    const url = response.data.data.authorization_url;
    await pool.query(
      `UPDATE transactions SET transaction_reference = $1, modified_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [reference, transactionId]
    );

    await Log.auditLogs({
      user: email,
      action: "Ticket Purchase",
      details: "success",
      endPoint: "v1/user/ticket/purchase",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(200).json({
      authorization_url: url,
      data: {
        amount,
        pricingId,
        regimeId,
        affiliate,
        transactionId,
        counter,
        available_tickets: parseFloat(regimePricing.rows[0].available_seats),
      },
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    await Log.auditLogs({
      user: email,
      action: "Ticket Purchase",
      details: error.message,
      endPoint: "v1/user/ticket/purchase",
      date: currentDate,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};
