# ✍️ Adding posts with Claude Code (`/add-post`)

The repository ships a [Claude Code](https://claude.com/claude-code) skill, `add-post`, that adds a new card to the **Posts** section. You give it an article link; it writes the English and Portuguese title and description, runs all of that text through the [Humanizer](https://github.com/blader/humanizer) skill so it doesn't read like generated copy, saves the thumbnail and inserts the record into `src/assets/data/posts.json`.

- [Requirements](#requirements)
- [Usage](#usage)
- [What the skill does](#what-the-skill-does)
- [Writing rules](#writing-rules)
- [Validating posts.json](#validating-postsjson)
- [Adding a post by hand](#adding-a-post-by-hand)
- [Files](#files)
- [Troubleshooting](#troubleshooting)

## Requirements

1. **Claude Code**, started from the repository root. Project skills in `.claude/skills/` are picked up automatically.
2. **The Humanizer plugin.** The skill refuses to write posts without it. Install it once, inside Claude Code:
   ```
   /plugin marketplace add blader/humanizer
   /plugin install humanizer@humanizer
   ```
   Check that `humanizer:humanizer` shows up in `/skills`.
3. **Node.js** (already required by the project), for `scripts/posts.mjs`.
4. **ImageMagick** (`magick`), optional. It resizes the thumbnail to match the existing ones. Without it, the image is copied as-is.

## Usage

In Claude Code, run the skill with the article link, and optionally the publish date (`MM-DD-YYYY`) and a thumbnail:

```
/add-post https://www.linkedin.com/pulse/my-article/ 10-20-2026 ~/Pictures/cover.jpg
```

Asking in plain words works too, for example *"add my new LinkedIn article to the posts section"*. Claude asks for anything that's missing.

Claude shows you both languages, with character counts and a note on what the Humanizer changed, **before** it touches any file. Approve it or ask for changes. When it's done, review the diff (`posts.json` plus one image in `src/assets/posts/`) and run the checks below before committing.

## What the skill does

1. **Gathers** the URL, date, thumbnail and article text. It fetches the article; LinkedIn and Medium often block that, so it may ask you to paste the text or a short summary. It never makes up what the article says.
2. **Drafts** the title (the article's real title) and a one- or two-sentence first-person description, in the article's own language.
3. **Humanizes** that text with `humanizer:humanizer`.
4. **Translates** it into the other language (English ↔ Brazilian Portuguese) and **humanizes the translation** as well. Every title and description, in both languages, goes through the Humanizer.
5. **Asks for your approval.** If you edit the wording, your edit is humanized again.
6. **Saves the thumbnail** as `src/assets/posts/post-MM-DD-YYYY.jpg`: a progressive JPEG about 626 px wide, like the others. Without an image, it uses `assets/posts/thumbnail-placeholder.png`.
7. **Inserts the record** with `scripts/posts.mjs add`. The script validates the record and puts it where it keeps the list newest-first. Other records and the file's formatting stay as they are.
8. **Verifies** with `npm run validate:posts`, then points you to `npm run lint` and `npm run test:e2e`.

It doesn't commit anything unless you ask.

## Writing rules

These rules are enforced by the skill and, where marked, by the script:

| Rule | Why |
| --- | --- |
| Description ≤ 275 characters per language, **counting HTML tags** *(script)* | The card cuts the raw string at 275 (`[ellipsis]="275"` in `posts-carousel.component.html`), which can break mid-word or mid-tag. |
| Only `<b>` and `<i>`, balanced *(script)* | Descriptions are rendered with `innerHTML`. |
| Exactly one `en` and one `pt` entry, both non-empty *(script)* | Each locale build shows only its own language; a missing one leaves the card blank. |
| `date` is a real `MM-DD-YYYY` date *(script)* | The card formats it with the `safariDateFormatter` and `localizedDate` pipes. |
| `http` is `https`, unique; thumbnail exists, unique *(script)* | Broken links/images and duplicate cards. |
| All text humanized, first person, no invented facts *(skill)* | Matches the voice of the existing posts. |

## Validating posts.json

```bash
npm run validate:posts
```

This checks the whole file with the rules above and also runs in CI (`.github/workflows/ci.yml`). Older posts with descriptions over 275 characters only produce **warnings**. For a new post, the same thing is an **error**.

## Adding a post by hand

You can skip Claude and still use the script:

1. Copy `.claude/skills/add-post/post-template.json` somewhere outside the repo and fill it in.
2. Put the image at `src/assets/posts/post-MM-DD-YYYY.jpg`.
3. Run:
   ```bash
   node .claude/skills/add-post/scripts/posts.mjs add path/to/record.json --dry-run
   node .claude/skills/add-post/scripts/posts.mjs add path/to/record.json
   ```

Written this way, the text doesn't go through the Humanizer.

## Files

| Path | Purpose |
| --- | --- |
| `.claude/skills/add-post/SKILL.md` | The workflow and rules Claude follows. |
| `.claude/skills/add-post/scripts/posts.mjs` | `validate` and `add` commands (Node, no dependencies). |
| `.claude/skills/add-post/post-template.json` | A blank post record. |
| `src/assets/data/posts.json` | The posts data. |
| `src/assets/posts/` | Thumbnails. |

## Troubleshooting

- **"humanizer:humanizer is not available".** Install the plugin (see [Requirements](#requirements)), then restart Claude Code.
- **`/add-post` isn't listed.** Start Claude Code from the repository root (or a worktree of it) so `.claude/skills/` is found.
- **"description is N characters".** Shorten it. Tags count toward the 275.
- **"thumbnail file … does not exist".** Save the image before running `add`. The path in the record is relative to `src/`.
- **The card doesn't show up locally.** Reload `npm run start:en` / `start:pt`. JSON assets aren't always hot-reloaded.
