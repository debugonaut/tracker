import os
import sys
import shutil
import subprocess
from datetime import datetime
from scraper import scrape_sih_2026, DATA_FILE

# Kill switch triggers on 1 October 2026 (SIH 2026 submission deadline ends 30 Sept 2026)
KILL_SWITCH_DATE = datetime(2026, 10, 1, 0, 0, 0)
LAUNCHD_PLIST = os.path.expanduser('~/Library/LaunchAgents/com.debugonaut.sihsync.plist')

def check_kill_switch(simulate_passed=False, dry_run=False):
    """
    Checks if the SIH 2026 submission deadline has passed.
    If yes, permanently deactivates the macOS launchd background agent and stops execution.
    """
    now = datetime.now()
    if now >= KILL_SWITCH_DATE or simulate_passed:
        now_str = now.strftime('%d %b %Y %I:%M %p IST')
        print(f"[{now_str}] 🛑 KILL SWITCH ACTIVATED:")
        print(f"[{now_str}] SIH 2026 idea submissions closed on 30 September 2026.")
        print(f"[{now_str}] Self-deactivating background launchd service ({LAUNCHD_PLIST})...")
        
        if dry_run:
            print(f"[{now_str}] [DRY RUN] Would execute: launchctl unload {LAUNCHD_PLIST}")
            return True

        if os.path.exists(LAUNCHD_PLIST):
            try:
                res = subprocess.run(['launchctl', 'unload', LAUNCHD_PLIST], capture_output=True, text=True, check=False)
                if res.returncode == 0:
                    print(f"[{now_str}] ✅ Successfully unloaded launch agent from macOS launchd. Zero background activity remains.")
                else:
                    print(f"[{now_str}] launchctl output: {res.stdout.strip()} {res.stderr.strip()}")
            except Exception as e:
                print(f"[{now_str}] Error unloading launch agent: {e}")
        else:
            print(f"[{now_str}] Notice: Plist file {LAUNCHD_PLIST} not found, nothing to unload.")

        print(f"[{now_str}] Automated sync is now permanently disabled. Goodbye!")
        return True
    return False

def sync_and_push():
    now_str = datetime.now().strftime('%d %b %Y %I:%M %p IST')
    
    # 1. Check Kill Switch
    if check_kill_switch():
        return

    print(f"[{now_str}] === 1. Scraping latest live submissions from sih.gov.in ===")
    try:
        data = scrape_sih_2026()
    except Exception as e:
        print(f"Scrape error: {e}")
        return

    print(f"Scraped {data['total_problem_statements']} statements | {data['total_submissions']} total submissions.")

    public_data = os.path.join(os.path.dirname(__file__), 'public', 'data', 'sih2026_data.json')
    shutil.copy(DATA_FILE, public_data)

    hist_file = os.path.join(os.path.dirname(__file__), 'data', 'history.json')
    public_hist = os.path.join(os.path.dirname(__file__), 'public', 'data', 'history.json')
    if os.path.exists(hist_file):
        shutil.copy(hist_file, public_hist)

    repo_dir = os.path.dirname(__file__)
    subprocess.run(['git', 'add', 'data/sih2026_data.json', 'public/data/sih2026_data.json', 'data/history.json', 'public/data/history.json'], cwd=repo_dir, check=True)

    # Check if there are changes staged
    diff_res = subprocess.run(['git', 'diff', '--staged', '--quiet'], cwd=repo_dir)
    if diff_res.returncode == 0:
        print(f"[{now_str}] No changes in submission counts since last sync. Skipping push.")
        return

    msg = f"Auto-Sync: {data['total_submissions']} submissions as of {data['last_updated_human']}"
    subprocess.run(['git', 'commit', '-m', msg], cwd=repo_dir, check=True)
    subprocess.run(['git', 'push', 'origin', 'main'], cwd=repo_dir, check=True)
    print(f"[{now_str}] ✅ Successfully synced and pushed to GitHub! Vercel is deploying updated data.")

if __name__ == '__main__':
    if '--test-kill-switch' in sys.argv:
        print("Testing Kill Switch logic (dry run)...")
        now = datetime.now()
        print(f"Current Date: {now.strftime('%d %b %Y %I:%M %p')}")
        print(f"Kill Switch Date: {KILL_SWITCH_DATE.strftime('%d %b %Y %I:%M %p')}")
        print(f"Triggered right now? {now >= KILL_SWITCH_DATE}")
        if now < KILL_SWITCH_DATE:
            days_left = (KILL_SWITCH_DATE - now).days
            hours_left = int((KILL_SWITCH_DATE - now).seconds / 3600)
            print(f"Days remaining until automatic self-termination: {days_left} days, {hours_left} hours.")
    else:
        sync_and_push()
