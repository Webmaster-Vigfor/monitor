# Monitor Log Request (Node.js + EJS) — con paginación

Monitor web para el query agregado sobre `log_request`, pensado para mostrar a clientes.

## 🚀 Requisitos
- Node.js 18+
- Acceso a PostgreSQL
- Variables de entorno configuradas

## ⚙️ Configuración
Crea un archivo `.env` en la raíz con:
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=postgres
# Fecha por defecto para el filtro
DEFAULT_FROM=2025-09-25
```

## ▶️ Ejecutar
```bash
npm install
npm run start
# o en desarrollo:
npm run dev
```

Abre http://localhost:3000

## 🔎 Filtros & paginación
- `from` (YYYY-MM-DD) filtra `assigned_at >= from`
- `page` (1..N) y `pageSize` (10,20,50,100)
- Auto refresh cada 30s (puedes cambiarlo en `views/partials/layout.ejs`)
