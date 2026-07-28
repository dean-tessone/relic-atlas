# Relic Atlas

Relic Atlas is an unlimited museum geography and history guessing game. Every
expedition contains exactly ten randomly selected objects from The Metropolitan
Museum of Art's Open Access collection.

For each relic, players:

1. Study the object and its material.
2. Place a pin on a world map.
3. Estimate when the object was made.
4. See the true origin, date, and per-round score.

The ten round scores combine into a final score out of 100,000. Completed object
IDs are stored locally in the browser and excluded from future expeditions to
minimize repeats on the same device.

## Features

- Unlimited ten-relic expeditions
- Randomized live object pool from The Met Collection API
- Geographic and historical proximity scoring
- Immediate object reveals and a final expedition ledger
- Device-local repeat avoidance and personal-best tracking
- Responsive desktop and mobile layouts
- No account or API key required

## Run locally

Relic Atlas requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validate a production build

```bash
npm test
```

This creates the Cloudflare-compatible vinext build and verifies the rendered
product shell and metadata.

## Data and imagery

Collection records and public-domain object images come from
[The Met Open Access program](https://www.metmuseum.org/hubs/open-access) through
[The Met Collection API](https://metmuseum.github.io/). The world map image is
the freely reusable
[Earthmap1000x500](https://commons.wikimedia.org/wiki/File:Earthmap1000x500.jpg)
from Wikimedia Commons.

## License

The application code is released under the [MIT License](LICENSE). Third-party
collection data and imagery retain their respective source terms.
