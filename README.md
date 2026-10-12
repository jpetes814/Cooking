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
8. Star ratings and a "cooked it" log
9. Check a recipe over before saving it
10. Past cooks and notes for next time
11. Ideas for tonight, with optional local weather
12. What can I make? Type what you have, see which of your recipes use it, or find new ones on the web
13. Cooking method, cook time, and effort: tags, filters, and smarter web searches
14. Shopping trips: one merged list for several recipes, and adjustable servings
15. Send to Recipe Box: paste or share a link and it fills in
16. "Use it up": recipes that share what you're already buying
17. Backup and copy between the test and real app (photos not included yet)

## Ideas for tonight and your location

Ideas for tonight are picked on your phone from your own recipes. If you tap **Use local weather**, the phone asks for your location once, rounds it to about 10 km, and sends only those rounded numbers to [Open-Meteo](https://open-meteo.com) for the current weather. Nothing goes to our server or into your recipes. The last reading stays on the phone so ideas still work with no signal, and **Turn off weather** forgets it.

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
