# GitHub Profile Analyzer

A professional web dashboard to analyze any public GitHub profile, explore repository metrics, and generate structured AI summaries of technical work.

## Overview

GitHub Profile Analyzer helps recruiters, hiring teams, founders, and developers quickly understand:

- what a developer is building,
- where their engineering effort is concentrated,
- which languages they use most,
- and how their repositories perform.

The project includes:

- a React JSX frontend,
- a lightweight Node.js backend,
- GitHub API data fetching,
- Gemini-powered summarization with reliable local fallback.

## Core Functionalities

### 1. Profile Analysis

- Analyze any public GitHub username.
- Fetches user profile and up to 100 repositories.
- Displays profile identity, bio, and quick account context.

### 2. Metrics Dashboard

- Followers, following, public repos, and gists.
- Total stars and forks across repositories.
- Average stars/forks per repository.
- Open issues and account creation date.
- Top language and original repository count.

### 3. Language Insights

- Language distribution bar visualization.
- Percentage share by language for top languages.

### 4. Repository Explorer

- Search repositories by name.
- Sort by stars, forks, updated date, or alphabetical order.
- Per-repository cards with:
	- description,
	- stars,
	- forks,
	- issue count,
	- updated date,
	- direct GitHub link.

### 5. AI Profile Summary

- Structured summary generated from profile and repository data.
- Summary includes:
	- Profile Overview,
	- Project Work Observed,
	- Language Focus,
	- Notable Repositories,
	- Strength Signals.
- Repository descriptions are returned and shown in the UI.
- Includes source indicator:
	- `Gemini` when API generation succeeds,
	- `Local fallback` when quota/network issues occur.

### 6. UX Enhancements

- Professional, responsive interface.
- Search history with quick reuse.
- Random sample profile button.
- Copy profile URL action.
- Branded header and footer.

## Tech Stack

- Frontend: React (JSX via browser Babel), HTML, CSS
- Backend: Node.js built-in `http` server
- External APIs:
	- GitHub REST API (profile + repositories)
	- Google Gemini API (summary generation)

## Project Structure

```text
GitHub-Analyzer/
|- index.html           # App entry (mounts React app)
|- styles.css           # Global styles and responsive design
|- src/
|  |- app.jsx           # Main React application UI + client logic
|- server.js            # Node server, static hosting, /api/summarize endpoint
|- package.json         # Scripts and project metadata
|- .env.example         # Environment variable template
|- .gitignore
|- README.md
```

## Backend API

### `POST /api/summarize`

Generates an AI summary from analyzed GitHub profile data.

Request payload includes:

- `username`
- `user`
- `languages`
- `repos`

Response includes:

- `summary`
- `source` (`gemini` or `fallback`)
- `repoDescriptions` (array of notable repos with description/context)

## Local Setup

### Prerequisites

- Node.js 18+

### 1. Clone

```bash
git clone https://github.com/ZET-Technologies-Private-Limited/GitHub-Profile-Analyzer.git
cd GitHub-Profile-Analyzer
```

### 2. Configure environment

Create `.env` from `.env.example` and set your Gemini key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```

### 3. Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Notes on Gemini Quota

If Gemini quota is exceeded, the server automatically returns a high-quality local fallback summary so the feature remains usable.

## Security Notes

- Never commit real API keys.
- Keep `.env` local and private.
- Use `.env.example` for shared configuration templates.

## Future Improvements

- Move from browser Babel JSX loading to a production build pipeline (Vite/React tooling).
- Add charts for commits and activity trends.
- Add export options for summary reports.

## Credits

Made by [ZET-Technologies-Private-Limited](https://github.com/ZET-Technologies-Private-Limited)
