const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')('sk_test_51RJjXm4RX6e7Tyh3rJVNc1gc3KcH8huJI4f22fWAXAjge83N42EfK5TRlWCJeOrWmEhGTf4ysTAYqh85APlIKuUE0044m9uSk6');
const sgMail = require('@sendgrid/mail');

const app = express();

// Set SendGrid API Key
sgMail.setApiKey('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');

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Root route to handle GET /
app.get('/', (req, res) => {
    res.status(200).send('Vinko Server is running. Use /check-stock or /create-checkout-session for API requests.');
});

// Handle GET /check-stock (for unexpected GET requests)
app.get('/check-stock', (req, res) => {
    res.status(405).send('Method Not Allowed: Use POST to check stock.');
});

// Check stock endpoint (POST)
app.post('/check-stock', (req, res) => {
    const { product, quantity } = req.body;
    if (stock[product] >= quantity) {
        res.json({ success: true });
    } else {
        res.status(400).json({ error: `Insufficient stock for ${product}. Only ${stock[product]} left.` });
    }
});

// Sample stock data
const stock = {
    beanie: 10,
    tee: 15,
    pants: 8,
    shorts: 12,
    hat: 20,
    socks: 30
};

// Create checkout session endpoint
app.post('/create-checkout-session', async (req, res) => {
    const { items } = req.body;

    try {
        // Validate stock
        for (const item of items) {
            if (stock[item.product] < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${item.product}.` });
            }
        }

        // Create line items for Stripe
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: { name: item.product },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        }));

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `https://shopvinko.com/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'https://shopvinko.com/cancel.html',
        });

        // Update stock
        items.forEach(item => {
            stock[item.product] -= item.quantity;
        });

        // Send confirmation email via SendGrid
        const purchasedItems = items.map(item => `${item.product} - $${item.price} x ${item.quantity}`).join('\n');
        const msg = {
            to: 'customer@example.com', // Replace with customer's email (retrieve from checkout session or form)
            from: 'support@shopvinko.com', // Replace with your verified sender email
            subject: 'Vinko Order Confirmation',
            text: `Thank you for your purchase!\n\nOrder Number: ${session.id}\n\nItems Purchased:\n${purchasedItems}\n\nTotal: $${(session.amount_total / 100).toFixed(2)}\n\nWe’ll notify you when your order ships.`,
            html: `<h1>Thank You for Your Purchase!</h1><p><strong>Order Number:</strong> ${session.id}</p><p><strong>Items Purchased:</strong><br>${purchasedItems.replace(/\n/g, '<br>')}</p><p><strong>Total:</strong> $${(session.amount_total / 100).toFixed(2)}</p><p>We’ll notify you when your order ships.</p>`,
        };

        await sgMail.send(msg);
        console.log('Confirmation email sent successfully');

        res.json({ id: session.id });
    } catch (error) {
        console.error('Checkout Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));