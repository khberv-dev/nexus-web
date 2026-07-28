# Prisma Migration Guide

This project uses **Prisma 7** for database management. Follow these steps to manage your database schema and migrations.

## 1. Modifying the Schema

Update your models in `prisma/schema.prisma`. 

> [!IMPORTANT]
> In Prisma 7, the `url` property is **not supported** in the `datasource` block within `schema.prisma`. It must be managed via `prisma.config.ts` or CLI flags.

## 2. Creating and Applying Migrations (Development)

To create a new migration and apply it to your local database, run:

```bash
npx prisma migrate dev --name <migration_name> --url "postgresql://postgres:postgres@localhost:5432/platform"
```

*Replace the URL if your environment differs.*

## 3. Applying Existing Migrations (Production/Staging)

To apply already created migrations without creating new ones:

```bash
npx prisma migrate deploy --url "postgresql://postgres:postgres@localhost:5432/platform"
```

## 4. Resetting the Database

If you need to wipe the database and start fresh:

```bash
npx prisma migrate reset --url "postgresql://postgres:postgres@localhost:5432/platform"
```

## 5. Generating the Prisma Client

After any migration, ensure your client is up to date:

```bash
npm run db:generate
```

## Troubleshooting

If you see the error `The datasource.url property is required in your Prisma config file`, it means the CLI is having trouble reading the environment variables for `prisma.config.ts`. Always use the `--url` flag to specify the connection string explicitly.
