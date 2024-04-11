import { RegimeType } from "../v1/controllers/users/services/events/create_events_types";

/**
 * Checks whether the provided regime type is valid.
 * @param regimeType The regime type to validate.
 * @returns A boolean value indicating whether the regime type is valid.
 */
export const isValidRegimeType = (
  regimeType: string
): { status: boolean; message: string } => {
  const allTypes =
    "concert, conference, theatre, pageantry, service, education, carnival, festival, party, sport, talent-show";
  const validRegimeTypes: RegimeType[] = [
    "concert",
    "conference",
    "theatre",
    "pageantry",
    "service",
    "education",
    "carnival",
    "festival",
    "party",
    "sport",
    "talent-show",
  ];

  return {
    status: validRegimeTypes.includes(regimeType.toLowerCase() as RegimeType),
    message: `Invalid regime type, regimeType field should contain any of this values: ${allTypes}.`,
  };
};
