# Desktop frontend

This folder contains the Electron desktop application and its Vite + React UI.
The app opens on a login screen connected to the backend's `POST /users/login`
endpoint.

## Requirements

- Node.js and npm

## Run in development

Start the backend in another terminal from the `backend/` directory:

```powershell
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Then start the desktop frontend:

```sh
npm install
npm run electron:dev
```

Vite serves the UI at `http://127.0.0.1:5173`, and Electron opens it in a
desktop window with live reload. API requests are routed to the Backend API URL
specified in `.env` (`BACKEND_API_URL`), defaulting to `https://oyster-software.onrender.com`.
The development command automatically restarts Electron when a main-process or
preload file changes. API requests and HTTP response statuses are logged in
the terminal running Electron.

Login credentials are sent as JSON. The access and refresh tokens stay in the
Electron main process and are held in memory for the current app session.
Reloading the frontend restores the signed-in user from the Electron main
process. Signing out clears that session; closing and restarting the desktop
application starts a new session.

After login, admins can view the dashboard, supervisors, employees, raw
materials, elements, suppliers, and customers. Supervisors can view the
dashboard, employees, raw materials, elements, suppliers, and customers;
supervisor management is admin-only, matching the backend's role permissions.
Workspace API calls use the authenticated access token, and expired access
tokens are refreshed through `/users/refresh`. The dashboard loads record
counts from each section's backend list endpoint.

The frontend is wired to the backend's available login, refresh, user,
raw-material, element, supplier, and customer endpoints. Records support
listing, creation, editing with PATCH, and soft deletion with DELETE. The
dashboard also checks the backend root health endpoint.

The backend does not currently define any PUT endpoints. The employee list is
loaded through `/users/get-employees`; the backend's legacy misspelled alias
`/users/get-employess` returns the same list.

## Build

```sh
npm run build
```

## Package for Windows

```sh
npm run electron:build
```

The Windows NSIS installer and unpacked application are written to `release/`.
Use `npm run electron:build:dir` to create only the unpacked application
directory.

The renderer has no direct Node.js access. Add any desktop capabilities
deliberately through `electron/preload.cjs` and IPC handlers in
`electron/main.cjs`.
