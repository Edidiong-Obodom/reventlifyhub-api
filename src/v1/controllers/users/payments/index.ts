import { Request, Response } from "express";
import { createHmac } from "node:crypto";
import * as tickets from "./tickets";

export const paystackWebhook = async (req: Request, res: Response) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");
  try {
    if (hash == req.headers["x-paystack-signature"]) {
      // Retrieve the request's body
      const event = req.body;
      console.log(event);
      
      const { reference } = event.data;
      const {
        buyerId: userId,
        regimeId,
        pricingId,
        affiliateId,
        numberOfTickets,
        transactionType,
      } = event.data.metadata.data;
      console.log("=========div=======");
      console.log(event.data.metadata.data);
      
      
      const paymentStatus = event.data.status;

      // converts it to naira
      const realAmount = Number(event.data.amount) / 100;
      const amount = Number(event.data.amount) / 100 / numberOfTickets;

      if (transactionType === "ticket-purchase") {
        const ticketPurchase = await tickets.ticket_purchase_paystackWebhook({
          paymentStatus,
          event: event.event,
          realAmount,
          amount,
          reference,
          userId,
          regimeId,
          pricingId,
          affiliateId,
          numberOfTickets,
          transactionType,
        });

        return res
          .status(ticketPurchase.status)
          .json({ message: ticketPurchase.message });
      }
    }
  } catch (error) {
    console.log(error);
    console.log(error.message);
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};
