import axios from "axios";
import { pool } from "../../../db";
import moment from "moment";

const instaRefreshCron = async () => {
  try {
    // Get current date
    const currentDate = moment().format("YYYY-MM-DD");

    // Query the database to retrieve access tokens that match the criteria
    const queryResult = await pool.query(`
        SELECT id, access_token, created_at
        FROM access_tokens
        WHERE media_type = 'instagram' 
        AND expires_in_days = 59
      `);

    const tokensToUpdate = queryResult.rows;
    console.log(tokensToUpdate);
    

    // Iterate through the retrieved access tokens and refresh each one
    for (const token of tokensToUpdate) {
      // Calculate the difference in days between currentDate and created_at
      const createdAtDate = moment(token.created_at).format("YYYY-MM-DD");
      const daysDifference = moment(currentDate).diff(createdAtDate, "days");

      if (daysDifference >= 59) {
        const oldAccessToken = token.access_token;
        const resp = await axios.get(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${oldAccessToken}`
        );

        if (resp.data.access_token) {
          const newAccessToken = resp.data.access_token;
          // Update the access token in the database
          await pool.query(
            `
              UPDATE access_tokens
              SET access_token = $1, modified_at = CURRENT_TIMESTAMP
              WHERE id = $2
            `,
            [newAccessToken, token.id]
          );
        }
      }

      return console.log("Criteria matched");
    }
    return console.log("Criteria not matched");
  } catch (e) {
    console.log("Error=====", e.response.data);
    return console.log("Error");
  }
};

export default instaRefreshCron;
