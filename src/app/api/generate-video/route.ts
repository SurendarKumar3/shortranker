/**
 * POST /api/generate-video
 * 
 * Alias for /api/process-video for API consistency
 * Re-exports the process-video route handler
 */

export { POST, config } from "../process-video/route";
