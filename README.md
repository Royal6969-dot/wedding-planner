# Ever After Planner

A phone-first wedding planner MVP. You tap photos to pick your wedding, watch the price update live, and get a (fake) invoice at the end.

## How it works

1. **Intro**: enter your names, the date and how many guests.
2. **8 picks**: venue, decor, flowers, food, cake, music, photo and extras. Every option is a big photo card. Extras let you pick more than one.
3. **Invoice**: a moodboard of everything you picked, plus an invoice with line items, a 10% coordination fee, 7% tax, a 30% deposit and the balance due date. You can change the guest count there and the price updates.

The "Pay deposit" button is fake. It just stamps the invoice as paid and throws confetti.

Your picks are saved in the browser (localStorage), so a refresh doesn't wipe them.

## Run it

No build step, it's plain HTML/CSS/JS.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To put it online for free: on GitHub go to **Settings → Pages**, pick "Deploy from a branch" and choose this branch with the `/ (root)` folder.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | All the screens |
| `css/styles.css` | Styles, mobile first, light + dark mode |
| `js/data.js` | Every option, price and the fee rates. Edit this to change prices or add options |
| `js/app.js` | Navigation, pricing, invoice and the fake payment |
| `assets/img/` | Option photos, generated with Higgsfield (GPT Image 2.5) |

## Changing prices or options

Everything lives in `js/data.js`. Each option has:

- `price`: a number in USD
- `unit`: `"event"` (flat price), `"guest"` (times the guest count) or `"slice"` (cake, one slice per guest)
- `img`: the file name in `assets/img/` without `.webp`

All prices are made up.
