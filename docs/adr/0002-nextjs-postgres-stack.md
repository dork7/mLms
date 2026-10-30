# Next.js and Postgres stack

The app is a single Next.js (App Router) TypeScript codebase on Postgres, using Drizzle for data access. It's deployed with Docker Compose on a VPS. PDFs (Report Cards, Payment Records) are rendered from HTML with Playwright, and email is sent over SMTP through a provider that can be swapped out. One full-stack framework and one relational database suit a single-school deployment, and grades, enrollments and fees are relational data that needs integrity. Node with EJS and Prisma were the alternatives considered. v1 is a responsive web app with no native client.

## Amendment: login and sessions live in the application layer

Login, sessions, password reset, session timeout, rate limiting and disabled logins are implemented in the application layer, not by Better Auth's runtime. This lets them be tested through the single application-layer seam against the test Clock. Better Auth is kept only for password hashing and its table layout. Session and reset tokens are 32 random bytes, stored only as SHA-256 hashes. The session cookie is httpOnly, sameSite=lax, and secure in production.
