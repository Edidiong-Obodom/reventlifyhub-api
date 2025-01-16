import { Response } from "express";
import { ExtendedRequest } from "../../../../../../utilities/authenticateToken/authenticateToken.dto";

// Edit Regime
export const editRegime = async (req: ExtendedRequest, res: Response) => {
  const { user } = req;
  try {
    return res.status(200).json({ message: "" });
  } catch (error) {
    return res.status(500).json({ message: "Oops something went wrong..." });
  }
};
