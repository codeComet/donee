import sanitizeHtml from 'sanitize-html'

// Allowlist matching what RichTextEditor (TipTap) produces. Task descriptions and
// notes are user-controlled HTML that anyone in the workspace can write directly
// through the Supabase API, so it must be sanitized before dangerouslySetInnerHTML.
const OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'hr',
    'span', 'a', 'img',
  ],
  allowedAttributes: {
    span: ['data-mention-id'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
}

export function sanitizeRichText(html) {
  if (!html) return ''
  return sanitizeHtml(html, OPTIONS)
}

// Returns the URL only if it is http(s); blocks javascript:, data:, etc. in hrefs.
export function safeHref(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}
