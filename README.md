# Nenne

Nenne is a simple, offline-ready web app that helps parents track three everyday rhythms: **baby sleep, feeding, and caffeine intake while breastfeeding**.

Designed for babies aged 0–24 months, Nenne provides age-based reference guides and simple timers to make everyday routines easier to manage.

The name "Nenne" is a soft baby-talk word for sleep in Japanese. I chose it for its calm sound, because rest and rhythm are what this app is about.

**[Live Demo](https://dave3625nenne.vercel.app)**

## Features

- **Sleep & Naps** — Track wake times, view suggested sleep windows, and follow a live countdown. The background colour changes as nap time comes closer; Soft blue, soft orange and purple.
- **Nursing & Formula** — Record feeds, adjust timestamps, and see when the next feed may be due.
- **Caffeine Tracker** — Log common drinks and track estimated caffeine clearance and daily intake.
- **Reference Guides** — View age-specific sleep, feeding, and caffeine information.
- **Offline & Private** — Works offline after loading and stores all data locally on your device.
- **Mobile-Friendly** — Large touch targets, a calm interface, and optional home-screen installation.


## How to Use

1. Open Nenne and enter your baby's birth month, year, and usual feeding type.
2. Record wake-ups to see suggested sleep times and countdowns.
3. Record nursing or formula feeds, adjusting timestamps when needed.
4. Log caffeinated drinks to track estimated caffeine clearance.
5. Use the menu to view reference guides, update your profile, or clear your data.

You can optionally add Nenne to your phone's home screen for an app-like experience.

## Screenshots

| Sleep | Feeding |Caffeine |
|---|---|---|
| <img src="./IMG/sleep.PNG" alt="sleep timer" width="150"/> | <img src="./IMG/feeding.PNG" alt="Feeding tracker" width="150"/>| <img src="./IMG/caffeine.PNG" alt="Caffeine tracker" width="150"/> |

| Menu | Registration | Add to Home Screen |
|---|---|---|
| <img src="./IMG/menu.PNG" alt="menu" width="150"/> | <img src="./IMG/user_input.PNG" alt="user input" width="150"/> | <img src="./IMG/Home.jpeg" alt="Home" width="150"/> |


## Privacy & Safety

- All app data is stored in the browser's `localStorage`. No app data is sent to a server.
- A service worker caches app files for offline use.
- Stored data is validated before use.
- All times use the device's local time zone and 24-hour format.

**Important:** Nenne provides general guidance, not medical advice. Sleep windows, feeding intervals, and caffeine estimates are not rules or guarantees. Every baby is different. Consult a healthcare professional if you have concerns about your baby's health, sleep, or feeding, or your caffeine intake while breastfeeding.

## Technology

Built with **HTML, CSS, and vanilla JavaScript**, without frameworks or build steps.

- `index.html` — Page structure
- `style.css` — Layout and visual design
- `app.js` — Timers, data, and application logic
- `manifest.json` — Progressive Web App (PWA) settings
- `sw.js` — Offline caching
- `icon.svg` — App icon



### Architecture

```mermaid
flowchart TD
    User["🤱 Parent"] --> Browser["Browser or home screen app"]

    subgraph Files["The five files"]
        HTML["index.html"]
        CSS["style.css"]
        JS["app.js"]
        MAN["manifest.json"]
        SW["sw.js"]
    end

    Browser --> HTML
    HTML --> CSS
    HTML --> JS
    HTML --> MAN
    Browser --> SW

    JS --> LS[("localStorage on the device")]
    SW --> CACHE[("Cache storage for offline use")]

    JS --> Clock["Clock tick every second"]
    Clock --> Render["render()"]
    Render --> UI["Cards, timers, background colour"]
```


### What happens when you record a feed

```mermaid
sequenceDiagram
    actor Parent
    participant UI as Feeding card
    participant App as app.js
    participant Store as localStorage

    Parent->>UI: Tap -5m or Edit time (optional)
    UI->>App: Save a pending time
    Parent->>UI: Tap Record Nursing or Record Formula
    UI->>App: recordFeed(type)
    App->>App: Add feed and sort by time
    App->>Store: Save cleaned data
    App->>UI: render() with the next-feed countdown
    opt Caffeine is still clearing and type is nursing
        App->>Parent: Show a caution message
    end
```

---

## About the Project

Developed for the *DAVE3625 Introduction to AI* course at OsloMet in 2026, as part of the assignment **“Vibe Coding – Build Your Own App.”**

I built Nenne after becoming a parent and wanting one simple tool to answer three everyday questions:

- When should my baby sleep next?
- When did I last feed my baby?
- Can I have another caffeinated drink?

I wanted a simple, mobile-friendly solution that could be used with one hand.

### Building with AI

The app was developed with **Claude (Free Plan, Sonnet 5.5)**. I kept the implementation simple to make the generated code easier to understand and maintain.

The process involved three rounds of revisions, mainly to refine the interface, clarify instructions, and correct behavior.


### Testing

- Testing was performed manually using Chrome and Safari to check the app's logic and layout.
- Installation on the home screen and offline functionality were also tested on a real iPhone.
- Testing on iPhone revealed a remaining issue with menu scrolling. (-> Future Improvements)


### What I Learned

- Clear, specific prompts are essential, but communicating visual intent through text alone is difficult.
- Planning the UI before coding can reduce unnecessary revisions.
- Testing on real devices is important, especially for mobile interactions and offline behavior.
- iOS home-screen icons may require a dedicated `apple-touch-icon` rather than a standard favicon.

### What I Would Do Differently Next Vibe-coding Session

- Plan before prompting: Think through the idea and design the UI before coding.

- Be specific: Use basic programming and design principles to keep the code understandable and maintainable. Write clear, precise prompts and provide visual prototypes when possible.

- Build incrementally: Add features one at a time with focused prompts.

- Expand testing across devices and browsers.

