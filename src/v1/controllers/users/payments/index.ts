import { Request, Response } from "express";
import { createHmac } from "node:crypto";
import * as tickets from "./tickets";
import Log from "../../../../utilities/logger";
import { getClientIp } from "../../../../utilities/logger/allLogs";

export const paystackWebhook = async (req: Request, res: Response) => {
  const currentDate = new Date();
  const { ip, ipLookUp } = await getClientIp(req);
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");
  // Retrieve the request's body
  const event = req.body;

  const { reference } = event.data;
  const {
    buyerId: userId,
    regimeId,
    pricingId,
    affiliateId,
    numberOfTickets,
    transactionType,
    transactionId,
  } = event.data.metadata.data;

  const paymentStatus = event.data.status;

  // converts it to naira
  const realAmount = Number(event.data.amount) / 100;
  const amount = Number(event.data.amount) / 100 / Number(numberOfTickets);
  try {
    if (hash == req.headers["x-paystack-signature"]) {
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
          transactionId,
          numberOfTickets,
          transactionType,
        });

        return await Log.paystackEditLogs(
          {
            req,
            res,
            logResponse: ticketPurchase.message,
            logStatusCode: ticketPurchase.status,
          },
          {
            actor: "api.paystack.co",
            regimeId,
            pricingId,
            transactionId,
            message: ticketPurchase.message,
            status: ticketPurchase.status === 200 ? "success" : "failed",
            date: currentDate,
            action: "Ticket Purchase Paystack",
            requestBody: event,
          }
        );
      }
    } else {
      await Log.auditLogs({
        user: ip,
        action: "Ticket Purchase Paystack",
        details:
          "Get a life, stealing is not good. Go and learn a decent skill or trade or something... 😒👎",
        endPoint: "v1/user/ticket/purchase/paystack-webhook",
        date: currentDate,
        metaData: {
          ipAddress: ip,
          location: ipLookUp,
        },
      });
      return res.status(400).json({
        message:
          "Get a life, stealing is not good. Go and learn a decent skill or trade or something... 😒👎",
      });
    }
  } catch (error) {
    return await Log.paystackEditLogs(
      {
        req,
        res,
        logResponse: error.message,
        logStatusCode: 500,
      },
      {
        actor: "api.paystack.co",
        regimeId,
        pricingId,
        transactionId,
        message: error.message,
        status: "failed",
        date: currentDate,
        action: "Ticket Purchase Paystack",
        requestBody: event,
      }
    );
  }
};
