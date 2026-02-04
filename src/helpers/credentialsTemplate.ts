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

export const mailHTMLBodyLayout = ({ subject, body }) => {
  return `
          <!DOCTYPE html>
          <html lang="en" style="margin: 0; padding: 0; background-color: #f9fafb;">
            <head>
              <meta charset="UTF-8" />
              <title>Reventlify - ${subject}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </head>
            <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
              <table
                align="center"
                border="0"
                cellpadding="0"
                cellspacing="0"
                width="100%"
                style="max-width: 600px; background-color: #ffffff; margin: 2rem auto; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);"
              >
                <tr style="background-color: #6366f1;">
                  <td align="center" style="padding: 15px;">
                    <img
                      src="https://reventlify.com/img/Reventlify.png"
                      alt="Reventlify Logo"
                      width="75"
                      height="75"
                      style="display: block; margin: auto; border-width: 1px; border-radius: 9999px;"
                    />
                    <h3 style="color: white;">Reventlify</h3>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px;">
                    ${body}
                  </td>
                </tr>
                <tr style="background-color: #f3f4f6;">
                  <td style="padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    &copy; ${new Date().getFullYear()} Reventlify. All rights reserved.
                  </td>
                </tr>
              </table>
            </body>
          </html>

  `;
};
