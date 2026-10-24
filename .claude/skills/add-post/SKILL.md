---
name: add-post
description: Add a new article/post card to the resume's Posts section. Writes the English and Portuguese title and description, runs every piece of that text through the humanizer skill, saves the thumbnail in src/assets/posts/, and inserts the record into src/assets/data/posts.json (newest first). Use when asked to add, publish, feature or list a new post, article or blog entry on the site.
argument-hint: "<article URL> [MM-DD-YYYY] [path/to/thumbnail]"
---

# Add a post to the Live Resume

Each post is one record in `src/assets/data/posts.json`, rendered as a card by `src/app/posts/posts-carousel/`:

```json
{
    "thumbnail": "assets/posts/post-MM-DD-YYYY.jpg",
    "http": "https://…",
    "date": "MM-DD-YYYY",
    "internationalizations": [
        { "language": "en", "title": "…", "description": "…" },
        { "language": "pt", "title": "…", "description": "…" }
    ]
}
```

`post-template.json` next to this file is a blank copy. `scripts/posts.mjs` validates the file and inserts records; always use it instead of editing `posts.json` by hand.

## Rules

- **Every title and description goes through the humanizer skill**, in both languages, before it is written to disk. No exceptions, including text the user wrote themselves (show them what changed). If `humanizer:humanizer` is not available, stop and tell the user to install it (see "Requirements" in `docs/add-post-skill.md`); do not write posts without it.
- **Do not invent content.** Titles and descriptions only say what the article says. If you cannot read the article, ask the user to paste it or summarize it.
- **Description length:** at most 275 characters per language, *counting HTML tags*. The card truncates the raw string at 275 (`[ellipsis]="275"`), so a longer one can be cut mid-sentence or mid-tag. The script rejects longer descriptions for new posts.
- **Markup:** only `<b>` and `<i>`, balanced, and sparingly (one to three highlights, as in the existing posts). The text is rendered with `innerHTML`.
- **Voice:** first person, from the resume owner's point of view, matching the existing posts ("Have you ever considered…", "I noticed…"). Titles keep the article's real title and end with a period, like the existing ones.
- **Portuguese** is Brazilian Portuguese (`pt-BR`), written naturally, not word-for-word.
- Never reformat or reorder the existing records, and don't touch other sections' JSON.

## Workflow

### 1. Gather the inputs

You need four things. Take what the user gave in the arguments or message, and ask once for whatever is missing:

1. **Article URL** (`http`): must be `https`.
2. **Publish date** (`date`) in `MM-DD-YYYY`. If the article shows its date, use it and confirm with the user.
3. **Thumbnail image**: a local path or URL. If there is none, use `assets/posts/thumbnail-placeholder.png` and say so.
4. **Source text**: fetch the URL with WebFetch. LinkedIn and Medium often block fetches or require a login. If the fetch fails or returns a login wall, ask the user to paste the article text or a short summary. Note which language the article is written in.

### 2. Draft the text in the article's language

Write the title and the description in the language the article was written in (usually English):

- `title`: the article's own title, with a final period.
- `description`: one or two sentences, first person, that tell a reader what the article covers and why they might read it. Use the article's real specifics (the problem, the numbers, the tool), not generic praise. Stay under 275 characters including tags.

### 3. Humanize it

Invoke the skill with the Skill tool: `skill: "humanizer:humanizer"`. Give it the title and description, and tell it the context: a short teaser card on a personal resume site, first person, must stay at or under 275 characters including `<b>`/`<i>` tags, keep the tags, and do not add facts. Use its final rewrite.

Then check the result yourself:
- Names, numbers, dates and claims still match the source; nothing was added.
- Tags are still balanced and the length is still ≤ 275.

### 4. Write the other language, then humanize it too

Translate the humanized text into the other language (English ↔ Brazilian Portuguese), keeping the same highlights. Then run the humanizer skill again on the translation, telling it the text is Brazilian Portuguese (or English) and asking it to apply its structural checks: contrast framing ("não é X, é Y"), forced lists of three, inflated claims, one-line closers, dash overuse, sales language. Re-check facts, tags and length afterwards.

### 5. Show the user before writing

Show both languages side by side, with each description's character count, and list the main changes the humanizer made. Ask for approval or edits. If the user edits the wording, run their edit through the humanizer again and show the diff.

### 6. Save the thumbnail

Save it as `src/assets/posts/post-MM-DD-YYYY.jpg` using the post's date. If that file already exists for another post, add a suffix (`post-MM-DD-YYYY-2.jpg`). Match the existing thumbnails (progressive JPEG, about 626 px wide, under about 120 KB). With ImageMagick:

```bash
magick <input> -auto-orient -resize '626x>' -strip -interlace JPEG -quality 82 src/assets/posts/post-MM-DD-YYYY.jpg
```

If the input is a URL, download it to a temp file first. If ImageMagick is missing, copy a JPEG as-is and tell the user it wasn't resized. View the result with the Read tool to check that it looks right.

### 7. Insert the record

Write the approved record to a temp JSON file (outside the repo), then:

```bash
node .claude/skills/add-post/scripts/posts.mjs add <record.json> --dry-run   # checks it and shows the position
node .claude/skills/add-post/scripts/posts.mjs add <record.json>             # writes posts.json
```

The script rejects a record with missing or unknown keys, a bad date, a non-https URL, a missing thumbnail file, missing or duplicate `en`/`pt` entries, disallowed or unbalanced tags, a description over 275 characters, or an `http`/thumbnail already used by another post. Fix the cause and run it again. It inserts the post so the list stays newest-first and leaves the other records untouched.

### 8. Verify

```bash
npm run validate:posts      # whole file; warnings about older posts over 275 characters are expected
git diff --stat             # only posts.json and the new thumbnail should change
```

CLAUDE.md requires the browser suite before any commit: `npm run lint` and `npm run test:e2e`. To see the card, run `npm run start:en` and `npm run start:pt` (port 4200, `#posts`), or check `test-results/screenshots/` after the e2e run.

### 9. Report

Tell the user the final en/pt title and description, the thumbnail path, where the post landed in the list, and what the humanizer changed. Don't commit unless asked.
