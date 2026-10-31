# Medicine Inventory

Medicine inventory dashboard for the **Medical-Dental Health Unit, San Carlos Campus**, built with **Express.js** and **SQLite** with full CRUD.

**Live demo (static, data saved in your browser):** https://prometheus560.github.io/medicine-inventory/

## Features
- Add, view, edit, and delete medicines (name, category, unit, quantity, batch number, expiry date)
- Dashboard cards: total medicines, units in stock, low stock, expiring within 30 days, expired
- Stock-by-category chart and a "Needs attention" panel
- Search and status filter with color-coded status pills

## Run locally
```bash
npm install
npm start
```
Open http://localhost:3000. The SQLite database (`medicines.db`) is created automatically.

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/medicines | List medicines |
| GET | /api/stats | Dashboard stats |
| POST | /api/medicines | Create a medicine |
| PUT | /api/medicines/:id | Update a medicine |
| DELETE | /api/medicines/:id | Delete a medicine |

## Tech
Node.js, Express.js, SQLite (`node:sqlite`), vanilla HTML/CSS/JS.
