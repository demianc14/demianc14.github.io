# Demian Cruz · portfolio

Personal site: HTML, CSS and vanilla JavaScript. No framework, no build step.

## Run locally

The page loads `data/projects.json` with `fetch`, so open it through a local server, not as a file:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Add a project

Add one object to `data/projects.json`:

```json
{
  "stack": "python-ai",
  "title": "repo-name",
  "summary": "Two lines on what it does.",
  "tags": ["Python", "pytest"],
  "repo": "https://github.com/demianc14/repo-name",
  "demo": "https://… (optional)",
  "preview": "assets/previews/repo-name.jpg (optional)",
  "previewAlt": "What the screenshot shows",
  "command": "the main command, shown when there is no screenshot",
  "badges": [{ "label": "CI ✓", "source": "link where this can be verified" }],
  "secondary": false
}
```

- `secondary: true` puts the card under "More projects".
- Badges only for facts stated in the repo (README or Actions). Every badge links to its source.
- Screenshots: 16:9, under 150 KB, synthetic data only.

## Layout

Two columns on wide screens: a fixed identity panel on the left (name, section nav that follows your scroll, status log, links) and the scrolling content on the right. On small screens it collapses to one column with sticky section titles.

Layout loosely inspired by [Brittany Chiang's v4](https://github.com/bchiang7/v4) (MIT). No code copied.

## Deploy (GitHub Pages)

Push to a repo, then Settings → Pages → branch `main`, folder `/ (root)`.
A repo named `demianc14.github.io` is served at https://demianc14.github.io.
