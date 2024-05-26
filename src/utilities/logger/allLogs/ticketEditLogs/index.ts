import { capitalize } from "lodash";
import Log from "../..";
import clientPromise from "../../../../monogDB";
import { TicketEditLogs } from "./ticketEditLogs";
import { ReturnResponse } from "../allLogs";
import { getClientIp } from "../auditLogs";

export const ticketEditLogs = async (
  { req, res, logResponse, logStatusCode, endPoint }: ReturnResponse,
  {
    sender,
    beneficiary,
    status,
    ticket,
    errorMessage,
    date,
    name,
  }: TicketEditLogs
) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // insert ticket edit into logs
  await db.collection("ticketEditLogs").insertOne({
    sender,
    beneficiary,
    ticket,
    status,
    errorMessage,
    date,
    name,
  });

  // Also a response and auto log if you want
  if (res) {
    const actionSplit = name.split(" ");
    const { ip, ipLookUp } = await getClientIp(req);
    const {
      city,
      region,
      country,
      continent,
      org,
      timezone,
      countryCode,
      countryCurrency,
    } = ipLookUp;
    console.log("check");

    console.log(
      city,
      region,
      country,
      continent,
      org,
      timezone,
      countryCode,
      countryCurrency
    );

    await Log.auditLogs({
      user: sender,
      action: name,
      details: errorMessage || status,
      endPoint: endPoint || `api/v1/user/ticket/${actionSplit[1]}`,
      date,
      metaData: {
        ipAddress: ip,
        location: {
          city,
          region,
          country,
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
