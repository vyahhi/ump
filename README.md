# UMP – Multiplayer Chat

A single-room chat built with Next.js, Supabase realtime, and ElevenLabs speech-to-text. Anyone who opens the app can speak or type and the shared history updates live.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment:
   - Copy `.env.example` to `.env.local`.
   - Fill in:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `ELEVENLABS_API_KEY` (kept server-side; used by `/api/transcribe`).
3. Create the Supabase table (MCP or SQL):
   ```sql
   create table if not exists public.messages (
     id uuid primary key default gen_random_uuid(),
     author text,
     content text not null,
     created_at timestamptz default now()
   );

   alter table public.messages enable row level security;
   create policy "Anyone can read messages" on public.messages for select using (true);
   create policy "Anyone can insert messages" on public.messages for insert with check (true);
   ```
   Ensure Realtime is enabled for `public.messages`.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting.
