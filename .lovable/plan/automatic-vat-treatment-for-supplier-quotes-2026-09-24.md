# Automatic VAT treatment for supplier quotes

## What will change
- Replace the manual **VAT on quote** field in the Purchase Requisition quote card with a **VAT treatment** dropdown.
- Offer, in order: Standard 15% excluding VAT (default), Standard 15% included, Zero-rated, Exempt, Supplier not VAT-registered, and Custom amount.
- Show the VAT amount input only for **Custom amount**.
- Recalculate Subtotal, VAT, and Total instantly when quantity, unit price, or VAT treatment changes, rounded to two decimals.
- Show the selected VAT treatment beside the read-only VAT summary.
- Use one shared South African VAT rate constant rather than repeating 15% in components.

## PR and quote records
- Add `vat_treatment` and `total_amount` to saved supplier quotes.
- Preserve existing quote totals: quotes with VAT already recorded will be marked **Custom amount**; others will use the standard default without rewriting their existing amount.
- Save the calculated VAT and total for every new quote so the PR, audit trail, comparisons, approval amount, and selected supplier all reflect the same VAT-inclusive total.
- Update quote comparisons and summaries to use the saved total, with the existing amount retained as the pre-VAT/subtotal value for compatibility.

## Submission experience
- After a successful Purchase Requisition submission and quote attachment, reset the form and close it immediately.
- Keep the form open if submission or quote saving fails, with the existing visible error messages.

## Validation
- Check all six VAT treatments, including the 120 × ZAR 5,000 standard-rate example.
- Verify totals update live and remain correct after saving/reloading.
- Verify the selected quote total becomes the PR total and is used by comparison and approval screens.
- Verify a successful submission closes the form while a failed submission does not.
