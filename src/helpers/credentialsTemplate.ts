export const mailCredentials = {
  host: "smtp.office365.com",
  port: 578,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL,
  },
};
