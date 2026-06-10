import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export default stripe;

// Create checkout session for company registration (30-day trial then R299/month)
export async function createCompanyCheckoutSession(userId: string, email: string) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'zar',
        product_data: {
          name: 'SupplierAdvisor Business Subscription',
          description: '30-day free trial then R299 per company per month • Unlimited users',
        },
        unit_amount: 29900, // R299.00
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    customer_email: email,
    metadata: { userId },
  });

  return session;
}

// Webhook handler for subscription events (you can expand this later)
export async function handleStripeWebhook(body: any, signature: string) {
  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  // Handle subscription events here (e.g. update Supabase profile)
  console.log('Stripe event received:', event.type);
  return event;
}