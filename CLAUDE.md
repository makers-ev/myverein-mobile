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
   This applies to **every work package, in the same commit** — not only at the
   end of a wave. If the README does not yet describe your change, the work is
   not done.
8. **Tick off the Feature List.** Every feature, fix or behaviour change you
   deliver — however small — must be recorded in the vault's
   `20_Products/MyVerein/Roadmaps/Feature List - MyVerein.md` (repo
   `lpj-its-vault`): add a row or flip ⬜ → ✅ with platform and date, move
   leftovers to "Weiterhin offen", and tick the matching task package in the
   wave's `20_Products/MyVerein/PRDs/Implementation Plan - MyVerein Wave N.md`.
   Do this as part of the same piece of work (a paired vault commit on a
   branch of the same name). Also create or update the matching training
   material in the vault's `20_Products/MyVerein/Schulung/` (template
   `tpl-schulung`: where to find it on website/app, how it works, who may use
   it, FAQ) and link it from `Schulung - Übersicht und Lernpfade`. A feature
   is not done until it is ticked off and has its Schulung entry. If
   the vault is not available in the session, say so explicitly in the summary
   and list the exact Feature List entries that still need to be made.
9. **All-in-one sanity check.** Before you summarize, think again about
   whether what you built actually makes sense for MyVerein as an
   **all-in-one club manager (everything digital except billing)**: Does it
   remove a media break (Excel, WhatsApp, paper) or introduce a new one? Does
   it work for every role involved (Mitglied, Vorstand, Abteilungsleitung,
   Erziehungsberechtigte, members without an account)? Are rights
   deny-by-default and the UI gated by `permissions`? Is the experience
   coherent between website and app, and understandable for non-technical
   volunteers (≤ 3 taps for core tasks, designed empty/loading/error states)?
   Report gaps honestly in the summary and record them in the plan's
   "Beitrag zum All-in-One-Ziel" section and the Feature List's
   "Weiterhin offen".
10. Summarize what was built at the end. Do NOT merge anything automatically.

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

## Media security rule

Every image or document upload and download goes through the central media
security layer (see the vault's `Implementation Plan - MyVerein Wave 7`, B18,
modelled on MyCouple's `Implementation Plan - Media-Zugriffskontrolle
(Sicherheitsfix)`): the upload registry (`media_files`), keys instead of URLs
in feature tables, short-lived **signed URLs issued only after the feature
route's own permission check**, sensitive documents streamed only with
authentication and an audit entry, central magic-byte/size/EXIF checks, quota,
`Cache-Control: private`. Never persist or return a raw/public media URL, never
add a feature-specific file-serving path, and never serve user files without
going through that layer (the only exception is explicitly opted-in
`public_opt_in` media). New upload features must extend the layer's tests.
