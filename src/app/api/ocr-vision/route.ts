import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ timeout: 45_000 })

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number]

const VisionSchema = z.object({
  text: z.string(),
  documentType: z.enum([
    'receipt',
    'invoice',
    'id-card',
    'form',
    'table',
    'handwritten',
    'book-page',
    'screenshot',
    'mixed',
    'other',
  ]),
  fields: z.record(z.string(), z.string()),
  confidence: z.number(),
})

/**
 * POST /api/ocr-vision
 * Body: { image: string (data URL), language: string }
 *
 * Calls Claude's vision API to perform OCR. The model is also asked to
 * classify the document type and extract common fields, which the client
 * uses for structured output.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Vision AI is not configured on this server (missing ANTHROPIC_API_KEY). Use the Tesseract engine, or set ANTHROPIC_API_KEY in .env.local and restart the dev server.' },
        { status: 503 },
      )
    }

    const body = (await req.json()) as { image: string; language: string }
    if (!body.image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 })
    }

    const match = body.image.match(/^data:([^;]+);base64,(.+)$/)
    if (!match || !ALLOWED_MEDIA_TYPES.includes(match[1] as AllowedMediaType)) {
      return NextResponse.json(
        { error: 'Image must be a base64 data URL (jpeg, png, gif, or webp)' },
        { status: 400 },
      )
    }
    const mediaType = match[1] as AllowedMediaType
    const base64Data = match[2]

    const prompt = `You are Nerita, an OCR engine. Analyze this image and extract ALL text faithfully, preserving line breaks and layout.

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
- "confidence" reflects how clearly the text was readable (0.95 for clean print, 0.5 for messy handwriting).`

    const response = await client.messages.parse({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(VisionSchema) },
    })

    const parsed = response.parsed_output
    if (!parsed) {
      return NextResponse.json({ error: 'Vision model returned unparsable output' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[nerita] vision OCR error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
