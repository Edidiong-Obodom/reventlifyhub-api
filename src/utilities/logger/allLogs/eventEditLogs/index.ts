import { capitalize } from "lodash";
import Log from "../..";
import clientPromise from "../../../../mongoDB";
import { ReturnResponse } from "../allLogs";
import { getClientIp } from "../auditLogs";
import { EventEditLogs } from "./eventEditLogs";

export const eventEditLogs = async (
  { req, res, logResponse, logStatusCode, endPoint }: ReturnResponse,
  {
    actor,
    actorId,
    eventId,
    eventName,
    status,
    details,
    date,
    data,
    action,
    error,
  }: EventEditLogs
) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);

  // insert event edit into logs
  await db.collection("eventEditLogs").insertOne({
    actorId,
    actor,
    eventId,
    eventName,
    action,
    status,
    details,
    date,
    data,
    error,
  });

  // Also respond and auto log if you want
  if (res) {
    const actionSplit = action.split(" ");
    const { ip, ipLookUp } = await getClientIp(req);

    await Log.auditLogs({
      user: actor,
      action,
      details: details ?? status,
      endPoint: endPoint ?? `v1/user/event/${actionSplit[1].toLowerCase()}`,
      date,
      metaData: {
        ipAddress: ip,
        location: ipLookUp,
      },
    });
    res
      .status(logStatusCode ?? status.toLowerCase() === "failed" ? 400 : 200)
      .json(
        logResponse ?? {
          message: capitalize(details) ?? capitalize(status),
        }
      );
  }
};
