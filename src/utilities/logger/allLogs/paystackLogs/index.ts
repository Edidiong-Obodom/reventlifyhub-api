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
    errorMessage,
    status,
    date,
    action,
  }: PaystackEditLogs
) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // insert ticket edit into logs
  await db.collection("ticketEditLogs").insertOne({
    actor,
    regimeId,
    pricingId,
    transactionId,
    errorMessage,
    status,
    date,
    action,
  });

  // Also respond and auto log if you want
  if (res) {
    const actionSplit = action.split(" ");
    const { ip, ipLookUp } = await getClientIp(req);
    const {
      city,
      region,
      country,
      loc,
      continent,
      org,
      timezone,
      countryCode,
      countryCurrency,
    } = ipLookUp;

    await Log.auditLogs({
      user: actor,
      action,
      details: errorMessage || status,
      endPoint: "api/v1/user/ticket/purchase/paystack-webhook",
      date,
      metaData: {
        ipAddress: ip,
        location: {
          city,
          region,
          country,
          loc,
          continent,
          org,
          timezone,
          countryCode,
          countryCurrency,
        },
      },
    });
    res
      .status(logStatusCode || status.toLowerCase() === "failed" ? 400 : 200)
      .json(
        logResponse || {
          message: capitalize(errorMessage) || capitalize(status),
        }
      );
  }
};
