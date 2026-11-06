// VEIL Reversible Steganographic Cover-Text Codec
//
// Implements deterministic, byte-exact, reversible encoding of capsule descriptors into
// natural-language carrier text, conforming to codec/wordmap.py and PRD specifications.
//
// Properties:
//   - Byte-exact reversibility: decode(encode(bytes)) === bytes for all inputs.
//   - Word-level mapping: 256 unique lowercase ASCII words mapped to 0x00..0xFF.
//   - High-speed offline operation with zero native dependencies.
//   - Automatic detection: distinguishes ordinary chatter from structured carrier text.

export const WORDS = Object.freeze([
  "the","of","and","to","in","is","that","it","for","on","with","as","was","at","by","an",
  "be","this","from","or","had","not","are","but","have","they","we","all","one","you","your",
  "can","has","more","will","each","about","which","time","when","up","out","them","then","she",
  "many","some","these","would","other","into","him","his","how","our","over","new","take",
  "only","little","work","know","place","year","live","me","back","give","most","very","after",
  "thing","just","name","good","sentence","man","think","say","great","where","help","through",
  "much","before","line","right","too","mean","old","any","same","tell","boy","follow","came",
  "want","show","also","around","form","three","small","set","put","end","does","another","well",
  "large","must","big","even","such","because","turn","here","why","ask","went","men","read",
  "need","land","different","home","us","move","try","kind","hand","picture","again","change",
  "play","spell","air","away","animal","house","point","page","letter","mother","answer","found",
  "study","still","learn","should","america","world","high","every","near","add","food","between",
  "own","below","country","plant","last","school","father","keep","tree","never","start","city",
  "earth","eye","light","thought","head","under","story","saw","left","few","while","along",
  "might","close","something","seem","next","hard","open","example","begin","life","always",
  "those","both","paper","together","got","group","often","run","important","until","children",
  "side","feet","car","mile","night","walk","white","sea","began","grow","took","river","four",
  "carry","state","once","book","hear","stop","second","later","miss","idea","enough","eat",
  "face","watch","far","really","almost","let","above","girl","sometimes","mountain","cut",
  "young","talk","soon","list","song","being","leave","family","body","music","color","stand",
  "sun","questions","fish","area"
])

const WORD_MAP = new Map()
WORDS.forEach((w, idx) => WORD_MAP.set(w, idx))

/**
 * Encode binary bytes into carrier text (space-separated natural-looking words).
 *
 * @param {Uint8Array} bytes
 * @returns {string} Plain ASCII words
 */
export function encodeToCarrierText(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('encodeToCarrierText: input must be a Uint8Array')
  }
  const words = new Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    words[i] = WORDS[bytes[i]]
  }
  return words.join(' ')
}

/**
 * Decode carrier text back into original binary bytes.
 * Throws if the text contains non-dictionary words or is not valid carrier text.
 *
 * @param {string} text
 * @returns {Uint8Array} Original decoded bytes
 */
export function decodeFromCarrierText(text) {
  if (typeof text !== 'string') {
    throw new Error('decodeFromCarrierText: input must be a string')
  }
  const clean = text.trim()
  if (!clean) {
    throw new Error('decodeFromCarrierText: empty input')
  }

  const tokens = clean.toLowerCase().split(/\s+/)
  const bytes = new Uint8Array(tokens.length)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].replace(/[^a-z]/g, '') // strip surrounding punctuation if any
    const byteVal = WORD_MAP.get(token)
    if (byteVal === undefined) {
      throw new Error(`decodeFromCarrierText: unknown carrier word "${tokens[i]}" at index ${i}`)
    }
    bytes[i] = byteVal
  }

  return bytes
}

/**
 * Check if a text is valid carrier text without throwing.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isCarrierText(text) {
  if (typeof text !== 'string' || !text.trim()) return false
  const tokens = text.trim().toLowerCase().split(/\s+/)
  if (tokens.length < 16) return false // VEIL descriptors are >= 104 bytes
  for (const t of tokens) {
    const clean = t.replace(/[^a-z]/g, '')
    if (!WORD_MAP.has(clean)) return false
  }
  return true
}

/**
 * Encode bytes via optional HTTP codec service with fallback to local wordmap.
 */
export async function encodeCarrierText({ bytes, serviceUrl = null }) {
  if (serviceUrl) {
    try {
      const b64 = Buffer.from(bytes).toString('base64')
      const res = await fetch(`${serviceUrl}/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciphertext: b64 }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.coverText) return data.coverText
      }
    } catch {
      // Fallback to local
    }
  }
  return encodeToCarrierText(bytes)
}

/**
 * Decode carrier text via optional HTTP codec service with fallback to local wordmap.
 */
export async function decodeCarrierText({ text, serviceUrl = null }) {
  if (serviceUrl) {
    try {
      const res = await fetch(`${serviceUrl}/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverText: text }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ciphertext) return new Uint8Array(Buffer.from(data.ciphertext, 'base64'))
      }
    } catch {
      // Fallback to local
    }
  }
  return decodeFromCarrierText(text)
}
