/**
 * Shipping policy barrel — single import surface for callers.
 *
 * Pulled from L1/L2/L3/L4. Do not re-export mutable runtime state from here.
 */

export {
  BORZO_EXCLUDED,
  PAXEL_MAX_WEIGHT_GRAM,
  INSTANT_BIKE_MAX_WEIGHT_GRAM,
  SHIPPING_MARKUP_PERCENT,
  COURIER_DISPLAY_NAMES,
} from './constants';

export {
  classifyDestination,
  isServiceable,
  tierVisibilityForPhase,
  gatePhase1,
  PHASE1_CRITERIA,
} from './geo-policy';

export {
  COURIER_TRUST_TIER,
  isCourierAllowed,
  reliabilityScoreFor,
} from './courier-trust';

export {
  BANDUNG_TZ,
  CUTOFFS,
  getCutoffStatus,
} from './cutoffs';
