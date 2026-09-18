# Orchestration

You are the lead for this repo. Workflow for every task:

1. If `graphify-out/graph.json` exists: use `graphify query "<question>"` to
   get an overview before blindly searching the repo.
2. Read the relevant concept/requirement and the current state of the repo.
3. Create a short plan (tasks), show it to the user, and wait for their OK.
4. Delegate implementation tasks to the appropriate subagents from
   `.claude/agents/` (max 3 in parallel, batched into a single message with
   multiple tool calls). Give each subagent the relevant file paths and the
   concept excerpt — subagents start without your context.
5. After every implementation: have the reviewer subagent look it over, send
   issues back to the respective dev.
6. After code changes: run `graphify . --update` (not a full rebuild) to
   keep the graph current.
7. **Update `README.md`.** Any new/changed screen, nav entry, storage key,
   or config variable gets reflected in the README's "Screens"/
   "State and storage"/"Configuration" tables in the same change that adds
   it — the README is the technical overview of this repo and must never
   drift from the code.
8. Summarize what was built at the end. Do NOT merge anything automatically.

## Available subagents in this repo

- `rn-ui-dev` — builds screens/components/styling. Use for views/styling.
- `rn-state-nav-dev` — builds navigation, state, auth wiring. Use for
  routing/stores/auth logic.
- `rn-reviewer` — reviews mobile code for quality, consistency, and
  adherence to the concept. Read-only, no code changes.

## Graphify

This repo uses graphify for codebase context. If `graphify-out/graph.json`
exists, use `graphify query "<question>"` to get an overview before blindly
searching the repo. To build or rebuild it, use the `/graphify` skill
(`/graphify .`) — not the standalone `graphify` CLI directly. The CLI's
default semantic-extraction backend (Gemini) needs its own API key and can
break in environments without one; the `/graphify` skill instead runs
semantic extraction through Claude itself, no separate key required.

## Guest mode

This app is "browse first": `AppNavigator`'s root stack always mounts the
public screens (Home, Login, Signup, TwoFactor) — there is no split between
a fully-public and a fully-authenticated navigator. The one auth-based
branch is the initial route: guests land on Home, already-authenticated
users skip straight to `Dashboard` (a placeholder landing screen, swap it
for your real one) so a relaunch doesn't show a signed-in user the guest
marketing screen first. Beyond that initial route, no screen in the stack
is gated by default, including `Settings` — only the account-specific
sections inside it (Profile/Security/Sessions) check
`useAuth().isAuthenticated` themselves and swap for a sign-in prompt when
it's false. This is the mobile equivalent of the website's
`(protected)/layout.tsx` re-check, inverted: the website defaults every
route under `(protected)` to requiring a session and opts screens *out*
via routing; this app defaults every screen to public and opts screens
*in* to requiring a session, because a mobile app without a logged-in-only
paywall generally wants people looking around before they commit to an
account.

Two conventions cover the two ways a real product will need to gate
something, both redirecting to `Login` with a `returnTo` route name so a
real product can navigate back after sign-in (this template does not wire
that return-navigation itself past the login screen — see
`AppNavigator.tsx`'s `Login` route handler for where to add it):

- **Gate a whole screen** — wrap it in `src/auth/RequireAuth.tsx`:
  ```tsx
  <RequireAuth>
    <SettingsScreen ... />
  </RequireAuth>
  ```
  Renders nothing (or `fallback`) and redirects while `useAuth().isAuthenticated`
  is false. Use this for a screen that has no meaningful guest view at all.

- **Gate a single action on an otherwise-public screen** — call
  `src/hooks/useRequireAuth.ts`'s `requireAuth(action)` from the relevant
  `onPress`:
  ```tsx
  const { requireAuth } = useRequireAuth();
  <TouchableOpacity onPress={() => requireAuth(() => doTheThing())} />
  ```
  Runs `action` immediately if signed in; otherwise redirects to Login. Use
  this for the common case — a public screen (see `HomeScreen.tsx`) where
  guests can look around freely and only hit a login wall when they try to
  do something that actually needs an account.

`AppLockGate` wraps the whole navigator unconditionally and stays inert for
guests: the App Lock PIN can only be created from `Settings`, which is
itself gated, so a guest can never have a PIN configured in the first
place.
