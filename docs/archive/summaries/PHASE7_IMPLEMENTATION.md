# Phase 7: Payments Integration

## Completed Work
- UI integration stub for Razorpay in `src/components/BookingFlow.tsx`.
- Added option to select "Pay 20% Deposit" or "Pay Full Amount" with dynamic calculations.
- Integrated the Razorpay Checkout JS script into `index.html`.
- Implemented a mock success flow that creates a booking so UI testing is possible without keys.

## Pending Real Integration
To make the Razorpay integration fully functional, the following steps must be completed:

1. **Backend Integration (Supabase Edge Function / Node.js)**
   - Create an endpoint to generate a Razorpay Order ID securely.
   - Use `razorpay` npm package: `const instance = new Razorpay({ key_id: '...', key_secret: '...' })`
   - Call `instance.orders.create({ amount: amountInPaise, currency: 'INR' })`.
   - Return the `order.id` to the frontend.

2. **Frontend Update (`BookingFlow.tsx`)**
   - In `handleSubmit`, search for `TODO: INTEGRATE RAZORPAY HERE`.
   - Uncomment the backend call to fetch the `order_id`.
   - Add your actual Razorpay Key ID where `.key = 'YOUR_RAZORPAY_KEY_ID'` is written.
   - Pass the `order_id` into the Razorpay options object.
   - Remove the fallback mock flow `setTimeout(() => { rzp1.close(); saveBooking(); }, 1500);` and process the booking inside the actual `handler`.

3. **Webhook / Server-side Verification**
   - Create an endpoint to handle Razorpay success webhooks or verify the signature sent back to the `handler` function.
   - Using the `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature`, verify the payment:
     ```javascript
     const crypto = require('crypto');
     const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
     hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
     const generated_signature = hmac.digest('hex');
     if (generated_signature === razorpay_signature) { /* success */ }
     ```

4. **Database Update**
   - Add a `payment_status` column (`pending`, `partial_paid`, `fully_paid`) and `payment_id` to the `bookings` table via a Supabase migration.
   - When verified, update the booking's `payment_status` in Supabase.
