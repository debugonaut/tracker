# 🇮🇳 SIH 2026 Live Submissions Tracker & Explorer

A lightweight, real-time analytics directory and scraper for **Smart India Hackathon (SIH) 2026 Problem Statements** ([sih.gov.in/sih2026PS](https://sih.gov.in/sih2026PS)).

Designed with a high-density, minimal **retro OpenSubtitles-style** interface for rapid exploration, filtering, and competition analysis.

---

## ⚡ Features

- **Live Data Scraping**: Scrapes all 240 problem statements and real-time submission numbers (e.g. `186/500`) directly from the official SIH portal.
- **Competition Analysis ("Golden Zone")**: Identifies low-competition statements ($< 50$ ideas submitted) where teams have the highest probability of qualifying.
- **Instant Search**: Real-time filtering across PS ID (e.g. `26001`), title, ministry, keywords, and themes.
- **Multi-Faceted Filters**:
  - **Category**: Software, Hardware, All
  - **Theme**: All 17+ national themes (Smart Automation, Agriculture, MedTech, etc.)
  - **Ministry / Organization**: Filter by sponsoring body (NTRO, MoES, AICTE, MDoNER, etc.)
  - **Submissions Range**: `< 50` (Low), `50-150` (Medium), `150-300` (High), `> 300` (Crowded)
  - **Sort Options**: Least Submissions First (Top Opportunities), Most Submissions, PS ID Asc/Desc, Title A-Z.
- **Full Problem Details**: Click any title to view complete Background, Problem Description, Expected Solution, and official portal links.
- **Team Bookmarking**: Save shortlisted statements locally in the browser with one click.
- **CSV Export**: Download the full filtered dataset for team collaboration in Excel / Google Sheets.
- **Zero Heavy Dependencies**: Built with standard Python libraries and pure HTML/CSS/JS.

---

## 📂 Project Structure

```
sih2026-tracker/
├── scraper.py             # Python scraper using lxml for sih.gov.in/sih2026PS
├── server.py              # Lightweight HTTP API server (port 5050)
├── requirements.txt       # Dependencies (lxml)
├── data/
│   └── sih2026_data.json  # Cached problem statements & live counts
└── public/
    ├── index.html         # Retro high-density table interface
    ├── index.css          # Classic OpenSubtitles-style CSS
    └── app.js             # Reactive client controller & filtering
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.8+
- Install dependencies:
```bash
pip install -r requirements.txt
```

### 2. Run Scraper Standalone (Optional)
To fetch or update the latest problem statements into `data/sih2026_data.json`:
```bash
python3 scraper.py
```

### 3. Start the Web Server
```bash
python3 server.py
```
Now open your browser and navigate to:
👉 **[http://localhost:5050](http://localhost:5050)**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/data` | Returns all cached problem statements and aggregate statistics |
| `POST` | `/api/refresh` | Triggers a live re-scrape from `sih.gov.in` and returns updated dataset |
| `GET` | `/api/stats` | Returns quick summary counts (Total PS, Total Submissions, Competition) |
| `GET` | `/api/export` | Downloads the current database as a CSV file |

---

## 📤 Push to GitHub

To push this repository to your GitHub account:

```bash
# 1. Open terminal in this folder
cd sih2026-tracker

# 2. Add your GitHub remote repository URL
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 3. Ensure branch is main
git branch -M main

# 4. Push code
git push -u origin main
```

---

## 📄 License
MIT License. Created for students, innovators, and teams participating in Smart India Hackathon 2026.
