import { Request } from "express";
import clientPromise from "../../../../monogDB";
import { AuditLogs } from "./auditLogs";
import { ExtendedRequest } from "../../../authenticateToken/authenticateToken.dto";
import IPinfoWrapper, { IPinfo } from "node-ipinfo";

export const getClientIp = (req: Request | ExtendedRequest) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ipinfoWrapper = new IPinfoWrapper(process.env.IPINFO_TOKEN);
  let ip: string;
  let ipLookUp: IPinfo;

  if (forwarded && typeof forwarded === "string") {
    ip = forwarded.split(",")[0];
  } else if (forwarded && typeof forwarded !== "string") {
    ip = forwarded[0].split(",")[0];
  } else {
    ip = req.ip;
  }

  ipinfoWrapper.lookupIp(ip).then((response: IPinfo) => {
    ipLookUp = response;
  });

  return {
    ip: ip,
    ipLookUp,
  };
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

  // insert audit log
  await db.collection("auditLogs").insertOne({
    user,
    action,
    details,
    endPoint,
    date,
    metaData,
  });
};
