import { capitalize } from "lodash";
import Log from "../..";
import clientPromise from "../../../../mongoDB";
import { ReturnResponse } from "../allLogs";
import { getClientIp } from "../auditLogs";
import { PaystackEditLogs } from "./paystackLogs";

export const paystackEditLogs = async (
  { req, res, logResponse, logStatusCode, endPoint }: ReturnResponse,
  {
    actor,
    regimeId,
    pricingId,
    transactionId,
    message,
    status,
    date,
    action,
    requestBody,
  }: PaystackEditLogs
) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // insert payment into logs
  await db.collection("paystackLogs").insertOne({
    actor,
    regimeId,
    pricingId,
    transactionId,
    message,
    status,
    date,
    action,
    requestBody,
  });

  // Also respond and auto log if you want
  if (res) {
    const { ip, ipLookUp } = await getClientIp(req);

    await Log.auditLogs({
      user: actor,
      action,
      details: message || status,
      endPoint: "v1/user/ticket/purchase/paystack-webhook",
      date,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    res
      .status(logStatusCode || status.toLowerCase() === "failed" ? 400 : 200)
      .json(
        logResponse || {
          message: capitalize(message) || capitalize(status),
        }
      );
  }
};
