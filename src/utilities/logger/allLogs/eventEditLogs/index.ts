import { capitalize } from "lodash";
import Log from "../..";
import clientPromise from "../../../../mongoDB";
import { ReturnResponse } from "../allLogs";
import { getClientIp } from "../auditLogs";
import { EventEditLogs } from "./eventEditLogs";

export const ticketEditLogs = async (
  { req, res, logResponse, logStatusCode, endPoint }: ReturnResponse,
  {
    actor,
    eventName,
    status,
    ticket,
    errorMessage,
    date,
    action,
  }: EventEditLogs
) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // insert event edit into logs
  await db.collection("eventEditLogs").insertOne({
    actor,
    eventName,
    ticket,
    status,
    errorMessage,
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
      endPoint: endPoint || `api/v1/user/ticket/${actionSplit[1]}`,
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
