# Github-Analyzer

## Frontend

The UI is now implemented in React JSX and mounted from `src/app.jsx`.

## Run Locally

1. Copy `.env.example` to `.env`
2. Add your Gemini key in `.env` as `GEMINI_API_KEY=...`
3. Start the app:

```bash
npm start
```

4. Open `http://localhost:3000`
5. Analyze a profile and use **Generate Summary** for the AI-written profile breakdown

## AI Summary Feature

- Analyze any GitHub username
- Click **Generate Summary** to get a structured AI explanation of:
	- what the developer likely built
	- key project themes
	- coding language focus
	- strength signals based on repository data

🚀 GitHub Analyzer
A lightweight, language-agnostic utility that scans GitHub repositories and generates actionable insights.
✨ What it does
Repository metrics – stars, forks, issues, PR velocity
Code health – file counts, language breakdown, cyclomatic complexity
Dependency audit – outdated packages, security advisories
Contributor analytics – top authors, commit timeline, bus-factor
CI & workflow checks – failing actions, flaky tests
Custom rules – plug-in architecture for new analyzers
📦 Installation
From source
bash
Copy
git clone https://github.com/your-org/github-analyzer.git
cd github-analyzer
make install       # or ./install.sh
With Docker
bash
Copy
docker pull ghcr.io/your-org/github-analyzer:latest
🏃 Usage
bash
Copy

# Scan multiple repos from a list
github-analyzer --batch repos.txt --csv summary.csv
🔧 Requirements
Python ≥ 3.9  OR  Node ≥ 18
Git ≥ 2.30
A GitHub personal-access token with repo scope (for private repos)

🤝 Contributing
Fork repo
Create feature branch (git checkout -b feat/my-idea)
Add tests & run make test
Push & open a Pull Request
