# SweForms orders

The private Swedish order board runs on a Cloudflare Worker with D1 and Cloudflare Access. A signed Stripe Checkout event adds each paid session once. The owner moves the order through Nya, Packade and Skickade and can undo a status move. The board refreshes each minute. The Stripe payment link opens the payment and its associated details in the authenticated Stripe Dashboard. Customer names, addresses and card details are not stored in D1.

## Publish the private board before enabling payments

Use a dedicated Worker and D1 database. A `workers.dev` address can serve as the initial private address. Create the database, fill in the binding in `wrangler.toml`, and apply the migration. Deploy with no Stripe signing secret. The board stays locked until both the Access application audience and the exact owner email are configured. Enable Cloudflare Access for the entire Worker, allow only the owner, and verify the result with an authenticated owner session and a signed-out browser session. Leave the webhook behind Access until Stripe is configured.

## Set up a Stripe test environment

The owner can use **Testköp** on the private board before connecting Stripe. The
test checkout creates a labeled SEK 0 order and uses the same status workflow.
To enable owner notifications for these orders, set the Worker secret
`RESEND_API_KEY` to a sending-only Resend key. The default test sender is
`onboarding@resend.dev` and the only recipient is `OWNER_EMAIL`, which must
match the email registered in Resend for the test sender. Use a fresh test order
after configuring the key. The page reports whether Resend accepted the
message. Verify actual delivery in the inbox.

1. Create a D1 database for test orders. Copy `wrangler.example.toml` to `wrangler.toml` and enter the database ID. Run `npx wrangler d1 migrations apply DB --remote` from this directory.
2. Attach a test hostname to the Worker. Protect it with a Cloudflare Access self-hosted app and an Allow policy for the owner's exact email. Set `ACCESS_AUD` to the app's audience tag and `OWNER_EMAIL` to that same email. This Worker uses `ctx.access` directly, without static assets or a service binding.
3. Configure a more specific Access application for exactly `/stripe-webhook` with a Bypass policy so Stripe can deliver events. Keep the rest of the hostname behind Access. The Worker requires a valid Stripe signature for the webhook and owner authentication for the board and all status changes.
4. In the SweForms Stripe test environment, create a snapshot webhook endpoint for `checkout.session.completed` and `checkout.session.async_payment_succeeded` at `https://<test-host>/stripe-webhook`. Store its signing secret with `npx wrangler secret put STRIPE_WEBHOOK_SECRET`. Deploy with `npx wrangler deploy`.
5. Check the hostname without a session and as the owner. Complete a test purchase with a test Payment Link. Verify the new order, move it to Packade, resend the original event in Stripe, and check the order remains Packade. Mark it Skickade and check the Stripe link.

For production, use a separate Worker, database, Access audience and Stripe endpoint. Set `STRIPE_MODE` to `live`, configure the dedicated hostname (suggested: `order.sweforms.se`), and store that endpoint's own signing secret. Keep runtime credentials out of GitHub. The static customer site needs no order board link or server configuration.

References: [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/), [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).
