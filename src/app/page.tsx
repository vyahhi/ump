"use client"

import { supabase } from '@/lib/supabaseClient'
import { useEffect, useMemo, useRef, useState } from 'react'

type Message = {
  id: string
  content: string
  author: string | null
  created_at: string
}

const randomName = () =>
  `guest-${Math.random().toString(36).slice(2, 6)}${Math.random()
    .toString(36)
    .slice(2, 4)}`

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [listeningError, setListeningError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)

  const name = useMemo(() => {
    if (typeof window === 'undefined') return randomName()
    const stored = localStorage.getItem('ump_name')
    if (stored) return stored
    const next = randomName()
    localStorage.setItem('ump_name', next)
    return next
  }, [])

  useEffect(() => {
    const scrollToBottom = () => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight
      }
    }

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data as Message[])
        scrollToBottom()
      }
    }

    loadMessages()

    const channel = supabase
      .channel('messages-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
          scrollToBottom()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages.length])

  const handleSend = async () => {
    if (!input.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      content: input.trim(),
      author: name,
    })
    if (!error) {
      setInput('')
    }
    setSending(false)
  }

  const startRecording = async () => {
    setListeningError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'content-type': 'audio/webm' },
          body: blob,
        })

        if (!res.ok) {
          const err = await res.text()
          setListeningError(err)
          return
        }

        const { text } = (await res.json()) as { text?: string }
        if (text) {
          setInput((prev) => (prev ? `${prev} ${text}` : text))
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      setListeningError('Microphone access failed')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  const formattedTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            UMP Multiplayer Chat
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            One room. Shared history. Speak or type to join.
          </h1>
          <p className="max-w-2xl text-slate-300">
            Everyone sees the same stream of messages. Voice input is powered by
            ElevenLabs and messages are persisted in Supabase.
          </p>
          <div className="text-sm text-slate-400">
            You are chatting as <span className="text-white">{name}</span>
          </div>
        </header>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur">
          <div
            ref={chatRef}
            className="max-h-[60vh] min-h-[50vh] overflow-y-auto px-5 py-4"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className="mb-3 rounded-2xl border border-slate-800 bg-slate-800/50 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{message.author || 'anon'}</span>
                  <span>{formattedTime(message.created_at)}</span>
                </div>
                <p className="mt-2 text-base leading-relaxed text-slate-50">
                  {message.content}
                </p>
              </div>
            ))}
            {!messages.length && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-800/30 px-4 py-6 text-center text-slate-400">
                No messages yet. Say hi!
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900/70 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                placeholder="Type a message for everyone..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 transition hover:border-indigo-400 ${
                  isRecording ? 'bg-red-500/20 text-red-200' : 'bg-slate-800'
                }`}
                title="Hold to record"
              >
                {isRecording ? '■' : '🎤'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
              >
                {sending ? 'Sending...' : 'Send to room'}
              </button>
            </div>
          </div>
          {listeningError && (
            <div className="border-t border-slate-800 bg-red-500/10 px-5 py-3 text-sm text-red-200">
              {listeningError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
