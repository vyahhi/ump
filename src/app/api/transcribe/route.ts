import { NextResponse } from 'next/server'

const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text'

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing ELEVENLABS_API_KEY on the server' },
      { status: 500 },
    )
  }

  const contentType = req.headers.get('content-type') || 'audio/webm'
  const buffer = Buffer.from(await req.arrayBuffer())

  const form = new FormData()
  form.append(
    'file',
    new Blob([buffer], { type: contentType }),
    'clip.webm',
  )
  form.append('model_id', 'eleven_multilingual_v2')
  form.append('language_code', 'en')

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: form,
  })

  if (!response.ok) {
    const errorText = await response.text()
    return NextResponse.json(
      { error: 'Transcription failed', details: errorText },
      { status: 500 },
    )
  }

  const data = (await response.json()) as { text?: string; transcription?: string }
  const text = data.text || data.transcription || ''

  return NextResponse.json({ text })
}
