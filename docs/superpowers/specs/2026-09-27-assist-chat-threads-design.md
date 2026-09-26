# Assist conversation history (chat threads)

## Context

This is sub-project 1 of 3 for the "history, auth, onboarding" request. The
other two (fake/demo sign-in flow, onboarding carousel) are separate specs;
this one only covers the Assist page's conversation history.

Today the Assist page has exactly one running conversation per tour. The
backend stores it in a single flat table:

```python
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: int
    tour_id: int          # indexed, no thread concept
    role: str             # "user" | "assistant"
    text: str
    data: dict | None
    created_at: datetime
```

`GET /tours/{id}/chat` returns every message for the tour, ordered by time.
`POST /tours/{id}/chat` appends a user message, runs `assist.handle(...)`,
appends the assistant's reply, returns it.

Three other places write directly into this table as system-triggered
messages, not through the chat endpoint:
- `adapt.py:690` — a proactive note when a change event fires (weather, etc.)
- `seed.py:185` — demo data seeding
- `main.py:471` — booking confirmation ("🎉 {title} is booked!")

Goal: let a traveler see and return to past conversations (a history drawer,
opened from a hamburger icon top-left of Assist), while system-triggered
messages keep showing up wherever the traveler is currently looking.

## Data model

**New table `ChatThread`:**
```python
class ChatThread(Base):
    __tablename__ = "chat_threads"
    id: int
    tour_id: int          # indexed
    title: str             # default: truncated first user message, or "New chat"
    created_at: datetime
    updated_at: datetime   # bumped on every message appended to this thread
```

**`ChatMessage` gains one column:**
```python
    thread_id: int | None  # indexed, nullable — see backfill below
```

**`Tour` gains one column:**
```python
    active_thread_id: int | None  # nullable
```

Nullable so this ships without a manual migration step: SQLAlchemy's
`create_all` adds the new table and the app adds new columns via a tiny
startup check (see Backfill). Existing rows read fine with `thread_id IS
NULL` until backfilled.

## Backfill (no manual migration)

On the first read of a tour's chat (`GET /tours/{id}/chat` or the POST
handler, whichever runs first), if `tour.active_thread_id is None`:
1. Create one `ChatThread` for the tour, `title="Trip chat"`.
2. Set every existing `ChatMessage` for that tour with `thread_id IS NULL`
   to this new thread's id.
3. Set `tour.active_thread_id` to this thread's id.

This runs once per tour, is idempotent (guarded by the `active_thread_id`
check), and needs no Alembic/migration tooling — consistent with how this
codebase already handles schema growth (SQLite dev db, `create_all` on
startup, no migration framework in the repo).

## Endpoints

- `GET /tours/{id}/chat/threads` — list threads for the tour, newest
  `updated_at` first. Each row: `{id, title, updated_at, preview}` where
  `preview` is the last message's text, truncated to ~60 chars.
- `POST /tours/{id}/chat/threads` — create a new thread, set it active,
  return `{id, title, updated_at}`. Title starts as `"New chat"`; the first
  user message sent in it renames it (truncated to ~40 chars) if it's still
  the default title.
- `POST /tours/{id}/chat/threads/{thread_id}/activate` — set
  `tour.active_thread_id`, return `{id, title, updated_at}`. 404 if the
  thread doesn't belong to the tour.
- `GET /tours/{id}/chat` — **unchanged signature**, now returns only the
  active thread's messages (was: all messages for the tour).
- `POST /tours/{id}/chat` — **unchanged signature**, appends to the active
  thread. Runs the backfill check first if needed.

System-message call sites (`adapt.py`, `seed.py`, `main.py`) change from
`ChatMessage(tour_id=tour.id, ...)` to also passing
`thread_id=tour.active_thread_id`, running the same backfill-if-needed
check first so `active_thread_id` is never `None` when they fire.

## Frontend

- `api.js`: add `chatThreads(id)`, `newChatThread(id)`,
  `activateChatThread(id, threadId)`. Existing `chat`/`say` unchanged.
- Assist header gets a hamburger icon, top-left, opposite the settings gear.
  Tapping it opens a slide-over drawer (reuse the existing sheet/dialog
  pattern already used elsewhere, e.g. `ui.jsx`'s dialog component) listing
  threads: title, preview, relative time, newest first. A "New chat" row
  pinned at the top of the list.
- Picking a thread: call `activateChatThread`, then re-fetch `chat`, close
  the drawer. Picking "New chat": call `newChatThread`, clear `msgs` to
  `[]` (shows the empty-state greeting from the current redesign), close
  the drawer.
- No change to message send/receive logic — same `send()` function, same
  `api.say` call, since the backend always resolves "the active thread" on
  its own.

## Error handling

- Activating a thread that no longer exists (e.g. stale drawer data):
  backend 404s, frontend shows the existing toast error pattern
  (`notify(e.message, 'error')`, already used in `send()`) and leaves the
  current thread active.
- Backfill runs inside the existing request's db session/transaction, so a
  failure there fails the request the same way any other db error does
  today — no new failure mode introduced.

## Testing

- Manual: open Assist on a tour seeded before this change (no threads yet)
  — confirm its existing messages appear under a "Trip chat" thread after
  the first load, confirm "New chat" produces an empty conversation with
  the existing greeting UI, confirm switching back restores the original
  history, confirm a weather-triggered message (via the existing
  `run_trigger` flow) lands in whichever thread is currently active.
- `vite build` + a Playwright pass on the drawer open/close/switch flow at
  375px, matching the audit style already used for this app's other pages.

## Out of scope

- Auth and onboarding (separate specs).
- Deleting or renaming threads from the UI (backend supports renaming
  implicitly via the first-message rule; no delete endpoint, no manual
  rename UI, in this pass — flag if you want it).
- Cross-tour history (a traveler with multiple tours only ever sees the
  current tour's threads, matching how the rest of the app scopes state
  to `tour.id` today).
