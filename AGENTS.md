<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Context Rules

Before doing substantial analysis, planning, or implementation work on this repository, read:

1. `ai_context/README.md`
2. the context files referenced there, following the documented reading order

Treat the files in `ai_context/` as the shared project context for product scope, domain rules, roles, user flows, database assumptions, technical baseline, and open questions.

# Working Rules For This Repo

* Do not invent domain rules that conflict with `ai_context/`.
* Past architectural decisions, with their reasons and rejected alternatives, are in `docs/adr/`. Do not reverse one silently: write a new ADR that supersedes it.
* Planned work is in `docs/roadmap/`. If implementation depends on an unresolved choice, check the "decidere" tasks there first.
* If a task changes product scope, domain behavior, permissions, or major technical direction, update the relevant file in `ai_context/` before or together with the code change, and add an ADR in `docs/adr/` for architectural decisions.
* When a roadmap task is done, update its status in `docs/roadmap/` in the same commit.
* Use `ai_context/prisma_model.md` and `ai_context/db.md` as the baseline reference for the current data model until the real Prisma schema is introduced or updated.

# Step Completion Checklist

At the end of every planning step:

1. Run `npx tsc --noEmit` — fix any TypeScript errors before committing.
2. Run `npm run build` — verify the production build completes without errors.
3. Commit everything including `.claude/` and `ai_context/.claude/`.

# UI Component Library

This project uses **PrimeReact** (v10) with the `lara-light-blue` theme, combined with **Tailwind CSS** for layout.

**Always use PrimeReact components** when working on existing or new UI:
- `Button` (from `primereact/button`) — replaces all `<button>` elements
- `InputText` (from `primereact/inputtext`) — replaces text `<input>` elements
- `Password` (from `primereact/password`) — replaces password inputs
- `Dropdown` (from `primereact/dropdown`) — replaces `<select>` elements (use hidden input for form name/value)
- `InputNumber` (from `primereact/inputnumber`) — replaces number inputs (use hidden input for form value)
- `Calendar` (from `primereact/calendar`) — replaces date/time inputs (use hidden input for form value)
- `DataTable` + `Column` (from `primereact/datatable`) — replaces HTML `<table>` elements
- `Dialog` (from `primereact/dialog`) — replaces `<dialog>` elements
- `Tag` (from `primereact/tag`) — replaces status badge spans
- `ConfirmPopup` / `confirmPopup` (from `primereact/confirmpopup`) — replaces `window.confirm`

**Layout** (spacing, flex, grid, width) stays in Tailwind. `PrimeReactProvider` is set up in `components/providers.tsx`.
