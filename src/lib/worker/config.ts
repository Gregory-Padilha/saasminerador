// ==============================================================================
// OFFER MINER - CREATIVE CAPTURE WORKER CONFIGURATION
// ==============================================================================

export const CAPTURE_CONFIG = {
  MAX_ADS_PER_JOB: 50,
  MAX_SCROLL_ITERATIONS: 30,
  MAX_VIDEO_FILE_SIZE_MB: 100,
  MAX_JOB_DURATION_MS: 10 * 60 * 1000, // 10 minutes
  VIEWPORT: { width: 1366, height: 768 },
  USER_AGENT:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  STORAGE_BUCKET: 'offer-creatives',
  LOCAL_STORAGE_DIR: './public/uploads/offer-creatives',
};
