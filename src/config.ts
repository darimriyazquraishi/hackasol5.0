/**
 * Centralized Application Configuration
 *
 * Centralizes all frontend endpoints, timeouts, and operational boundaries.
 * Backed by Vite environment variables where appropriate.
 */

export const APP_CONFIG = {
  appName: 'LUMI',
  fullName: 'Local Unified Multimodal Intelligence',
  apiBase: '',
  endpoints: {
    hardware: '/api/hardware',
    modelsAudit: '/api/models/audit',
    orchestratePlan: '/api/orchestrate/plan',
    orchestrateExecute: '/api/orchestrate/execute',
    codeExecute: '/api/code/execute',
    ragSearch: '/api/rag/search',
    diagnostics: '/api/diagnostics',
    chat: '/api/chat',
    health: '/api/health',
    executionHistory: '/api/orchestrate/history',
    serversStatus: '/api/servers/status',
    serversRefresh: '/api/servers/refresh'
  },
  timeouts: {
    planTimeoutMs: 600000, // 10 minutes zero-timeout buffer
    executeTimeoutMs: 1800000, // 30 minutes zero-timeout buffer
    codeExecutionTimeoutMs: 120000, // 2 minutes execution buffer
    probeTimeoutMs: 15000 // Resilient probe timeout
  },
  vramCeilings: {
    gtx1650MB: 4096,
    maxSafeVramGB: 3.2
  }
};
