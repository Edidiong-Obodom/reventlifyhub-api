import { Request } from "express";
import clientPromise from "../../../../mongoDB";
import { AuditLogs } from "./auditLogs";
import { ExtendedRequest } from "../../../authenticateToken/authenticateToken.dto";
// import IPinfoWrapper, { IPinfo } from "node-ipinfo";

export const getClientIp = async (req: Request | ExtendedRequest) => {
  const forwarded = req.headers["x-forwarded-for"];
  // const ipInfoWrapper = new IPinfoWrapper(process.env.IPINFO_TOKEN);
  let ip: string;

  console.log("forwarded: ", forwarded);

  if (forwarded && typeof forwarded === "string") {
    ip = forwarded.split(",")[0];
  } else if (forwarded && typeof forwarded !== "string") {
    ip = forwarded[0].split(",")[0];
  } else {
    ip = req.ip;
  }
  return {
    ip: ip,
    ipLookUp: {},
  };

  // return ipInfoWrapper.lookupIp(ip).then((response: IPinfo) => {
  //   return {
  //     ip: ip,
  //     ipLookUp: response,
  //   };
  // });
};

export const auditLogs = async ({
  user,
  action,
  details,
  endPoint,
  date,
  metaData,
}: AuditLogs) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const currentDate = new Date();
  const timestamp = Math.floor(currentDate.getTime() / 1000);
  const indexes = await db.collection("auditLogs").listIndexes().toArray();

  const findIndex = (fieldToIndex: string) =>
    indexes.find((index: any) => index?.key?.[fieldToIndex] > 0);

  if (!findIndex("timestamp")?.name) {
    await db.collection("auditLogs").createIndex({ timestamp: 1 });
  }

  // insert audit log
  await db.collection("auditLogs").insertOne({
    user,
    action,
    details,
    endPoint,
    date: date ?? currentDate,
    timestamp,
    metaData,
  });
};
