export const mailCredentials = {
  service: "Outlook365",
  host: "smtp.office365.com",
  secure: false, // true for 465, false for other ports
  // logger: true,
  // debug: true,
  port: 578,
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false,
  },
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL,
  },
};
