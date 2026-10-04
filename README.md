# schimunek website

Personal academic website, built with [Astro](https://astro.build) as a static site.
Design: "A · Basalt" from the Claude Design canvas.

## Editing content

Everything shown on the page lives in `src/data/`:

| File | What |
| --- | --- |
| `profile.yaml` | Name, intro, links, model card, bio, organiser bio, email |
| `publications.yaml` | All publications; `selected: true` puts one under "Selected publications" |
| `publications-ignore.yaml` | Papers the weekly check should never propose |
| `talks.yaml` | Talks & awards |
| `community.yaml` | Community & teaching |

Other files:

- `src/assets/portrait.jpg` is the hero photo (resized and converted to AVIF/WebP at build time).
- `public/johannes-schimunek.jpg` is the photo organisers download.
- `public/cv.pdf` is the CV. The CV link appears automatically once this file exists.
- `src/pages/impressum.astro` is the legal notice and privacy policy.

## Running locally

Node comes from a conda env:

```sh
conda env create -f environment.yml   # once
conda activate website
npm ci                                # once, or after package.json changes
npm run dev                           # http://localhost:4321, reloads on save
npm run build                         # writes the finished site to dist/
```

## Deploying

`.github/workflows/pages.yml` builds the site on every push to `main` and publishes it on GitHub Pages
(Settings → Pages: source "GitHub Actions", custom domain `johannes-schimunek.de`, "Enforce HTTPS").

The domain is registered at Strato; its DNS records point to GitHub Pages:

| Host | Type | Value |
| --- | --- | --- |
| `johannes-schimunek.de` | A | `185.199.108.153` (GitHub lists `.109`, `.110`, `.111` as well) |
| `johannes-schimunek.de` | AAAA | `2606:50c0:8000::153` |
| `www` | CNAME | `tschoui.github.io` |

## Publication updates

`.github/workflows/check-publications.yml` runs every Monday (or by hand under Actions). It asks
Semantic Scholar for papers that are not yet in `publications.yaml` and opens a pull request adding
them. Check venue, label and authors on the PR, then merge. To get rid of a paper for good, close the
PR and add the title to `publications-ignore.yaml`.

For this to work, enable Settings → Actions → General → "Allow GitHub Actions to create and approve
pull requests". An optional `S2_API_KEY` secret avoids Semantic Scholar rate limits.

Run it locally with `npm run check-publications` (or add `-- --dry-run` to only print what it finds).
