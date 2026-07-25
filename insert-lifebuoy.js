const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_EwjHted5c6GA@ep-sweet-heart-axhzr84r-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
});

(async () => {
  await client.connect();

  await client.query(`
    INSERT INTO products
    (name, barcode, category_id, cost_price, selling_price, stock, min_stock_level, is_active)
    VALUES
    ('Lifebuoy Total 10', '6001087358613', 5, 20.00, 30.00, 20, 5, true)
    ON CONFLICT (barcode) DO NOTHING;
  `);

  console.log("Product inserted.");
  await client.end();
})();
