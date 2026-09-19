import os
import shutil
import subprocess
from scraper import scrape_sih_2026, DATA_FILE

def sync_and_push():
    print("=== 1. Scraping latest live submissions from sih.gov.in ===")
    data = scrape_sih_2026()
    print(f"Scraped {data['total_problem_statements']} statements | {data['total_submissions']} submissions.")

    print("\n=== 2. Updating public CDN data file ===")
    public_data = os.path.join(os.path.dirname(__file__), 'public', 'data', 'sih2026_data.json')
    shutil.copy(DATA_FILE, public_data)
    print(f"Copied to {public_data}")

    print("\n=== 3. Committing and pushing to GitHub (triggers Vercel auto-deploy) ===")
    repo_dir = os.path.dirname(__file__)
    subprocess.run(['git', 'add', 'data/sih2026_data.json', 'public/data/sih2026_data.json'], cwd=repo_dir, check=True)
    msg = f"Live Sync: {data['total_submissions']} submissions as of {data['last_updated_human']}"
    subprocess.run(['git', 'commit', '-m', msg], cwd=repo_dir, check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], cwd=repo_dir, check=True)
    print("\n✅ Successfully synced and pushed to GitHub! Vercel is now deploying the newest live data.")

if __name__ == '__main__':
    sync_and_push()
