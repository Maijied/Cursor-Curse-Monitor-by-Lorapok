# Browser — post line comments (no PAT)

Fast path learned from PR 16775. **Do not** use side-by-side diff for posting.

## Per comment

1. Open single-file URL (from `pr-file-url.sh`):
   `https://dev.azure.com/Shohoz/ticket/_git/bus/pullrequest/{id}?_a=files&path=/app/.../File.php`
2. `browser_lock`
3. Click **speech-bubble** in gutter: DOM class `repos-add-comment-button`, or snapshot `button` ref beside the target line in the **right (new)** pane
4. `browser_type` into **Add a comment** textbox — short team-style text
5. Click **Comment** button
6. Repeat for next file/line
7. `browser_unlock`

## Tips

- Rename-only files → single pane, bubble on hover by line number
- Rename+edit → split diff: click gutter on **right** side at line Y (`browser_mouse_click_xy` ~x=455), then click bubble button ref
- Skip lines already fixed on `origin/<branch>` — run `remote-diff.sh <file>` first
- If `browser_type` blocked → print comments + URLs for manual paste (do not retry CDP loops)

## Comment tone

See [comment-style.md](comment-style.md) — 1–2 sentences, "Plz", "Same here", no AI fluff.
