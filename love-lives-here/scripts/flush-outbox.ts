/** Cron backstop: sends queued customer emails and retries failures. Run every 5 minutes. */
import { flushOutbox } from "../src/lib/notifications";
import { closeDb } from "../src/lib/db";

flushOutbox(100).then((r) => { console.log(JSON.stringify(r)); return closeDb(); }).catch((e) => { console.error(e); process.exit(1); });
