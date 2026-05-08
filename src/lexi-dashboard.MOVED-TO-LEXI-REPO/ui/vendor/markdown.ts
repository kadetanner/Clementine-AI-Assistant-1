import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: false });

/**
 * Renders trusted-source Markdown (vault files written by the user) to
 * sanitized HTML. Even though the corpus is local-only, we sanitize
 * defense-in-depth against e.g. notes pasted from the web.
 *
 * Returns a string of HTML safe to pass to Lit's unsafeHTML() directive.
 */
export function renderMarkdown(input: string): string {
  const raw = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
