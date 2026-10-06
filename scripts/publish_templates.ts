import { publishLifecycleTemplates } from "../src/lifecycle_mail";

const releaseId = process.argv[2];
if (!releaseId) throw new Error("Pass a release ID, for example: npm run demo -- media-v1");

const templateIds = await publishLifecycleTemplates(releaseId);
console.log(JSON.stringify({ releaseId, templateIds }, null, 2));
