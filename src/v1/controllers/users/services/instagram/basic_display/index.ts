import { Request, Response } from "express";
import request from "request-promise-native";
import { pool } from "../../../../../../db";

interface InstaInit {
  code: string;
}

interface FormData {
  client_id: string;
  client_secret: string;
  grant_type: string;
  redirect_uri: string;
  code: string;
}

interface InstaBody {
  access_token: string;
  user_id: number;
}

interface InstaBodyLongLive {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface InstaError {
  error_type: string;
  code: number;
  error_message: string;
}

const instagramBasicDisplayInit = async (req: Request, res: Response) => {
  const user = req.user;

  // checks if user is logged in
  if (!user) {
    return res.status(401).json({ message: "Sorry i know you not." });
  }

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUrl = process.env.INSTAGRAM_REDIRECT_URI;

  const requiredFields = ["code"];

  // check data for each field in the body and validate format
  for (const field of requiredFields) {
    if (!req?.body?.[field]) {
      return res.status(400).json({ message: `${field} field is empty.` });
    }
  }

  const { code, ...rest } = req.body as InstaInit & {
    [key: string]: any;
  };

  // Check if there are any additional properties in the request body
  if (Object.keys(rest).length > 0) {
    return res.status(400).json({
      message: "Additional properties in the request body are not allowed.",
    });
  }

  const formData: FormData = {
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUrl,
    code: code,
  };

  const options = {
    url: "https://api.instagram.com/oauth/access_token",
    method: "POST",
    form: formData,
  };

  request(options)
    .then(async (body: any) => {
      const instaBody: InstaBody = JSON.parse(body);

      // Gets Short-Lived-Access-Token
      const { access_token, user_id } = instaBody;

      // Exchange Short-Lived-Access-Token for Long-Lived-Access-Token
      try {
        const response = await request.get(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${access_token}`
        );
        const longLiveTokenData: InstaBodyLongLive = JSON.parse(response);

        const { access_token: longLivedAccessToken, expires_in } =
          longLiveTokenData;

        // Calculate expiration in seconds and days
        const expires_in_sec = expires_in;
        const expires_in_days = Math.floor(expires_in / (24 * 60 * 60));

        // Save long-lived access token to database
        await pool.query(
          `INSERT INTO access_tokens(user_id, access_token, media_type, expires_in_sec, expires_in_days, media_user_id) 
          VALUES ($1, $2, 'instagram', $3, $4, $5)`,
          [user, longLivedAccessToken, expires_in_sec, expires_in_days, user_id]
        );

        return res.status(200).json({ longLivedAccessToken });
      } catch (error) {
        console.error("Error exchanging short-lived token:", error);
        return res.status(500).json({ message: "Internal Server Error." });
      }
    })
    .catch((error: any) => {
      const err: InstaError = JSON.parse(error.error);
      console.error("Error:", err);

      if (err.code >= 500) {
        return res.status(500).json({ message: "Internal Server Error." });
      }
      return res.status(err.code).json({ message: err.error_message });
    });
};

export { instagramBasicDisplayInit };
