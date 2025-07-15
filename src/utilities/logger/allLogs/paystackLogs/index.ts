import clientPromise from "../../../../mongoDB";
import { ReturnResponse } from "../allLogs";
import { PaystackEditLogs } from "./paystackLogs";

export const paystackEditLogs = async (
  { res, logStatusCode }: ReturnResponse,
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
    res.send(logStatusCode);
  }
};
