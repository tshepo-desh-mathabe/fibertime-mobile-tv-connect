
This repository contains frontend and back-end and steps on how to get the project running locally. Here are the steps.

## `1. Install Node`
Make sure you have `node.js` installed.
Might not be required, but have NestJS install by running `npm install -g @nestjs/cli` if you planning on adding new logic.

## `2. Database Setup`
The project uses `Postgres` and below are the default connection details. If you have `Postgres` running with different DB connection details.

`Host: localhost`
`Port: 5432`
`Database: fibertime`
`Username: root`
`Password: root`
`Driver: PostgreSQL`

## `3. Run Docker Compose`
Make sure you run docker-compose. One can run it locally by using `docker compose up -d` to get you all the necessary container required to run the project.
Below is a list of environment variables one should pass when running docker:

| Name          | Default           | Definition  |
| ------------- |:-------------:| -----|
| DB_HOST       | `localhost` | DB host |
| DB_PORT      | `5432`      | DB port |
| DB_PASSWORD | `root`      | DB password |
| DB_USERNAME  | `root` | DB username |
| DB_NAME      | `fibertime` | DB name |
| REDIS_URL | `redis://localhost:6379` | redis cache url |
| JWT_SECRET       | `fibertime-practical-haha-secret-me` | JWT secret |
| PORT      | `5588`      | backend application port |
| FRONTEND_URL | `http://localhost:3535`      | FE application url |
| OTP_EXPIRY_MINUTES  | `5` | OTP expiry in minutes |
| DEVICE_CODE_EXPIRY_MINUTES  | `24` | device code expiry in minutes |
| BUNDLE_EXPIRY_DAYS       | `30` | bundles expiry in days |
| ALLOW_CREDENTIALS      | `true`      | allow security credentials |
| NEXT_PUBLIC_API_BASE_URL | `http://localhost:5588/api` | backend URL |


## `3. Swagger Documentation`
Alternatively, one can view backend URL's under `http://localhost:5588/api/swagger-ui`. Though not recommened for production, you can replace the `localhost` with the production base URL.