# docs.pointillviz.com

The PointillViz documentation: eleven tutorials in five groups, a docs home with search, and a 404 page. GitHub Pages serves this folder as it is (`CNAME`, `.nojekyll`), so there is no build step at serve time.

Every page except the shared design system is **generated** from one data file. Edit the data, then regenerate. Do not edit the generated HTML by hand: the next build overwrites it.

## What is in this folder

| Path | What it is | Edit? |
|---|---|---|
| `data/pages.json` | Every word of the docs: groups, pages, outlines, captions, the shell's labels, the page metadata | Yes |
| `data/tutorials/<slug>.html` | A written tutorial's body (optional; see below) | Yes |
| `data/media.json` | Sizes of the captures, written by the media script | No |
| `assets/docs/docs.css`, `docs.js` | The docs shell: sidebar path, search, contents, cards, skeletons, figure loops | Yes |
| `assets/media/` | Real captures re-encoded as WebP (`-640`, `-960`, `-1280`, `-1600`), three muted loops (`-loop.mp4`), the home's specimen plate (`home-plate-*`), the Multimodal page's modality maps and the social cards (`og/`) | No, regenerate |
| `assets/pv/` | The shared design system, copied from `shared/pv/` by `tools/sync.sh` | Never |
| `index.html`, `<slug>/index.html`, `404.html`, `sitemap.xml`, `robots.txt`, `CNAME` | Generated | No |

## Regenerate

The generators live in the web workspace, one folder up from this one (`tools/`). From the workspace root:

```sh
python3 -B tools/build_docs.py
```

That rewrites the home, the eleven pages, the 404 page, the sitemap and the search index (inlined in every page). It uses only the Python standard library.

GitHub Pages serves `404.html` at any unknown address, also a deep one (`/a/b/`). On the live site the page then sets its base to the site root, writes its stylesheets and scripts after that base (and lazy-loads its logos), so the browser never fetches them from the missing folder; without scripts, `<noscript>` links still style it.

When a page's picture changes, rebuild the media first (it reads app captures and figure panels, and needs Pillow; the workspace uses the `penv` environment):

```sh
python -I tools/build_docs_media.py --sheet    # crops, WebP, loops, social cards; --sheet writes a contact sheet to review
python -I tools/build_docs_media.py --no-loops # the same, keeping the loops of the last run (they take a minute)
python3 -B tools/build_docs.py
```

Crops are set in `tools/build_docs_media.py`, in source pixels, at 16:10. A crop never shows a dataset ID: cut the viewer's header away. Sources are app captures, figure panels and frames of the app footage in `trailer/footage/` (read only). A page can also have a tighter crop for its card on the home (`card_crop`) and its own crop on phones (`phone_crop`, served by a `<picture>` source).

The Atlases figure is shot from a running viewer by `tools/capture_docs_media.cjs` (start one from the app repository first: `python -m backend.serve 8798`): the Atlas tab's montage of a Xenium 5K mouse tissue microarray, every section at full detail, coloured by one gene's level through the Genes tab, with the cell size set in the Style widget. It writes `data/captures/atlases.png` in the workspace and a sidecar with every setting and the 16:10 frame the cells were fitted into, which the media script crops (`"crop": "frame"`). Rerun it, then the two build scripts, to change the gene or the layout.

The loops (2D data, 3D data, Transcripts) are H.264, at most 1280 px wide and at most 1 MB, and start on the page figure's frame. A loop is either a stretch of footage played forward then back (`pingpong`), or a camera move retimed to ease out of the figure's frame and back into it (`eased`, the Transcripts dive), so it closes without a jump. `docs.js` loads one only after the page has loaded, plays it only while it is in view and the tab is visible, and gives it a Pause button; with reduced motion it waits for Play. The button sits over the corner of the capture with the least of the app's UI in it (`corner` in the loop's entry of `SOURCES`), and on phones under the picture, at the end of the caption.

Every lead figure is mounted on a dark mat, so its registration marks sit on the ink and never on the app's panels.

The Polygons figure is drawn by the media script from the colon section's own segmentation polygons (the viewer's `PGB2` tiles, every vertex), each cell filled and outlined in its cell-type colour, like the home's specimen plate.

Preview locally with any static server, for example `python3 -m http.server 8000` from this folder, then open `http://localhost:8000`. All links inside the site are relative, so the same files work at the production root and in a subfolder.

## Write a tutorial page

Each page is in preparation until its tutorial exists. To publish one:

1. Write the body as an HTML fragment in `data/tutorials/<slug>.html` (for example `data/tutorials/importing.html`). No `<html>`, `<head>` or `<body>`, and no `<h1>`: the page's title, summary and breadcrumbs come from `pages.json`.
2. Start each section with an `<h2>`. The build gives it an `id` if it has none, lists it under "On this page", and adds it to the search index. Keep the section titles of the outline in `pages.json` unless the tutorial needs others.
3. Build the body from the house style, so it looks like the preview the placeholder shows. The body is set as `.pv-prose`, so plain `<p>`, lists, links, `<code>` and `<kbd>` are styled already.

   | Block | Markup |
   |---|---|
   | Numbered steps | `<ol class="pv-steps"><li><p class="pv-steps__title">…</p><p>…</p></li></ol>` |
   | Figure | `<figure class="pv-figure"><div class="pv-figure__stage" data-theme="dark"><img src="../assets/media/…" alt="…" width="…" height="…"></div><figcaption class="pv-figure__caption">…<span class="pv-figure__meta">Xenium 5K · mouse colon</span></figcaption></figure>` |
   | Code, with its copy button | `<figure class="pv-code"><figcaption class="pv-code__head"><span class="pv-code__title">file.py</span><button class="pv-code__copy" type="button" data-pv-copy><span class="pv-code__copy-label">Copy</span></button></figcaption><pre tabindex="0"><code>…</code></pre></figure>` |
   | Note, tip, caution | `<aside class="pv-callout pv-callout--note"><p class="pv-callout__title">Note</p><p>…</p></aside>` (also `--tip`, `--caution`) |
   | Parameter table | `<div class="pv-table-wrap" role="region" tabindex="0" aria-label="Parameters"><table class="pv-table">…</table></div>` with the head Parameter · Type · Default · What it does |

   The live examples and the full list are in the design system's styleguide (`shared/styleguide.html` in the workspace).
4. Regenerate. The page loses its "Tutorial in preparation" state, and its headings become searchable. (When every page is written, also change the home's lede in `pages.json`, which says the tutorials are in preparation.)

Paths inside a tutorial are relative to the page's folder: `../assets/…`, `../2d-data/#gating`.

## Add or change a page

A page is one entry of `pages` in `data/pages.json`:

| Field | Meaning |
|---|---|
| `slug` | The folder and the address: `importing` is served at `/importing/` |
| `group` | One of the `groups` (Start, Data, Layers, Results, Extend). Pages are listed in group order |
| `title`, `summary` | The page's name, and one line of at most 20 words. They are also its `<title>`, description and social card text |
| `case` | Data pages only: `2d`, `3d`, `atlas` or `omics`, the homepage's four cases (colour and corner label) |
| `keywords` | Hidden search terms: other names and spellings people type (`UMAP`, `MCP`, `tiff`, `h5ad`), and the names of the tools a page will cover. A result found only through one says so ("Covers UMAP") |
| `links` | Optional buttons beside the page's status and links on its card, to the other two sites only (the Tool Store page links the store and its Build & publish page) |
| `sections` | The outline. Each `preview` lists the house-style blocks of the placeholder; it shows two skeleton lines and the first block named. A section's own `keywords` send a match to that section: "violin" opens 2D data at The Tools gallery |
| `figure` | The page's real capture: `alt`, `caption`, `meta` (technology · tissue · scale), and `note` when a picture needs a caption wherever it appears (the simulated molecule positions). The Multimodal page's figure also lists its `plates` (one per modality, with its hue) |

The home's "Start here" path is `site.start_here.steps`: each step names a page and gives it one short line of its own (the cards below carry the full summaries).

A new page also needs its capture: add it to `SOURCES` in `tools/build_docs_media.py`, run the media script, then the page build. The build stops with a message if a page has no capture, an unknown group, or a summary over 20 words.

## House rules

- Copy follows `brief/CONTENT.md` in the workspace: precise, calm, no hype, README spelling (colour, visualize). An Assistant result is model output; say what the Assistant allows, never that it is right.
- Real content only: every picture is a capture of the app, a frame of its footage, a figure panel, or real data drawn by the media script (the home's specimen plate: every cell of the colon section in its own cell-type colour; the Polygons figure: that section's own segmentation polygons), labelled by technology, tissue and scale, never by dataset ID. Molecule pictures of the colon carry "Molecule positions simulated from the measured counts."
- Links inside the site are relative. Links to the other two sites are `https://pointillviz.com/` and `https://store.pointillviz.com/`.
- Nothing links to the PointillViz source code, and nothing credits a lab or an institute. Anything not available yet is `href="#"` with `data-placeholder`, and shows "Coming soon".
- The top bar and the footer are the shared chrome in `shared/CHROME.md`; keep them as they are.
