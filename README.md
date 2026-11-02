# Medicine Inventory - Medical-Dental Health Unit (San Carlos Campus)

Dashboard with full CRUD. **Frontend:** React + Vite + Tailwind CSS. **Backend:** Express.js + SQLite (`node:sqlite`, Node 22.5+).

## Features
- Add, edit, delete medicines (name, category, unit, quantity, batch, expiry, reorder level, supplier, remarks)
- Stock in / stock out (dispense) with a stock history log
- Sortable columns, search, status filter, pagination
- Export to Excel (formatted .xlsx) and print-ready inventory report
- Dashboard cards, stock-by-category chart, "Needs attention" panel

## Run
```bash
npm install     # installs the server and builds the React app
npm start       # http://localhost:3000
```
For frontend development: run `npm start` in one terminal and `npm run dev` in another (Vite on http://localhost:5173).

## Project structure
```
server.js      Express API + SQLite
client/        React + Tailwind app (built into client/dist)
```

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/medicines | List medicines |
| GET | /api/stats | Dashboard stats |
| POST | /api/medicines | Create a medicine |
| PUT | /api/medicines/:id | Update a medicine |
| DELETE | /api/medicines/:id | Delete a medicine |
| POST | /api/medicines/:id/stock | Stock in/out `{type:"IN"|"OUT", quantity, note}` |
| GET | /api/transactions | Latest 100 stock movements |
| GET | /api/export.csv | Download inventory as CSV |
