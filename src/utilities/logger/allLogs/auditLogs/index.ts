import { Request } from "express";
import clientPromise from "../../../../mongoDB";
import { AuditLogs } from "./auditLogs";
import { getIp } from "../../../../helpers";

const IP2LOCATION_KEY = process.env.IP2LOCATION_KEY;
const TWO_MONTHS_IN_SECONDS = 60 * 60 * 24 * 60;

export interface IPInfo {
  ip: string;
  country_code: string;
  country_name: string;
  region_name: string;
  city_name: string;
  latitude: number;
  longitude: number;
  zip_code: string;
  time_zone: string;
  asn: string;
  as: string;
  is_proxy: boolean;
  lastLookup: number; // Unix timestamp in seconds
  upsertAt: Date;
}

export const getClientIp = async (req: Request) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const { ip } = getIp(req);
  let finalIp = ip;

  // IP info collection
  const ipInfoCollection = db.collection("ipInfo");
  // const indexes = await ipInfoCollection.indexes();

  // const hasIpIndex = indexes.some((index) => index.key && index.key.ip === 1);

  // if (!hasIpIndex) {
  //   await ipInfoCollection.createIndex({ ip: 1 });
  // }

  // fallback (optional): hard-coded fallback IP for localhost
  if (!ip || ip.startsWith("127.") || ip === "::1") {
    finalIp = "8.8.8.8";
  }

  const now = Math.floor(Date.now() / 1000);

  const existing = (await ipInfoCollection.findOne({
    ip: finalIp,
  })) as unknown as IPInfo;

  if (existing && now - existing.lastLookup < TWO_MONTHS_IN_SECONDS) {
    return {
      ip: finalIp,
      ipLookUp: existing,
    };
  }

  const apiUrl = `https://api.ip2location.io/?key=${IP2LOCATION_KEY}&ip=${finalIp}`;
  const res = await fetch(apiUrl);
  const data = (await res.json()) as Partial<IPInfo>;

  if (!res.ok) {
    return {
      ip: finalIp,
      ipLookUp: existing ?? {}, // fallback empty
    };
  }

  const enrichedData = {
    ...data,
    ip: finalIp,
    lastLookup: now,
    upsertAt: new Date(),
  };

  await ipInfoCollection.updateOne(
    { ip: finalIp },
    { $set: enrichedData },
    { upsert: true }
  );

  return {
    ip: finalIp,
    ipLookUp: enrichedData,
  };
};

export const auditLogs = async ({
  req,
  user,
  action,
  details,
  endPoint,
  date,
  metaData,
  method,
  userAgent,
  statusCode,
  duration,
}: AuditLogs) => {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const currentDate = new Date();
  const timestamp = Math.floor(currentDate.getTime() / 1000);
  const auditLogsCollection = db.collection("auditLogs");
  // const indexes = await auditLogsCollection.listIndexes().toArray();
  let ip: string;
  let ipLookUp: Partial<IPInfo>;

  if (req) {
    const { ip: getIp, ipLookUp: lookUpIp } = await getClientIp(req);
    ip = getIp;
    ipLookUp = lookUpIp;
  }
  const shouldUseIpMeta = !metaData || Object.keys(metaData).length === 0;
  if (!req && shouldUseIpMeta) {
    throw new Error(
      "Audit Log Error: If req is empty metaData cannot also be empty"
    );
  }
  // const findIndex = (fieldToIndex: string) =>
  //   indexes.find((index: any) => index?.key?.[fieldToIndex] > 0);

  // if (!findIndex("timestamp")?.name) {
  //   await auditLogsCollection.createIndex({ timestamp: 1 });
  // }

  // insert audit log
  await auditLogsCollection.insertOne({
    user: user ?? ip,
    action,
    details,
    endPoint,
    date: date ?? currentDate,
    timestamp,
    metaData: shouldUseIpMeta ? { ip, ...ipLookUp } : metaData,
    method,
    userAgent,
    statusCode,
    duration,
  });
};
