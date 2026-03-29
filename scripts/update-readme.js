const fs = require("fs");
const https = require("https");

const USERNAME = "rpkrupali1";
const README_PATH = "README.md";
const MAX_REPOS = 8;

// Add org names here to include their repos in your profile
const ORGS = ["QualityStackAI"];

// Override GitHub's auto-detected language when it's wrong
// (e.g., a large HTML report makes GitHub think a Python repo is HTML)
const LANGUAGE_OVERRIDES = {
  applied_data_science_learning_sales_analysis: "Python",
};

// Language -> shield badge color mapping
const LANG_COLORS = {
  JavaScript: { color: "F7DF1E", logoColor: "black" },
  TypeScript: { color: "3178C6", logoColor: "white" },
  Python: { color: "3776AB", logoColor: "white" },
  Java: { color: "ED8B00", logoColor: "white" },
  "Jupyter Notebook": { color: "F37626", logoColor: "white", logo: "jupyter", label: "Jupyter" },
  HTML: { color: "E34F26", logoColor: "white", logo: "html5", label: "HTML" },
  CSS: { color: "1572B6", logoColor: "white", logo: "css3", label: "CSS" },
  Shell: { color: "4EAA25", logoColor: "white", logo: "gnubash", label: "Shell" },
  HCL: { color: "844FBA", logoColor: "white", logo: "terraform", label: "Terraform" },
  Mustache: { color: "FF8000", logoColor: "white" },
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "readme-updater" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

function langBadge(lang) {
  if (!lang) return "";
  const info = LANG_COLORS[lang] || { color: "555", logoColor: "white" };
  const logo = info.logo || lang.toLowerCase().replace(/\s+/g, "");
  const label = info.label || lang;
  return `![${label}](https://img.shields.io/badge/-${encodeURIComponent(label)}-${info.color}?style=flat-square&logo=${logo}&logoColor=${info.logoColor})`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

async function main() {
  // Fetch personal repos
  const userRepos = await fetchJSON(
    `https://api.github.com/users/${USERNAME}/repos?sort=pushed&direction=desc&per_page=50&type=owner`
  );

  // Fetch repos from each org
  const orgRepoArrays = await Promise.all(
    ORGS.map((org) =>
      fetchJSON(
        `https://api.github.com/orgs/${org}/repos?sort=pushed&direction=desc&per_page=20`
      ).catch(() => {
        console.warn(`Warning: Could not fetch repos for org "${org}"`);
        return [];
      })
    )
  );

  // Merge all repos, sort by most recently pushed
  const allRepos = [...userRepos, ...orgRepoArrays.flat()];
  allRepos.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  const filtered = allRepos
    .filter((r) => !r.fork && r.name !== USERNAME)
    .slice(0, MAX_REPOS);

  // Build the table rows
  const rows = filtered.map((r) => {
    const name = `[${r.name}](${r.html_url})`;
    const desc = r.description || "—";
    const actualLang = LANGUAGE_OVERRIDES[r.name] || r.language;
    const lang = langBadge(actualLang);
    const updated = formatDate(r.pushed_at);
    return `| ${name} | ${desc} | ${lang} | ${updated} |`;
  });

  const tableContent = [
    "| Project | Description | Language | Updated |",
    "|---------|-------------|----------|---------|",
    ...rows,
  ].join("\n");

  // Read README and replace between markers
  let readme = fs.readFileSync(README_PATH, "utf8");

  const startMarker = "<!-- RECENT_REPOS:START -->";
  const endMarker = "<!-- RECENT_REPOS:END -->";
  const startIdx = readme.indexOf(startMarker);
  const endIdx = readme.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find RECENT_REPOS markers in README.md");
    process.exit(1);
  }

  const before = readme.slice(0, startIdx + startMarker.length);
  const after = readme.slice(endIdx);

  readme = `${before}\n${tableContent}\n${after}`;

  fs.writeFileSync(README_PATH, readme, "utf8");
  console.log(`Updated README with ${filtered.length} recently updated repos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
