import { supabaseAdmin } from '@/lib/supabaseAdmin'

const encoder = new TextEncoder()

export async function GET(request: Request) {
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const channel = supabaseAdmin
        .channel('messages-stream')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => send(payload.new),
        )
        .subscribe()

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: keepalive\ndata: {}\n\n`))
      }, 20000)

      cleanup = () => {
        clearInterval(keepAlive)
        supabaseAdmin.removeChannel(channel)
        controller.close()
      }

      request.signal.addEventListener('abort', () => cleanup?.())
      controller.enqueue(encoder.encode('event: open\ndata: {}\n\n'))
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
