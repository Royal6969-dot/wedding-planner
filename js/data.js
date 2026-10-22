// Every pick in the planner. Prices are made up for the MVP.
// unit: "event" = flat price, "guest" = price x guests, "slice" = price x guests (one slice each)
window.PLANNER_DATA = {
  fees: { coordination: 0.10, tax: 0.07, deposit: 0.30 },
  steps: [
    {
      id: "venue",
      label: "Venue",
      title: "Where are you saying I do?",
      hint: "Tap the one that gives you butterflies.",
      options: [
        { id: "beach", name: "Beach Sunset", blurb: "Barefoot vows by the ocean", price: 8500, unit: "event", img: "venue-beach" },
        { id: "garden", name: "Garden Estate", blurb: "Roses, fountains, a whole manor", price: 11000, unit: "event", img: "venue-garden" },
        { id: "ballroom", name: "Grand Ballroom", blurb: "Chandeliers and black tie energy", price: 16500, unit: "event", img: "venue-ballroom" },
        { id: "barn", name: "Rustic Barn", blurb: "String lights and farm tables", price: 6800, unit: "event", img: "venue-barn" }
      ]
    },
    {
      id: "vibe",
      label: "Decor",
      title: "Pick the vibe",
      hint: "Tables, candles, linens and all the little details.",
      options: [
        { id: "boho", name: "Boho", blurb: "Pampas, macrame, rattan", price: 2400, unit: "event", img: "vibe-boho" },
        { id: "classic", name: "Classic Glam", blurb: "Gold, crystal, candlelight", price: 4200, unit: "event", img: "vibe-classic" },
        { id: "modern", name: "Modern Minimal", blurb: "Clean lines, sage and white", price: 3100, unit: "event", img: "vibe-modern" },
        { id: "fairytale", name: "Fairytale", blurb: "Wisteria ceiling, 500 candles", price: 5600, unit: "event", img: "vibe-fairytale" }
      ]
    },
    {
      id: "flowers",
      label: "Flowers",
      title: "Choose your flowers",
      hint: "Bouquet, centerpieces and the ceremony arch.",
      options: [
        { id: "roses", name: "Blush Roses", blurb: "Garden roses and eucalyptus", price: 1800, unit: "event", img: "flowers-roses" },
        { id: "peonies", name: "Peony Cloud", blurb: "Big fluffy peonies everywhere", price: 2600, unit: "event", img: "flowers-peonies" },
        { id: "wild", name: "Wildflowers", blurb: "Loose, colorful, just picked", price: 1200, unit: "event", img: "flowers-wild" },
        { id: "tropical", name: "Tropical", blurb: "Orchids, monstera, birds of paradise", price: 2200, unit: "event", img: "flowers-tropical" }
      ]
    },
    {
      id: "food",
      label: "Food",
      title: "How are we feeding everyone?",
      hint: "Priced per guest, so your guest count matters here.",
      options: [
        { id: "plated", name: "Plated Dinner", blurb: "3 courses served at the table", price: 95, unit: "guest", img: "food-plated" },
        { id: "buffet", name: "Buffet Feast", blurb: "Go back for seconds (and thirds)", price: 65, unit: "guest", img: "food-buffet" },
        { id: "tapas", name: "Cocktail & Tapas", blurb: "Small bites all night long", price: 55, unit: "guest", img: "food-tapas" },
        { id: "trucks", name: "Food Trucks", blurb: "Tacos, pizza, zero stress", price: 45, unit: "guest", img: "food-trucks" }
      ]
    },
    {
      id: "cake",
      label: "Cake",
      title: "Now the fun part: cake",
      hint: "Priced per slice, one for every guest.",
      options: [
        { id: "classic", name: "Classic Tiers", blurb: "4 white tiers, pearl piping", price: 9, unit: "slice", img: "cake-classic" },
        { id: "naked", name: "Naked Cake", blurb: "Berries, figs, open layers", price: 6, unit: "slice", img: "cake-naked" },
        { id: "marble", name: "Modern Marble", blurb: "Marble fondant and gold leaf", price: 11, unit: "slice", img: "cake-marble" },
        { id: "cascade", name: "Flower Cascade", blurb: "Sugar flowers falling down", price: 13, unit: "slice", img: "cake-cascade" }
      ]
    },
    {
      id: "music",
      label: "Music",
      title: "What's the soundtrack?",
      hint: "Ceremony to last dance.",
      options: [
        { id: "dj", name: "DJ + Lights", blurb: "6 hours plus dance floor lights", price: 1500, unit: "event", img: "music-dj" },
        { id: "band", name: "Live Band", blurb: "5-piece band, 3 sets", price: 4800, unit: "event", img: "music-band" },
        { id: "strings", name: "String Quartet", blurb: "Ceremony and cocktail hour", price: 2600, unit: "event", img: "music-strings" },
        { id: "acoustic", name: "Acoustic Duo", blurb: "Guitar and vocals, chill vibes", price: 1900, unit: "event", img: "music-acoustic" }
      ]
    },
    {
      id: "photo",
      label: "Photo",
      title: "How do you want to remember it?",
      hint: "Photos, video, or both.",
      options: [
        { id: "classic", name: "Classic Photos", blurb: "8 hours plus a printed album", price: 2400, unit: "event", img: "photo-classic" },
        { id: "video", name: "Photo + Video", blurb: "Highlight film and full edit", price: 4200, unit: "event", img: "photo-video" },
        { id: "drone", name: "Cinematic + Drone", blurb: "Aerial shots, movie-style film", price: 6500, unit: "event", img: "photo-drone" },
        { id: "film", name: "35mm Film", blurb: "Real film and instant photos", price: 1800, unit: "event", img: "photo-film" }
      ]
    },
    {
      id: "extras",
      label: "Extras",
      title: "Any extras?",
      hint: "Pick as many as you want, or skip.",
      multi: true,
      optional: true,
      options: [
        { id: "bar", name: "Open Bar", blurb: "Cocktails and a champagne tower", price: 35, unit: "guest", img: "extra-bar" },
        { id: "booth", name: "Photo Booth", blurb: "Flower wall and silly props", price: 900, unit: "event", img: "extra-booth" },
        { id: "sparklers", name: "Sparkler Send-off", blurb: "Gold sparkler tunnel exit", price: 350, unit: "event", img: "extra-sparklers" },
        { id: "fireworks", name: "Fireworks Show", blurb: "5 minute gold finale", price: 3500, unit: "event", img: "extra-fireworks" },
        { id: "car", name: "Getaway Car", blurb: "Vintage convertible ride", price: 750, unit: "event", img: "extra-car" },
        { id: "painter", name: "Live Painter", blurb: "Your party, painted live", price: 1600, unit: "event", img: "extra-painter" }
      ]
    }
  ]
};
