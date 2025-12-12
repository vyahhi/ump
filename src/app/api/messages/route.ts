import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load messages', details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: Request) {
  const { content, author } = (await req.json()) as {
    content?: string
    author?: string
  }

  if (!content || !content.trim()) {
    return NextResponse.json(
      { error: 'Message content is required' },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({ content: content.trim(), author })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to save message', details: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ message: data })
}
