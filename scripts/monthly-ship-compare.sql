-- ยอดส่งรายเดือน เทียบ 3 table: SO_ORDER · export_row · mp_line  (ปี 2026)
-- SO_ORDER ไม่มี ship mode → มีแค่ยอดรวม · export / mp_line มีทั้งยอดรวม (pcs) และเฉพาะแอร์ (air)
WITH
-- ship_date ใน SO_ORDER เป็น text → แปลงเป็น date ตามรูปแบบที่เจอ (ไม่ตรงรูปแบบ = NULL ไม่ error)
so0 AS (
  SELECT so_no_doc, qty,
         CASE
           WHEN TRIM(ship_date) ~ '^\d{4}-\d{1,2}-\d{1,2}'       THEN to_date(substring(TRIM(ship_date) from '^\d{4}-\d{1,2}-\d{1,2}'), 'YYYY-MM-DD')
           WHEN TRIM(ship_date) ~ '^\d{1,2}/\d{1,2}/\d{4}'       THEN to_date(substring(TRIM(ship_date) from '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY')
           WHEN TRIM(ship_date) ~ '^\d{1,2}-[A-Za-z]{3}-\d{4}'   THEN to_date(TRIM(ship_date), 'DD-Mon-YYYY')
           WHEN TRIM(ship_date) ~ '^\d{1,2}-[A-Za-z]{3}-\d{2}$'  THEN to_date(TRIM(ship_date), 'DD-Mon-YY')
           WHEN TRIM(ship_date) ~ '^\d{8}$'                      THEN to_date(TRIM(ship_date), 'YYYYMMDD')
         END AS sd
  FROM "ReportDB"."SO_ORDER_NYG_2020_present"
),
so AS (
  SELECT to_char(sd, 'YYYY-MM')    AS ym,
         COUNT(DISTINCT so_no_doc) AS so_cnt,
         SUM(NULLIF(regexp_replace(qty::text, '[^0-9.]', '', 'g'), '')::numeric) AS pcs
  FROM so0
  WHERE sd BETWEEN '2026-01-01' AND '2026-12-31'
  GROUP BY 1
),
ex AS (
  SELECT to_char(ex_fty_date::date, 'YYYY-MM') AS ym,
         COUNT(DISTINCT so_no)                 AS so_cnt,
         SUM(qty_pcs::numeric)                 AS pcs,
         SUM(CASE WHEN UPPER(TRIM(ship_mode)) = 'AIR PREPAID' THEN qty_pcs::numeric END) AS air
  FROM sq_report.export_row
  WHERE ex_fty_date::date BETWEEN '2026-01-01' AND '2026-12-31'
  GROUP BY 1
),
mp AS (
  SELECT to_char(hod_date::date, 'YYYY-MM') AS ym,
         COUNT(DISTINCT so_no)              AS so_cnt,
         SUM(final_pcs::numeric)            AS pcs,
         SUM(CASE WHEN UPPER(TRIM(ship_mode)) = 'AIR PP' THEN final_pcs::numeric END) AS air
  FROM public.mp_line
  WHERE UPPER(TRIM(status)) = 'SHIPPED'
    AND hod_date::date BETWEEN '2026-01-01' AND '2026-12-31'
  GROUP BY 1
),
m AS (SELECT ym FROM so UNION SELECT ym FROM ex UNION SELECT ym FROM mp)
SELECT m.ym                         AS month,
       COALESCE(so.so_cnt, 0)       AS so_order_so,
       COALESCE(so.pcs, 0)          AS so_order_pcs,
       COALESCE(ex.so_cnt, 0)       AS export_so,
       COALESCE(ex.pcs, 0)          AS export_pcs,
       COALESCE(ex.air, 0)          AS export_air,
       COALESCE(mp.so_cnt, 0)       AS mpline_so,
       COALESCE(mp.pcs, 0)          AS mpline_pcs,
       COALESCE(mp.air, 0)          AS mpline_air,
       COALESCE(ex.pcs, 0) - COALESCE(so.pcs, 0) AS pcs_diff_export_vs_so,
       COALESCE(mp.air, 0) - COALESCE(ex.air, 0) AS air_diff_mp_vs_export
FROM m
LEFT JOIN so ON so.ym = m.ym
LEFT JOIN ex ON ex.ym = m.ym
LEFT JOIN mp ON mp.ym = m.ym
ORDER BY m.ym;
