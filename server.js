import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
dayjs.extend(duration);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security & logging
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// DB pool
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'postgres',
  max: 10,
  idleTimeoutMillis: 30000
});

// Utilities
function fmtPercent(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toFixed(1) + '%';
}

function fmtInt(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return new Intl.NumberFormat('es-CL').format(Number(n));
}

function fmtDate(dt) {
  if (!dt) return '-';
  return dayjs(dt).format('DD/MM/YYYY HH:mm:ss');
}

function fmtInterval(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n <= 0) return '00:00:00';
  const sec = Math.floor(n / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

app.get('/', async (req, res) => {
  const from = new Date(); // o usa req.query.from || process.env.DEFAULT_FROM
  const muestra = req.query.muestra; 
  const cte = `
    WITH agg AS (
      SELECT
        lr.request,
        lr.sales_order,
        CASE WHEN lr.type_document='B' THEN CONCAT('10',lr.documentno::varchar) ELSE lr.documentno::varchar END as documentno,
        lr.type_document,
        COUNT(DISTINCT lr.ean)          AS sku_distintos,
        SUM(lr.qty)                     AS total_qty,
        SUM(COALESCE(lr.qty_request,0)) AS total_qty_request,
        (SUM(COALESCE(lr.qty_request,0)) / SUM(lr.qty))*100  as avance,
        MIN(lr.assigned_at)             AS desde_asignado,
        MAX(lr.updated_at)              AS hasta_actualizado,
        (EXTRACT(EPOCH FROM (MAX(lr.updated_at) - MIN(lr.assigned_at))) * 1000)::bigint AS tiempo_total_ms,
        (MAX(lr.updated_at) - MIN(lr.assigned_at)) AS t_txt,
        (SELECT CONCAT(t.name,' ',t.lastname) from "user" t where t.id=lr."userId" ) as asignadoa
      FROM log_request lr
      WHERE lr.assigned_at >= $1::date
      GROUP BY lr.request, lr.sales_order, lr.documentno, lr.type_document,lr."userId" 
    )
  `;

  const sqlRows = cte + `
    SELECT * FROM agg
    ORDER BY  avance ASC,request ASC;
  `;

  const sqlAvg = cte + `
    SELECT
      AVG(tiempo_total_ms)::float AS avg_tiempo_total_ms,
      to_char(
        justify_hours(make_interval(secs => AVG(tiempo_total_ms)/1000)),
        'HH24:MI:SS'
      ) AS avg_tiempo_total_txt
    FROM agg;
  `;

  const sqlCount = cte + `SELECT COUNT(*)::bigint AS total FROM agg;`;

  try {
    const [rowsRes, avgRes, countRes] = await Promise.all([
      pool.query(sqlRows, [from]),
      pool.query(sqlAvg, [from]),
      pool.query(sqlCount, [from])
    ]);
    const font = Number(req.query.font) || 18;   // default 18px

    const rows = rowsRes.rows;
    const total = Number(countRes.rows[0]?.total || 0);
    const avgTiempoTotalMs  = Number(avgRes.rows[0]?.avg_tiempo_total_ms || 0);
    const avgTiempoTotalTxt = avgRes.rows[0]?.avg_tiempo_total_txt || '00:00:00';
    res.render('index', {
      rows,
      from,
      total,
      avgTiempoTotalMs,
      avgTiempoTotalTxt,
      helpers: { fmtPercent, fmtInt, fmtDate, fmtInterval },
      muestra: muestra==='1',
      font 
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { error: err });
  }
});


// Health
app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ Monitor escuchando en http://localhost:${PORT}`);
});
