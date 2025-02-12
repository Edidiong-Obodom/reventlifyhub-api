/**
 * Handles the status of Paystack events, particularly focusing on refund-related events.
 *
 * @param {string} theEvent - The event type received from Paystack. Typically includes information about the nature of the transaction (e.g., "refund").
 * @param {string} theStatus - The status of the event as reported by Paystack. Common statuses include "processed" and "failed".
 * @returns {Object} An object containing:
 *    - `description` {string}: A human-readable explanation of the event status.
 *    - `status` {string}: The original status passed to the function.
 *
 * The function processes the event and status as follows:
 * - If the event type includes "refund" and the status is "processed", it returns an object with a description indicating that the transaction failed and the money has been refunded.
 * - If the event type includes "refund" and the status is "failed", it returns an object with a description indicating that the transaction failed and the money has not been refunded.
 * - For any other combination of event type and status, it returns an object with a description indicating that the status is pending.
 *
 * Example usage:
 *
 * const result = paystackStatusHandler('refund', 'processed');
 * console.log(result); // { description: "failed, and money refunded", status: "processed" }
 */
export const paystackStatusHandler = (theEvent: string, theStatus: string) => {
  if (theEvent.includes("refund") && theStatus.toLowerCase() === "processed") {
    return {
      description: "failed, and money refunded",
      status: theStatus,
    };
  } else if (
    theEvent.includes("refund") &&
    theStatus.toLowerCase() === "failed"
  ) {
    return {
      description: "failed, and money not refunded",
      status: "failed",
    };
  }
  return {
    description: "pending",
    status: theStatus,
  };
};

/**
 * Calculates the charges for a transaction including the Paystack charge and a custom charge based on ticket prices.
 *
 * @param {number} moneyTotal - The total amount of money involved in the transaction.
 * @param {number} amountOfTickets - The number of tickets being purchased.
 * @param {number} ticketPrice - The price of a single ticket.
 * @returns {{ paystackCharge: number; charge: number }} An object containing the Paystack charge and the custom charge.
 *
 * The function calculates the Paystack charge based on the total amount of money involved in the transaction:
 * - If the money total is less than 2500, the charge is 1.5% of the total.
 * - If the money total is between 2500 and 125500, the charge is 1.5% of the total plus an additional 100 Naira.
 * - If the money total exceeds 125500, the charge is a flat rate of 2000 Naira.
 *
 * The custom charge is determined based on the price of a single ticket:
 * - If the ticket price is 1000 Naira or less, the charge is 100 Naira per ticket.
 * - If the ticket price is between 1001 and 5999 Naira, the charge is 300 Naira per ticket.
 * - If the ticket price is 5000 Naira or more, the charge is 5% of the ticket price per ticket.
 *
 * @example
 * // Calculate charges for a transaction with a total of 3000 Naira, 2 tickets, each costing 1500 Naira.
 * const result = chargeHandler(3000, 2, 1500);
 * console.log(result);
 * // Output: { paystackCharge: 145, charge: 400 }
 */

export const chargeHandler = (
  moneyTotal: number,
  amountOfTickets: number,
  ticketPrice: number
): {
  paystackCharge: number;
  charge: number;
  companyCharge: number;
  affiliateCharge: number;
} => {
  let paystackCharge;
  //   Actual charge paystack takes per transaction
  const actualCharge = () => {
    if (moneyTotal < 2500) {
      paystackCharge = (moneyTotal * 1.5) / 100;
    } else if (moneyTotal >= 2500 && moneyTotal <= 125500) {
      paystackCharge = (moneyTotal * 1.5) / 100 + 100;
    } else {
      paystackCharge = 2000;
    }
  };

  actualCharge();
  let charge = 0;
  let profit = 0;
  let affiliateCharge = 0;
  let companyCharge = 0;

  //   return actual charge and our own charge
  if (ticketPrice <= 1000) {
    charge = 100 * amountOfTickets;
    profit = charge - paystackCharge;
    affiliateCharge = profit / 2;
    companyCharge = profit / 2;
    return {
      paystackCharge,
      charge,
      affiliateCharge,
      companyCharge,
    };
  } else if (ticketPrice > 1000 && ticketPrice <= 5999) {
    charge = 300 * amountOfTickets;
    profit = charge - paystackCharge;
    affiliateCharge = profit / 2;
    companyCharge = profit / 2;
    return {
      paystackCharge,
      charge,
      affiliateCharge,
      companyCharge,
    };
  } else {
    charge = ((ticketPrice * 5) / 100) * amountOfTickets;
    profit = charge - paystackCharge;
    affiliateCharge = profit / 2;
    companyCharge = profit / 2;
    return {
      paystackCharge,
      charge,
      affiliateCharge,
      companyCharge,
    };
  }
};
