const { useEffect, useMemo, useState } = React

const popularProfiles = [
  "torvalds",
  "gaearon",
  "sindresorhus",
  "yyx990803",
  "bradtraversy",
  "TheAlgorithms",
  "microsoft",
  "vercel",
]

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0)
}

function formatDate(value) {
  if (!value) return "N/A"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function readHistory() {
  try {
    const history = JSON.parse(localStorage.getItem("gh-analyzer-history") || "[]")
    return Array.isArray(history) ? history : []
  } catch (_) {
    return []
  }
}

function App() {
  const [username, setUsername] = useState("")
  const [status, setStatus] = useState("")
  const [isError, setIsError] = useState(false)
  const [user, setUser] = useState(null)
  const [repos, setRepos] = useState([])
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState("stars")
  const [history, setHistory] = useState(readHistory)
  const [summary, setSummary] = useState("Run a profile analysis first, then click \"Generate Summary\".")
  const [summarySource, setSummarySource] = useState("")
  const [summaryRepos, setSummaryRepos] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  const languages = useMemo(() => {
    const counts = {}
    repos.forEach((repo) => {
      const language = repo.language || "Other"
      counts[language] = (counts[language] || 0) + 1
    })

    const total = repos.length || 1
    return Object.entries(counts)
      .map(([language, count]) => ({
        language,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [repos])

  const insights = useMemo(() => {
    const totals = repos.reduce(
      (acc, repo) => {
        acc.stars += repo.stargazers_count || 0
        acc.forks += repo.forks_count || 0
        acc.watchers += repo.watchers_count || 0
        acc.openIssues += repo.open_issues_count || 0
        if (!repo.fork) acc.originalRepos += 1
        return acc
      },
      { stars: 0, forks: 0, watchers: 0, openIssues: 0, originalRepos: 0 },
    )

    return {
      totals,
      avgStars: repos.length ? totals.stars / repos.length : 0,
      avgForks: repos.length ? totals.forks / repos.length : 0,
      publicRepos: user?.public_repos || repos.length,
    }
  }, [repos, user])

  const filteredRepos = useMemo(() => {
    let items = [...repos]
    const filter = query.trim().toLowerCase()

    if (filter) {
      items = items.filter((repo) => repo.name.toLowerCase().includes(filter))
    }

    switch (sortBy) {
      case "forks":
        items.sort((a, b) => (b.forks_count || 0) - (a.forks_count || 0))
        break
      case "updated":
        items.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        break
      case "name":
        items.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "stars":
      default:
        items.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        break
    }

    return items.slice(0, 30)
  }, [repos, query, sortBy])

  useEffect(() => {
    localStorage.setItem("gh-analyzer-history", JSON.stringify(history.slice(0, 8)))
  }, [history])

  function showStatus(message, error = false) {
    setStatus(message)
    setIsError(error)
  }

  function saveHistory(nextUsername) {
    setHistory((current) => [nextUsername, ...current.filter((item) => item !== nextUsername)].slice(0, 8))
  }

  async function fetchGitHubData(nextUsername) {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Github-Analyzer-Web",
    }

    const [userRes, repoRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(nextUsername)}`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(nextUsername)}/repos?per_page=100`, { headers }),
    ])

    if (!userRes.ok) {
      if (userRes.status === 404) throw new Error("User not found.")
      throw new Error(`GitHub user request failed (${userRes.status}).`)
    }

    if (!repoRes.ok) {
      throw new Error(`GitHub repository request failed (${repoRes.status}).`)
    }

    const [userData, repoData] = await Promise.all([userRes.json(), repoRes.json()])
    return { userData, repoData: Array.isArray(repoData) ? repoData : [] }
  }

  async function analyzeUser(nextUsername) {
    const clean = String(nextUsername || "").trim().replace(/^@/, "")
    if (!clean) {
      showStatus("Please enter a valid username.", true)
      return
    }

    showStatus(`Analyzing ${clean} ...`)
    setUser(null)
    setRepos([])
    setSummary('Run a profile analysis first, then click "Generate Summary".')
    setSummarySource("")
    setSummaryRepos([])

    try {
      const { userData, repoData } = await fetchGitHubData(clean)
      setUser(userData)
      setRepos(repoData)
      setUsername(clean)
      saveHistory(clean)
      showStatus(`Loaded ${repoData.length} repositories for @${clean}.`)
    } catch (error) {
      showStatus(error.message || "Failed to analyze profile.", true)
    }
  }

  async function generateSummary() {
    if (!user || repos.length === 0) {
      showStatus("Analyze a profile before generating summary.", true)
      return
    }

    setSummaryLoading(true)
    setSummary("Generating AI summary...")
    setSummarySource("")
    setSummaryRepos([])

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.login,
          user: {
            login: user.login,
            name: user.name,
            bio: user.bio,
            company: user.company,
            location: user.location,
            followers: user.followers,
            following: user.following,
            public_repos: user.public_repos,
            created_at: user.created_at,
          },
          languages,
          repos,
        }),
      })

      const contentType = response.headers.get("content-type") || ""
      const isJson = contentType.toLowerCase().includes("application/json")
      const rawBody = await response.text()
      let result = {}

      if (isJson) {
        try {
          result = JSON.parse(rawBody || "{}")
        } catch (_) {
          throw new Error("Summary API returned invalid JSON. Please restart the backend and try again.")
        }
      } else {
        result = { error: rawBody }
      }

      if (!isJson) {
        throw new Error(
          "Summary API returned HTML instead of JSON. If you are using static hosting, run the Node server with npm start or deploy the backend API.",
        )
      }

      if (!response.ok) throw new Error(result.error || "Failed to generate summary.")

      setSummary(result.summary || "No summary returned.")
      setSummarySource(result.source || "gemini")
      setSummaryRepos(Array.isArray(result.repoDescriptions) ? result.repoDescriptions : [])
      if (result.source === "fallback") {
        showStatus(`Summary generated with local fallback for @${user.login}.`)
      } else {
        showStatus(`AI summary generated for @${user.login}.`)
      }
    } catch (error) {
      setSummary(error.message || "Could not generate summary.")
      setSummarySource("")
      setSummaryRepos([])
      showStatus(error.message || "Failed to generate AI summary.", true)
    } finally {
      setSummaryLoading(false)
    }
  }

  async function copyProfileUrl() {
    if (!user?.html_url) return
    try {
      await navigator.clipboard.writeText(user.html_url)
      showStatus("Profile URL copied to clipboard.")
    } catch (_) {
      showStatus("Could not copy URL. You can copy it manually.", true)
    }
  }

  function clearRecent() {
    setHistory([])
    showStatus("Search history cleared.")
  }

  return (
    <>
      <div className="bg-grid" aria-hidden="true"></div>
      <div className="bg-accent bg-accent-left" aria-hidden="true"></div>
      <div className="bg-accent bg-accent-right" aria-hidden="true"></div>

      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <img
              className="brand__photo"
              src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
              alt="GitHub"
              aria-hidden="true"
            />
            <span>GitHub Profile Analyzer</span>
          </div>
          <p className="topbar__meta">Portfolio Intelligence Dashboard</p>
        </div>
      </header>

      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Data-Driven Profile Review</p>
          <h1>Professional GitHub analysis for recruiters, teams, and developers.</h1>
          <p className="hero__subtext">
            Evaluate public repositories with structured metrics, language trends, and repository quality signals in one focused workspace.
          </p>
          <div className="hero-points" aria-label="Platform highlights">
            <span>Fast profile lookup</span>
            <span>Signal-rich metrics</span>
            <span>Share-ready insights</span>
          </div>
        </div>
        <div className="hero__actions">
          <form
            className="search-card"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault()
              analyzeUser(username)
            }}
          >
            <label htmlFor="username" className="search-card__label">
              GitHub Username
            </label>
            <div className="search-row">
              <input
                id="username"
                name="username"
                type="text"
                placeholder="e.g. torvalds"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
              <button type="submit">Analyze Profile</button>
            </div>
            <div className="inline-actions">
              <button type="button" className="ghost" onClick={() => analyzeUser(popularProfiles[Math.floor(Math.random() * popularProfiles.length)])}>
                Use sample
              </button>
              <button type="button" className="ghost" onClick={clearRecent}>
                Clear recent
              </button>
            </div>
            <p className="status" aria-live="polite" style={{ color: isError ? "#b42318" : "#0f4ea6" }}>
              {status}
            </p>
          </form>

          <section className="history-card">
            <h2>Recent Searches</h2>
            <div className="chip-row">
              {history.length === 0 ? (
                <p style={{ margin: 0, color: "#667085", fontSize: "0.9rem" }}>No recent profiles yet.</p>
              ) : (
                history.map((item) => (
                  <button key={item} type="button" className="chip" onClick={() => analyzeUser(item)}>
                    {item}
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </header>

      <main className={`dashboard ${user ? "" : "hidden"}`}>
        {user ? (
          <>
            <section className="profile-panel glass">
              <div className="profile-head">
                <img src={user.avatar_url} alt={`${user.login} avatar`} />
                <div>
                  <h2 id="name">{user.name || user.login}</h2>
                  <p id="handle">@{user.login}</p>
                  <p id="bio">{user.bio || "No bio available."}</p>
                </div>
                <div className="profile-actions">
                  <a href={user.html_url} target="_blank" rel="noreferrer">
                    Open Profile
                  </a>
                  <button type="button" onClick={copyProfileUrl}>
                    Copy URL
                  </button>
                </div>
              </div>

              <div className="quick-stats">
                {[
                  { label: "Followers", value: formatNumber(user.followers) },
                  { label: "Following", value: formatNumber(user.following) },
                  { label: "Public Repos", value: formatNumber(insights.publicRepos) },
                  { label: "Public Gists", value: formatNumber(user.public_gists) },
                ].map((stat) => (
                  <article className="stat" key={stat.label}>
                    <h4>{stat.label}</h4>
                    <p>{stat.value}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="metrics-grid">
              {[
                { label: "Total Stars", value: formatNumber(insights.totals.stars) },
                { label: "Total Forks", value: formatNumber(insights.totals.forks) },
                { label: "Average Stars / Repo", value: insights.avgStars.toFixed(1) },
                { label: "Average Forks / Repo", value: insights.avgForks.toFixed(1) },
                { label: "Top Language", value: languages[0]?.language || "N/A" },
                { label: "Original Repos", value: formatNumber(insights.totals.originalRepos) },
                { label: "Open Issues", value: formatNumber(insights.totals.openIssues) },
                { label: "Account Created", value: formatDate(user.created_at) },
              ].map((card) => (
                <article className="metric" key={card.label}>
                  <h4>{card.label}</h4>
                  <p>{card.value}</p>
                </article>
              ))}
            </section>

            <section className="glass section-block">
              <div className="section-head">
                <h3>Language Distribution</h3>
                <p>Share of public repos by primary language</p>
              </div>
              <div className="language-bars">
                {languages.length === 0 ? (
                  <p>No language data available.</p>
                ) : (
                  languages.map((item) => (
                    <div className="language-row" key={item.language}>
                      <span>{item.language}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                      <span>{item.percentage}%</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="glass section-block">
              <div className="section-head section-head--split">
                <div>
                  <h3>AI Profile Summary</h3>
                  <p>What this developer likely built and where they spend most coding effort</p>
                </div>
                <button type="button" onClick={generateSummary} disabled={summaryLoading}>
                  {summaryLoading ? "Generating..." : "Generate Summary"}
                </button>
              </div>
              <div className="summary-output">{summary}</div>
              {summarySource ? (
                <div className="summary-source-wrap">
                  <span
                    className={`summary-source-badge ${
                      summarySource === "gemini" ? "summary-source-badge--gemini" : "summary-source-badge--fallback"
                    }`}
                  >
                    {summarySource === "gemini" ? "Gemini Active" : "Fallback Mode"}
                  </span>
                </div>
              ) : null}
              {summaryRepos.length > 0 ? (
                <div className="summary-repos">
                  <h4>Repository Descriptions</h4>
                  <div className="summary-repo-list">
                    {summaryRepos.map((repo) => (
                      <article className="summary-repo-item" key={repo.name}>
                        <p>
                          <strong>{repo.name}</strong>
                        </p>
                        <p>{repo.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="glass section-block">
              <div className="section-head section-head--split">
                <div>
                  <h3>Repository Explorer</h3>
                  <p>Sort, filter, and inspect top repositories</p>
                </div>
                <div className="repo-controls">
                  <input type="text" placeholder="Filter by repo name" value={query} onChange={(event) => setQuery(event.target.value)} />
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                    <option value="stars">Most stars</option>
                    <option value="forks">Most forks</option>
                    <option value="updated">Recently updated</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>
              </div>
              <div className="repo-list">
                {filteredRepos.length === 0 ? (
                  <p>No repositories match your filter.</p>
                ) : (
                  filteredRepos.map((repo) => (
                    <article className="repo-card" key={repo.id}>
                      <div className="repo-card__head">
                        <a className="repo-name" href={repo.html_url} target="_blank" rel="noreferrer">
                          {repo.name}
                        </a>
                        <span className="repo-language">{repo.language || "Other"}</span>
                      </div>
                      <p className="repo-description">{repo.description || "No description available."}</p>
                      <div className="repo-meta">
                        <span>Stars: {formatNumber(repo.stargazers_count)}</span>
                        <span>Forks: {formatNumber(repo.forks_count)}</span>
                        <span>Updated: {formatDate(repo.updated_at)}</span>
                        <span>Issues: {formatNumber(repo.open_issues_count)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="site-footer">
        <p>
          <span className="footer-made-by">Made by</span>
          <a href="https://github.com/ZET-Technologies-Private-Limited" target="_blank" rel="noreferrer">
            ZET-Technologies-Private-Limited
          </a>
        </p>
      </footer>
    </>
  )
}

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(<App />)
