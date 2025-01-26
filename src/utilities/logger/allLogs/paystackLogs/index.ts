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
  const currentDate = new Date();
  const timestamp = Math.floor(currentDate.getTime() / 1000);
  const indexes = await db.collection("paystackLogs").listIndexes().toArray();

  const findIndex = (fieldToIndex: string) =>
    indexes.find((index: any) => index?.key?.[fieldToIndex] > 0);

  if (!findIndex("timestamp")?.name) {
    await db.collection("paystackLogs").createIndex({ timestamp: 1 });
  }

  // insert payment into logs
  await db.collection("paystackLogs").insertOne({
    actor,
    regimeId,
    pricingId,
    transactionId,
    message,
    status,
    date: date ?? currentDate,
    timestamp,
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
    res.send(logStatusCode);
  }
};
