# Self-hosting Moo Tasks

Use the [README](../README.md) Quick Start to try Moo Tasks locally. The included Compose stack is not a production deployment: it publishes MySQL, Adminer, and Mailpit ports, bind-mounts source files, and uses Mailpit instead of a real mail provider.

## Production requirements

- Run the app container behind a reverse proxy or platform ingress that provides HTTPS. The app listens on port `3000`.
- Use a reachable MySQL 8 database with durable storage and regular backups. Do not rely on the local Compose volume as your production backup.
- Configure an SMTP provider for account verification, password resets, and invitations.
- Keep the database and app ports private; do not publish Adminer or Mailpit to the internet.

## Configure the app

Set these environment variables in your hosting platform's secret/configuration settings:

| Variable | Required configuration |
|---|---|
| `NUXT_SESSION_PASSWORD` | A unique random secret of at least 32 characters. Generate one with `openssl rand -hex 32`; keep it stable across restarts and app instances. |
| `DATABASE_URL` | MySQL connection URL for the app's database, for example `mysql://user:password@db.example.com:3306/mootasks`. Percent-encode special characters in the username or password. |
| `DB_HOST` | The database hostname. The container checks this host before starting migrations, so it must match the host in `DATABASE_URL`. |
| `DB_PORT` | The database port; it must match the port in `DATABASE_URL` (usually `3306`). |
| `BASE_URL` | The public HTTPS origin, such as `https://tasks.example.com`; generated email links use this value. |
| `SMTP_HOST` / `SMTP_PORT` | Your SMTP provider's host and port. Do not use the Compose-only `mailpit` hostname in a deployed app. |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP credentials, if required by your provider. Store the password as a secret. |
| `SMTP_FROM` | A sender address accepted by your SMTP provider, such as `tasks@example.com`. |

Use a distinct, strong password for MySQL; never use the example `password` value. Grant the database user the permissions needed to create and update the application's schema: the container runs migrations during startup.

## Deploy and maintain

1. Build the image from the repository's `Dockerfile` and configure the variables above in the hosting platform.
2. Make sure the app can reach the database at `DB_HOST:DB_PORT` and authenticate using `DATABASE_URL` before starting the app.
3. Expose the app through HTTPS and verify that account emails link to the configured `BASE_URL`.
4. Keep MySQL backups independent of the application container. Test restoring a backup before relying on it.

The container runs migrations before launching the server, so the database must be available at startup and the configured user must be able to apply schema changes. Start with one app instance until the initial migration succeeds; each instance runs the migration script at startup. The app spec in [`.do/app.yaml`](../.do/app.yaml) is a DigitalOcean starting point; configure its database, session secret, public URL, and SMTP values for your deployment. The GitHub Actions workflow builds the app but does not deploy it.

Do not use `docker compose down -v` on a deployment that contains data: `-v` removes the Compose database volume. If adapting Compose for production, remove the development bind mounts and do not publish the database, Adminer, or Mailpit ports publicly.