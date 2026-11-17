process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://llh_app:llh_dev_pw@127.0.0.1:5432/llh_test";
process.env.APP_SECRET = "test-secret-test-secret-test-secret-test-secret";
process.env.APP_URL = "http://localhost:3100";
process.env.RATE_LIMIT_DISABLED = "1";
