export const mailCredentials = {
  host: "mail.reventlify.com",
  secure: true,
  port: 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL,
  },
  // Increase connection timeout to 20 seconds (20000 milliseconds)
  connectionTimeout: 20000,
};
// export const mailCredentials = {
//   host: "mail.legaleasenaija.com",
//   secure: true,
//   port: 465,
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL,
//   },
//   // Increase connection timeout to 20 seconds (20000 milliseconds)
//   connectionTimeout: 20000,
// };

// export const mailCredentials = {
//   service: "Outlook365",
//   host: "smtp.office365.com",
//   secure: false, // true for 465, false for other ports
//   // logger: true,
//   // debug: true,
//   port: 578,
//   tls: {
//     ciphers: "SSLv3",
//     rejectUnauthorized: false,
//   },
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL,
//   },
// };
