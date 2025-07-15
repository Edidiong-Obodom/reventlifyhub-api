import { Request, Response } from "express";
import axios from "axios";
import { pool } from "../../../../../../db";

const fetchImage = async (req: Request, res: Response) => {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      message: "Unauthorized",
      reason: "User not logged in",
      status: "001",
    });
  }

  try {
    const access_token = await pool.query(
      `SELECT * from access_tokens WHERE user_id = $1 AND media_type = 'instagram'`,
      [user]
    );

    if (!access_token.rows[0]) {
      return res.status(401).json({
        message: "Unauthorized",
        reason: "Null Access token",
        status: "002",
      });
    }

    const { access_token: instaAccessToken } = access_token.rows[0]; // get from DB
    // const resp = await axios.get(
    //   `https://graph.instagram.com/me/media?fields=media_type,permalink,media_url&access_token=${instaAccessToken}`
    // );
    // if (resp.status !== 200) {
    //   console.log(resp);

    //   return res.status(resp.status).json(resp);
    // }
    // console.log(resp.data);

    // const instaPhotos = resp.data.data
    //   .filter((d) => d.media_type === "IMAGE")
    //   .map((d) => d.media_url);
    // const mediaId = resp.data.data
    //   .filter((d) => d.media_type === "IMAGE")
    //   .map((d) => d.id);

    const likes = await axios.get(
      //   `https://graph.instagram.com/17899303310671585/comments?fields=like_count&access_token=${instaAccessToken}`
      `https://www.instagram.com/v1/media/17899303310671585/likers`
    );

    console.log(likes.data);

    // Got insta photos
    return res.status(200).json(likes.data);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export { fetchImage };
