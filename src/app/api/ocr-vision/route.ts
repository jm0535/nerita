import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

type VisionResponse = {
  text: string
  blocks?: Array<{
    text: string
    confidence: number
    lines?: Array<{
      text: string
      confidence: number
      words?: Array<{
        text: string
        confidence: number
        bbox: { x0: number; y0: number; x1: number; y1: number }
      }>
    }>
  }>
  documentType?: string
  fields?: Record<string, string>
  confidence?: number
}

/**
 * POST /api/ocr-vision
 * Body: { image: string (data URL), language: string }
 *
 * Calls a vision LLM via z-ai-web-dev-sdk to perform OCR. The LLM is also
 * asked to classify the document type and extract common fields, which the
 * client uses for structured output.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { image: string; language: string }
    if (!body.image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 })
    }

    const zai = await ZAI.create()

    const prompt = `You are Nerita, an OCR engine. Analyze this image and extract ALL text faithfully, preserving line breaks and layout.

Respond as STRICT JSON with this exact schema:
{
  "text": "the full extracted text, preserving line breaks",
  "documentType": "one of: receipt | invoice | id-card | form | table | handwritten | book-page | screenshot | mixed | other",
  "fields": { "fieldKey": "value" },
  "confidence": 0.0 to 1.0
}

Rules:
- "text" must contain every visible word, number, and symbol, in reading order.
- Preserve blank lines between paragraphs.
- For tables, format as TSV (tab-separated) inside "text".
- "fields" should extract structured key-value pairs relevant to the detected documentType:
  - receipt: { merchant, date, total, currency, tax, paymentMethod, items: "item1 | qty | price; item2 | ..." }
  - invoice: { vendor, invoiceNumber, date, dueDate, total, currency, tax, poNumber }
  - id-card: { name, idNumber, dateOfBirth, expiry, issuer, documentType }
  - form: { each labeled field }
  - other: {} or any obvious key-value pairs
- "confidence" reflects how clearly the text was readable (0.95 for clean print, 0.5 for messy handwriting).
- Output ONLY the JSON object, no markdown fences, no commentary.`

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: body.image } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
      temperature: 0.1,
    })

    const raw = response.choices[0]?.message?.content ?? ''

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let parsed: VisionResponse
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parse fails, fall back to treating the whole response as text
      parsed = { text: raw, confidence: 0.7, documentType: 'other', fields: {} }
    }

    // Ensure required fields exist
    if (!parsed.text) parsed.text = ''
    if (typeof parsed.confidence !== 'number') parsed.confidence = 0.8
    if (!parsed.documentType) parsed.documentType = 'other'
    if (!parsed.fields) parsed.fields = {}

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[nerita] vision OCR error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
