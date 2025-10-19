/**
 * Mention Utilities for handling @mentions in posts and comments
 */

/**
 * Extract mentions from text
 * Format: @[user_id:username] 
 * Returns array of {id, name}
 */
export const extractMentions = (text) => {
  const mentionRegex = /@\[([^:]+):([^\]]+)\]/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      id: match[1],
      name: match[2]
    });
  }
  
  return mentions;
};

/**
 * Format text for display - replace mentions with highlighted version
 * @[user_id:username] -> <span class="mention">@username</span>
 */
export const formatMentions = (text) => {
  if (!text) return '';
  
  return text.replace(
    /@\[([^:]+):([^\]]+)\]/g,
    '<span class="text-[#00C2A8] font-semibold cursor-pointer hover:underline" data-user-id="$1">@$2</span>'
  );
};

/**
 * Insert mention at cursor position
 */
export const insertMention = (text, cursorPosition, userId, userName) => {
  const mention = `@[${userId}:${userName}]`;
  const before = text.substring(0, cursorPosition);
  const after = text.substring(cursorPosition);
  
  // Remove the @ that triggered the mention
  const beforeClean = before.replace(/@\w*$/, '');
  
  return {
    text: beforeClean + mention + ' ' + after,
    cursorPosition: (beforeClean + mention + ' ').length
  };
};

/**
 * Find @ position in text for showing dropdown
 */
export const findMentionTrigger = (text, cursorPosition) => {
  const textBeforeCursor = text.substring(0, cursorPosition);
  const match = textBeforeCursor.match(/@(\w*)$/);
  
  if (match) {
    return {
      triggered: true,
      searchText: match[1],
      position: cursorPosition - match[0].length
    };
  }
  
  return { triggered: false };
};
