/**
 * LUMI Conversation & Timestamp Utilities
 * Formats relative elapsed time since item creation or modification.
 */

import { ConversationThread } from '../types';

/**
 * Derives the creation timestamp (in milliseconds) for a conversation.
 * Checks conv.createdAt, then falls back to parsing the millisecond epoch
 * from the conversation ID (e.g. 'conv-1795461535395'), or updatedAt.
 */
export function getConversationCreatedAt(conv: Partial<ConversationThread>): number {
  if (conv.createdAt && typeof conv.createdAt === 'number' && !isNaN(conv.createdAt) && conv.createdAt > 0) {
    return conv.createdAt;
  }

  // Attempt to parse epoch from conv.id if formatted like conv-1795461535395
  if (conv.id) {
    const match = conv.id.match(/^conv-(\d{10,13})$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  if (conv.updatedAt && typeof conv.updatedAt === 'number' && !isNaN(conv.updatedAt) && conv.updatedAt > 0) {
    return conv.updatedAt;
  }

  return Date.now();
}

/**
 * Returns a human-readable relative time string representing how long ago
 * a timestamp occurred (e.g., 'Just now', '5 mins ago', '2 hours ago', 'Yesterday', '3 days ago').
 */
export function formatTimeAgo(timestampMs: number | undefined | null): string {
  if (!timestampMs || isNaN(timestampMs) || timestampMs <= 0) {
    return 'Just now';
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestampMs);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Less than 1 minute
  if (diffSec < 60) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diffMin < 60) {
    return diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
  }

  // Less than 24 hours
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  // Exactly 1 day ago / Yesterday
  if (diffDays === 1) {
    return 'Yesterday';
  }

  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Less than 30 days
  const weeks = Math.floor(diffDays / 7);
  if (diffDays < 30) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  // Less than 365 days
  const months = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  // 1 year or more
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

/**
 * Formats how long ago a conversation thread was created.
 */
export function formatConversationAge(conv: Partial<ConversationThread>): string {
  const createdAt = getConversationCreatedAt(conv);
  return formatTimeAgo(createdAt);
}
