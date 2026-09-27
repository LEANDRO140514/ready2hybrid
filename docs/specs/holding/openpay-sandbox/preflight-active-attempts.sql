-- Read-only. Run before 0032. Do not delete or update rows from this file.
-- Any row here blocks the partial unique index. Leave the data and report it.

SELECT order_id, count(*) AS open_attempts
FROM public.payments
WHERE normalized_state IN ('UNKNOWN', 'PENDING')
  AND order_id IS NOT NULL
GROUP BY order_id
HAVING count(*) > 1
ORDER BY order_id;

SELECT o.id AS order_id, count(p.id) AS approved_payments
FROM public.orders o
JOIN public.payments p ON p.order_id = o.id AND p.normalized_state = 'APPROVED'
WHERE o.state = 'PAID'
GROUP BY o.id
HAVING count(p.id) <> 1
ORDER BY o.id;
