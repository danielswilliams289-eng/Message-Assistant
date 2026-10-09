// Anti-Spam & Deliverability Engine for Cold Outreach & Gmail Delivery
export interface SpamTrigger {
  word: string;
  category: 'urgency' | 'money' | 'marketing' | 'hype' | 'shady';
  severity: 'high' | 'medium';
  replacement: string;
}

export interface DeliverabilityAnalysis {
  score: number; // 0 - 100
  rating: 'Excellent' | 'Good' | 'Needs Improvement' | 'High Spam Risk';
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  triggers: SpamTrigger[];
  warnings: string[];
  suggestions: string[];
  hasPersonalization: boolean;
  hasOptOut: boolean;
}

// Common spam trigger words used by Google Spam Filter / SpamAssassin
const SPAM_DICTIONARY: { pattern: RegExp; word: string; category: SpamTrigger['category']; severity: SpamTrigger['severity']; replacement: string }[] = [
  { pattern: /\b100%\s*free\b/gi, word: '100% free', category: 'hype', severity: 'high', replacement: 'complimentary' },
  { pattern: /\bfree\s*gift\b/gi, word: 'free gift', category: 'hype', severity: 'high', replacement: 'bonus' },
  { pattern: /\bclick\s*here\b/gi, word: 'click here', category: 'marketing', severity: 'medium', replacement: 'see details here' },
  { pattern: /\bclick\s*now\b/gi, word: 'click now', category: 'marketing', severity: 'medium', replacement: 'take a look' },
  { pattern: /\bbuy\s*now\b/gi, word: 'buy now', category: 'marketing', severity: 'high', replacement: 'get started' },
  { pattern: /\border\s*now\b/gi, word: 'order now', category: 'marketing', severity: 'medium', replacement: 'explore options' },
  { pattern: /\bmake\s*money\b/gi, word: 'make money', category: 'money', severity: 'high', replacement: 'grow revenue' },
  { pattern: /\bearn\s*\$+\b/gi, word: 'earn $$', category: 'money', severity: 'high', replacement: 'increase ROI' },
  { pattern: /\binstant\s*cash\b/gi, word: 'instant cash', category: 'money', severity: 'high', replacement: 'fast returns' },
  { pattern: /\bguaranteed\b/gi, word: 'guaranteed', category: 'hype', severity: 'medium', replacement: 'proven' },
  { pattern: /\brisk[-\s]*free\b/gi, word: 'risk-free', category: 'hype', severity: 'medium', replacement: 'reliable' },
  { pattern: /\bno\s*catch\b/gi, word: 'no catch', category: 'shady', severity: 'high', replacement: 'straightforward' },
  { pattern: /\bno\s*obligation\b/gi, word: 'no obligation', category: 'marketing', severity: 'medium', replacement: 'no strings attached' },
  { pattern: /\bact\s*now\b/gi, word: 'act now', category: 'urgency', severity: 'high', replacement: 'reach out when convenient' },
  { pattern: /\burgent\b/gi, word: 'urgent', category: 'urgency', severity: 'high', replacement: 'timely' },
  { pattern: /\bwinner\b/gi, word: 'winner', category: 'shady', severity: 'high', replacement: 'selected business' },
  { pattern: /\bcongratulations\b/gi, word: 'congratulations', category: 'shady', severity: 'medium', replacement: 'kudos' },
  { pattern: /\bcredit\s*card\b/gi, word: 'credit card', category: 'money', severity: 'high', replacement: 'payment details' },
  { pattern: /\bpure\s*profit\b/gi, word: 'pure profit', category: 'money', severity: 'high', replacement: 'net return' },
  { pattern: /\bunlimited\s*leads\b/gi, word: 'unlimited leads', category: 'hype', severity: 'medium', replacement: 'qualified prospects' },
  { pattern: /\bcheap\b/gi, word: 'cheap', category: 'money', severity: 'medium', replacement: 'cost-effective' },
  { pattern: /\bonce\s*in\s*a\s*lifetime\b/gi, word: 'once in a lifetime', category: 'hype', severity: 'high', replacement: 'unique opportunity' },
  { pattern: /\bexclusive\s*deal\b/gi, word: 'exclusive deal', category: 'marketing', severity: 'medium', replacement: 'tailored proposition' },
  { pattern: /\bdouble\s*your\s*income\b/gi, word: 'double your income', category: 'money', severity: 'high', replacement: 'scale operations' },
];

export function analyzeEmailDeliverability(subject: string, body: string): DeliverabilityAnalysis {
  let score = 100;
  const triggers: SpamTrigger[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const combinedText = `${subject} ${body}`;

  // 1. Detect Spam Words
  for (const item of SPAM_DICTIONARY) {
    if (item.pattern.test(combinedText)) {
      triggers.push({
        word: item.word,
        category: item.category,
        severity: item.severity,
        replacement: item.replacement,
      });

      if (item.severity === 'high') {
        score -= 15;
      } else {
        score -= 8;
      }
    }
  }

  // 2. Check Subject Line ALL CAPS
  const cleanSubjectLetters = subject.replace(/[^a-zA-Z]/g, '');
  if (cleanSubjectLetters.length > 5) {
    const capsCount = cleanSubjectLetters.replace(/[^A-Z]/g, '').length;
    const capsRatio = capsCount / cleanSubjectLetters.length;
    if (capsRatio > 0.45) {
      score -= 20;
      warnings.push('Subject has high uppercase ratio (ALL CAPS triggers Gmail spam filters).');
      suggestions.push('Use sentence case or title case in subject line.');
    }
  }

  // 3. Excessive Punctuation
  if (/[!?]{2,}/.test(subject) || /\$\$\$+/.test(subject)) {
    score -= 15;
    warnings.push('Excessive exclamation or dollar marks in subject line.');
    suggestions.push('Avoid multiple punctuation marks ("!!!", "???", "$$$").');
  }

  if (/[!?]{3,}/.test(body)) {
    score -= 8;
    warnings.push('Multiple exclamation marks detected in body text.');
  }

  // 4. Subject Length
  const subjectWords = subject.trim().split(/\s+/).filter(Boolean);
  if (subjectWords.length > 12) {
    score -= 5;
    warnings.push('Subject line is too long (> 12 words), which reduces open rates.');
    suggestions.push('Shorten subject line to 4–7 words for higher open rates.');
  } else if (subjectWords.length === 0) {
    score -= 30;
    warnings.push('Subject line is empty.');
  }

  // 5. Personalization Check
  const hasPersonalization = /\{\{(first_name|name|company|niche)\}\}/i.test(combinedText);
  if (!hasPersonalization) {
    score -= 15;
    warnings.push('No personalization variables found (e.g. {{first_name}} or {{company}}).');
    suggestions.push('Add {{first_name}} or {{company}} so each email is individually tailored.');
  }

  // 6. Opt-Out / Sign-off Check
  const hasOptOut = /unsubscribe|opt-out|remove you|reply stop/i.test(body);
  if (!hasOptOut) {
    score -= 10;
    suggestions.push('Include a polite opt-out option (e.g. "Reply unsubscribe to be removed") for CAN-SPAM compliance.');
  }

  // Normalize score
  score = Math.max(10, Math.min(100, score));

  let rating: DeliverabilityAnalysis['rating'] = 'Excellent';
  let color: DeliverabilityAnalysis['color'] = 'emerald';

  if (score >= 88) {
    rating = 'Excellent';
    color = 'emerald';
  } else if (score >= 72) {
    rating = 'Good';
    color = 'blue';
  } else if (score >= 50) {
    rating = 'Needs Improvement';
    color = 'amber';
  } else {
    rating = 'High Spam Risk';
    color = 'rose';
  }

  return {
    score,
    rating,
    color,
    triggers,
    warnings,
    suggestions,
    hasPersonalization,
    hasOptOut,
  };
}

// Clean and replace spam trigger words automatically
export function cleanSpamTriggers(text: string): string {
  let cleaned = text;
  for (const item of SPAM_DICTIONARY) {
    cleaned = cleaned.replace(item.pattern, item.replacement);
  }
  // Replace multiple exclamation marks
  cleaned = cleaned.replace(/!{2,}/g, '.');
  cleaned = cleaned.replace(/\?{2,}/g, '?');
  return cleaned;
}

// Append clean professional opt-out footer for inbox placement
export function appendOptOutFooter(bodyText: string): string {
  if (/unsubscribe|opt[- ]out|remove you/i.test(bodyText)) {
    return bodyText;
  }
  return `${bodyText.trim()}\n\n---\nP.S. If you'd prefer not to receive future updates, simply reply "unsubscribe" and I'll remove your email immediately.`;
}
