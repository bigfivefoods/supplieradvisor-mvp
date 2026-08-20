/**
 * Run: npx --yes tsx scripts/send-email-design-samples.mts
 * Needs RESEND_API_KEY in the environment.
 */
import { sendEmailDesignSamples } from '../lib/notifications/email-design-samples';

const to = process.argv[2] || process.env.EMAIL_SAMPLE_TO || undefined;
const result = await sendEmailDesignSamples({ to });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
