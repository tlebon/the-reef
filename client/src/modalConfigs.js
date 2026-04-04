/**
 * Shared modal configurations used by ActionBar and TilePanel.
 * Prevents duplication of field definitions.
 */

// Sanitize user input: strip control characters, limit names to safe chars
export const sanitizeInput = (key, value) => {
  // Names must be alphanumeric (used as command tokens)
  if (key === 'name' || key === 'serviceName') {
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }
  // Resource fields must be a single lowercase word
  if (key === 'give' || key === 'want' || key === 'resource') {
    return value.replace(/[^a-z]/g, '');
  }
  // Price/reward fields: digits and single decimal point only
  if (key === 'price' || key === 'reward') {
    const stripped = value.replace(/[^0-9.]/g, '');
    const parts = stripped.split('.');
    return parts.length <= 2 ? stripped : parts[0] + '.' + parts.slice(1).join('');
  }
  // All other fields: strip control characters and newlines
  return value.replace(/[\x00-\x1f]/g, '');
};

export const MODAL_CONFIGS = {
  'register-service': {
    title: 'Register Service',
    fields: [
      { key: 'name', label: 'Service Name', placeholder: 'e.g. exchange' },
      { key: 'price', label: 'Price (USDC)', placeholder: '0.01', defaultValue: '0.01' },
      { key: 'desc', label: 'Description', placeholder: 'A service', defaultValue: 'A service' },
    ],
    toCommand: (v) => v.name ? `REGISTER_SERVICE ${v.name} ${v.price || '0.01'} ${v.desc || 'A service'}` : null,
  },
  'say': {
    title: 'Say Something',
    fields: [
      { key: 'msg', label: 'Message', placeholder: 'Hello world' },
    ],
    toCommand: (v) => v.msg ? `SAY ${v.msg}` : null,
  },
  'post-bounty': {
    title: 'Post Bounty',
    fields: [
      { key: 'reward', label: 'Reward (USDC)', placeholder: '0.01', defaultValue: '0.01' },
      { key: 'desc', label: 'Description', placeholder: 'Describe the bounty' },
    ],
    toCommand: (v) => v.desc ? `POST_BOUNTY ${v.reward || '0.01'} ${v.desc}` : null,
  },
  'exchange': (ownerName) => ({
    title: `Exchange with ${ownerName}`,
    fields: [
      { key: 'give', label: 'Give Resource', placeholder: 'Select resource', options: ['coral', 'crystal', 'kelp', 'shell'] },
      { key: 'want', label: 'Want Resource', placeholder: 'Select resource', options: ['coral', 'crystal', 'kelp', 'shell'] },
    ],
    toCommand: (v) => (v.give && v.want) ? `INVOKE_SERVICE ${ownerName} exchange ${v.give} ${v.want}` : null,
  }),
  'combine': (ownerName) => ({
    title: `Combine with ${ownerName}`,
    fields: [
      { key: 'resource', label: 'Resource', placeholder: 'Select resource', options: ['coral', 'crystal', 'kelp', 'shell'] },
    ],
    toCommand: (v) => v.resource ? `INVOKE_SERVICE ${ownerName} combine ${v.resource}` : null,
  }),
};
