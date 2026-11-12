# Studio shop launch

The website is static and uses no payment API keys. Existing Bygg files and shared legacy styles/scripts are unchanged. /form/ and /studio.html lead to /studio/.

## Enable sales
1. Add verified product photographs, specifications, prices, currency, availability and delivery details to studio/butik/index.html. Replace all coming-soon text and the shop notice with accurate information.
2. Publish the actual seller details and approved purchase, delivery, returns and privacy information, linked from the shop.
3. Create the real product and Payment Link in the owner's Stripe dashboard. Configure shipping destinations, delivery address collection, shipping charges, tax treatment and confirmation email there.
4. Verify in Stripe test mode with test payment data, including cancelled and successful checkout. Never use a real card for a test.
5. In studio.js set paymentLink to the verified live https://buy.stripe.com/ URL and ready to true. Test-mode URLs are deliberately rejected by the live URL validator. Confirm the linked Stripe product, price and currency match the website before enabling.
6. Verify the payment in Stripe before fulfilling an order. A browser return URL is not payment proof. There is no automatic fulfilment or shopping cart in this version.

Payment Links documentation: https://docs.stripe.com/payment-links
Never commit secret, restricted or webhook keys. A future cart requires a server to create Checkout Sessions and verify signed webhooks.

## Preview
From repository root: python -m http.server 8765 --bind 127.0.0.1
Visit http://127.0.0.1:8765/ and /studio/ and /studio/butik/.
