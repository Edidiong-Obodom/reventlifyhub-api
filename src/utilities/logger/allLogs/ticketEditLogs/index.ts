import { capitalize } from "lodash";
import Log from "../..";
import clientPromise from "../../../../mongoDB";
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

  // Also respond and auto log if you want
  if (res) {
    const actionSplit = name.split(" ");
    const { ip, ipLookUp } = await getClientIp(req);

    await Log.auditLogs({
      user: sender,
      action: name,
      details: errorMessage || status,
      endPoint: endPoint || `v1/user/ticket/${actionSplit[1]}`,
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
          message: capitalize(errorMessage) || capitalize(status),
        }
      );
  }
};
