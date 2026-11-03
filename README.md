# WebStore Application

A web store with a desktop admin application. Customers browse products in the web store. Admins use the dashboard to see sales, manage stock and prices, and add new products.

| Part               | Folder                             | Stack                      |
| ------------------ | ---------------------------------- | -------------------------- |
| Backend (REST API) | [backend/](backend/)               | NestJS, Prisma, PostgreSQL |
| Web store          | [frontend/](frontend/)             | React, Vite, TypeScript    |
| Admin dashboard    | [adminDashboard/](adminDashboard/) | Qt 6, C++                  |

## Requirements

- Node.js and npm
- Docker
- Qt 6 with the Charts module (only for the admin dashboard)

## Getting started

**1. Start the database** (from the project root)

```bash
docker compose up -d
```

**2. Create `backend/.env`**

```env
DATABASE_URL="postgresql://ecommerce:ecommerce@localhost:5433/ecommerce"
JWT_SECRET="your-secret"
```

**3. Set up and run the backend**

```bash
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```

The API runs at <http://localhost:3000>. The seed creates an admin account: `admin@webstore.com` / `admin123`.

**4. Run the web store**

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

**5. Run the admin dashboard**

Open [adminDashboard/CMakeLists.txt](adminDashboard/CMakeLists.txt) in Qt Creator, then build and run it. Log in with the admin account.

## Admin dashboard features

- Admin login
- Sales chart for the last day, week, month and year
- Create new products and upload images and videos

## Testing

```bash
cd backend
npm test            # unit tests
npm run test:e2e    # end-to-end tests (needs the database running)
```
