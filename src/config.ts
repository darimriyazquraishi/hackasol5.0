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
    executionHistory: '/api/orchestrate/history'
  },
  timeouts: {
    planTimeoutMs: 15000,
    executeTimeoutMs: 60000,
    codeExecutionTimeoutMs: 10000,
    probeTimeoutMs: 2000
  },
  vramCeilings: {
    gtx1650MB: 4096,
    maxSafeVramGB: 3.2
  }
};
