BEGIN;

CREATE SEQUENCE "orders_order_number_seq" AS BIGINT START WITH 1;

DROP INDEX "orders_orderNumber_key";

WITH numbered_orders AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS sequence_number
    FROM "orders"
)
UPDATE "orders" AS existing_order
SET "orderNumber" = numbered_orders.sequence_number::TEXT
FROM numbered_orders
WHERE existing_order."id" = numbered_orders."id";

CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

SELECT setval(
    '"orders_order_number_seq"',
    (SELECT COUNT(*) + 1 FROM "orders"),
    false
);

COMMIT;
