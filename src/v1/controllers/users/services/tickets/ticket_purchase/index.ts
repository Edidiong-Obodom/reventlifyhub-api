import { Response } from "express";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";
import * as Helpers from "../../../../../../helpers";
import { pool } from "../../../../../../db";
import axios from "axios";

export const ticketPurchase = async (req: ExtendedRequest, res: Response) => {
  const user = req.user;
  const email = req.email;
  const field = ["amount", "pricingId", "regimeId", "affiliate", "counter"];

  // check data for each field in the request query param and validate format
  const requiredFields = Helpers.requiredFields(req.body, field);

  if (!requiredFields.success) {
    return res.status(400).json({ message: requiredFields.message });
  }

  // request body from the clients
  const { amount, pricingId, regimeId, affiliate, counter, ...rest } = req.body;

  // Check if there are any additional properties in the request query param
  const extraFields = Helpers.noExtraFields(rest);

  if (!extraFields.success)
    return res.status(400).json({ message: extraFields.message });

  if (counter > 10)
    return res.status(400).json({
      message: "You can not purchase more than 10 tickets at a time.",
    });

  try {
    // Check if regime exists
    const regime = await Helpers.getData("regimes", "id", regimeId);

    if (regime.rows.length === 0) {
      return res.status(400).json({ message: "Regime does not exist." });
    }

    // Check if pricing exists
    const pricing = await Helpers.getData("pricings", "id", pricingId);

    if (pricing.rows.length === 0) {
      return res.status(400).json({ message: "Pricing does not exist." });
    }

    const pricingAmount = await Helpers.getData_AndOperation(
      "pricings",
      ["id", "amount"],
      [pricingId, amount]
    );

    if (pricingAmount.rows.length === 0) {
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
      return res.status(400).json({
        message:
          "You can't own more than 10 tickets for any event. You already own " +
          tickets +
          " ticket(s).",
      });
    }

    // params
    const params = JSON.stringify({
      email: email,
      amount: Number(amount) * 100,
      metadata: {
        data: {
          regimeId: regimeId,
          pricingId: pricingId,
          affiliateId: affiliate,
          buyerId: user,
          numberOfTickets: counter,
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

    return res.status(200).json({
      authorization_url: response.data.data.authorization_url,
      data: {
        amount,
        pricingId,
        regimeId,
        affiliate,
        counter,
        available_tickets: parseFloat(regimePricing.rows[0].available_seats),
      },
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};
