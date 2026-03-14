/**
 * Webhooks barrel export — Story 13.1.
 */

export { WebhookService } from './webhook-service.js';
export type {
  WebhookInput,
  WebhookOutput,
  DeliveryResult,
} from './webhook-service.js';
export {
  computeSignature,
  verifySignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  MAX_DELIVERY_ATTEMPTS,
} from './webhook-service.js';
