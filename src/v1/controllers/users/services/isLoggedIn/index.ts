import { Response } from "express";
import { ExtendedRequest } from "../../../../../utilities/authenticateToken/authenticateToken.dto";

const isLoggedIn = async (req: ExtendedRequest, res: Response) => {
  const user = req.user;
  // console.log(req);

  if (!user) {
    return res.status(401).json({ message: "Sorry i know you not." });
  }

  return res
    .status(200)
    .json({ message: `${req.firstName} ${req.lastName} is logged in.` });
};

export { isLoggedIn };
