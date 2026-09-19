# CD_ADMIN Frontend

Separate React/Vite administration frontend for Creator's Desk.

## Local setup

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5174` by default.

Set `VITE_ADMIN_API_URL` when the Admin API is not the local API Gateway:

```env
VITE_ADMIN_API_URL=http://localhost:5000/api/admin
```

The frontend uses cookie-based admin sessions. It does not store admin session tokens in localStorage.
