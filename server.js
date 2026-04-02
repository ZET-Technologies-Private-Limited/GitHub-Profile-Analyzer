const http = require("http")
const fs = require("fs")
const path = require("path")

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env")

  if (!fs.existsSync(envPath)) {
    return
  }

  const fileContents = fs.readFileSync(envPath, "utf8")
  fileContents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      return
    }

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex === -1) {
      return
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "")

    if (key && !process.env[key]) {
      process.env[key] = value
    }
  })
}

loadEnvFile()

const PORT = Number(process.env.PORT || 3000)
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
const ROOT = __dirname

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  })
  res.end(JSON.stringify(payload))
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, "")
  const filePath = path.join(ROOT, normalized)

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" })
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        sendJson(res, 404, { error: "Not found" })
        return
      }
      sendJson(res, 500, { error: "Failed to read file" })
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    })
    res.end(data)
  })
}

async function readRequestBody(req) {
  let raw = ""
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 2_000_000) {
      throw new Error("Payload too large")
    }
  }
  return raw ? JSON.parse(raw) : {}
}

function buildPrompt(payload) {
  const { username, user, repos, languages } = payload

  const cleanRepos = Array.isArray(repos)
    ? repos.slice(0, 25).map((repo) => ({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        topics: repo.topics,
        updated_at: repo.updated_at,
        homepage: repo.homepage,
      }))
    : []

  return [
    "You are an expert technical profile analyst.",
    "Given GitHub profile data, produce a concise professional summary.",
    "Focus on what the person likely built, engineering strengths, and language usage.",
    "Do not invent details that are not supported by the data.",
    "Output plain text with exactly these section headers:",
    "1) Profile Overview",
    "2) Project Work Observed",
    "3) Language Focus",
    "4) Notable Repositories",
    "5) Strength Signals",
    "Keep total length between 140 and 220 words.",
    "",
    `Username: ${username}`,
    `User data: ${JSON.stringify(user || {})}`,
    `Languages summary: ${JSON.stringify(languages || [])}`,
    `Repositories: ${JSON.stringify(cleanRepos)}`,
  ].join("\n")
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function getTopRepositories(repos, limit = 5) {
  if (!Array.isArray(repos)) {
    return []
  }

  return [...repos]
    .sort((a, b) => {
      const starDiff = toNumber(b.stargazers_count) - toNumber(a.stargazers_count)
      if (starDiff !== 0) return starDiff
      return toNumber(b.forks_count) - toNumber(a.forks_count)
    })
    .slice(0, limit)
}

function buildRepoDescriptions(repos) {
  return getTopRepositories(repos, 5).map((repo) => {
    const fallbackDescription = `Primary language: ${repo.language || "Not specified"}. Stars: ${toNumber(
      repo.stargazers_count,
    )}, forks: ${toNumber(repo.forks_count)}.`

    return {
      name: repo.name || "Unnamed repository",
      description: repo.description?.trim() || fallbackDescription,
      language: repo.language || "Other",
      stars: toNumber(repo.stargazers_count),
      forks: toNumber(repo.forks_count),
      html_url: repo.html_url || "",
    }
  })
}

function buildFallbackSummary(payload) {
  const { user, repos, languages } = payload
  const safeRepos = Array.isArray(repos) ? repos : []
  const topRepos = getTopRepositories(safeRepos, 3)
  const repoList = topRepos.map((repo) => repo.name).filter(Boolean)
  const topLanguage = Array.isArray(languages) && languages.length > 0 ? languages[0].language : "their primary language"
  const languageText =
    Array.isArray(languages) && languages.length > 0
      ? languages.map((item) => `${item.language} (${item.percentage}%)`).join(", ")
      : "No language breakdown was available."

  const totalStars = safeRepos.reduce((sum, repo) => sum + toNumber(repo.stargazers_count), 0)
  const totalForks = safeRepos.reduce((sum, repo) => sum + toNumber(repo.forks_count), 0)
  const projectText =
    repoList.length > 0
      ? `Notable repositories include ${repoList.join(", ")}.`
      : "Repository names were limited, so only general project patterns could be inferred."
  const strongestRepo = topRepos[0]
  const strongestRepoText = strongestRepo
    ? `${strongestRepo.name} appears to be a key project with ${toNumber(strongestRepo.stargazers_count)} stars and ${toNumber(
        strongestRepo.forks_count,
      )} forks.`
    : "No single standout repository could be determined from available data."

  return [
    "Profile Overview",
    `${user?.name || user?.login || "This developer"} appears to build public-facing projects with an emphasis on ${topLanguage}. The profile includes ${safeRepos.length} repositories with ${totalStars} total stars and ${totalForks} total forks.`,
    "",
    "Project Work Observed",
    projectText,
    strongestRepoText,
    "",
    "Language Focus",
    `The profile shows the strongest concentration in ${languageText}.`,
    "",
    "Notable Repositories",
    repoList.length > 0 ? repoList.join(", ") : "No standout repositories were available in the current dataset.",
    "",
    "Strength Signals",
    "Public repositories, language concentration, and starred projects suggest focused hands-on development and repeatable technical work.",
  ].join("\n")
}

async function handleSummarize(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error: "GEMINI_API_KEY is not set on the server.",
    })
    return
  }

  let payload = null

  try {
    payload = await readRequestBody(req)
    if (!payload || !payload.username || !payload.user || !Array.isArray(payload.repos)) {
      sendJson(res, 400, { error: "Invalid payload for summarization." })
      return
    }

    const repoDescriptions = buildRepoDescriptions(payload.repos)

    const prompt = buildPrompt(payload)

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
          },
        }),
      },
    )

    if (!aiRes.ok) {
      const errorText = await aiRes.text()
      if (aiRes.status === 429) {
        sendJson(res, 200, {
          summary: buildFallbackSummary(payload),
          source: "fallback",
          repoDescriptions,
        })
        return
      }

      sendJson(res, 502, {
        error: `AI request failed: ${aiRes.status}`,
        details: errorText.slice(0, 300),
      })
      return
    }

    const result = await aiRes.json()
    const summary =
      result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() ||
      "No summary generated."
    sendJson(res, 200, {
      summary,
      source: "gemini",
      repoDescriptions,
    })
  } catch (error) {
    sendJson(res, 200, {
      summary: buildFallbackSummary(payload || {}),
      source: "fallback",
      repoDescriptions: buildRepoDescriptions(payload?.repos || []),
      warning: error.message || "Summarization fell back to local analysis.",
    })
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/summarize") {
    handleSummarize(req, res)
    return
  }

  if (req.method === "GET") {
    serveStatic(req, res)
    return
  }

  sendJson(res, 405, { error: "Method not allowed" })
})

server.listen(PORT, () => {
  console.log(`GitHub Analyzer running at http://localhost:${PORT}`)
})
