/**
 * Formats a price in paise into a user-friendly currency string (e.g., 4900 -> ₹49).
 * If the price is 0, it returns a customizable fallback or "Free".
 */
export function formatPaiseToCurrency(
    pricePaise: number,
    currencyCode: string = "INR",
    freeFallback: string = "Free"
): string {
    if (pricePaise === 0) {
        return freeFallback;
    }

    const amount = pricePaise / 100;
    
    // Format options: if amount is a whole number, omit decimals
    const formatter = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    });

    return formatter.format(amount);
}
