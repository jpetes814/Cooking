# Recipe Box

A recipe library and shopping planner that lives on your phone.

Snap a cookbook page, save a screenshot, or paste a TikTok, Instagram, or YouTube link. Claude reads the photo and fills in the recipe and some tags for you to check. Organize with tags and sub-tags (`soup`, `season/fall`, `cuisine/thai`), then find things by tag or by what's in them ("chicken and lemon"). When it's time to shop, pick a few recipes and get one combined list, grouped by aisle, with your pantry staples left off and suggestions for other recipes that use the same ingredients. It keeps working with no signal.

## Status

Being built in small steps, each one a pull request you can test on your phone before it goes live:

1. Installable app shell that opens offline, CI, docs
2. Sign-in and offline data, with security rules
3. Add, view, and edit recipes (typed in or from a link)
4. Fill from link: recipe pages, TikTok and YouTube captions
5. Recipe photos
6. Tags, sub-tags, and search
7. Claude reads a recipe photo and suggests tags
8. Shopping trips: one merged list for several recipes
9. "Use it up": recipes that share what you're already buying

## Docs

- [docs/SETUP.md](docs/SETUP.md): one-time setup (Vercel, Firebase, API keys, repo settings)
- [docs/CO-BUILDING.md](docs/CO-BUILDING.md): how to suggest, build, test, and merge changes, mostly from your phone
- [CLAUDE.md](CLAUDE.md): conventions every Claude Code session follows

## Run it locally

```
npm ci
cp .env.example .env.local   # fill in what you have
npm run dev
```

`npm run check` runs lint, typecheck, unit tests, and a production build. `npm run test:e2e` runs the phone-size browser tests.
