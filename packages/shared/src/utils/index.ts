import { customAlphabet } from 'nanoid';

// ID generators with prefixes for easy identification
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

const generateId = customAlphabet(alphabet, 16);
const generateApiKey = customAlphabet(alphabet, 32);

export const createId = {
  tenant: () => `ten_${generateId()}`,
  widget: () => `wgt_${generateId()}`,
  conversation: () => `cnv_${generateId()}`,
  message: () => `msg_${generateId()}`,
  visitor: () => `vis_${generateId()}`,
  apiKey: () => `pk_${generateApiKey()}`,
};

// Date helpers
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Domain extraction
export const extractDomain = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
};

