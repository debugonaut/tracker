from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import csv
import io
from urllib.parse import urlparse

# Add parent directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from scraper import scrape_sih_2026

# On Vercel, root is read-only, /tmp is writable
STATIC_DATA_FILE = os.path.join(BASE_DIR, 'data', 'sih2026_data.json')
TMP_DATA_FILE = '/tmp/sih2026_data.json'

def get_current_data():
    if os.path.exists(TMP_DATA_FILE):
        try:
            with open(TMP_DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass

    if os.path.exists(STATIC_DATA_FILE):
        with open(STATIC_DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)

    # If neither exists, scrape live
    return scrape_and_cache()

def scrape_and_cache():
    # Set save_to_disk=False to avoid writing to read-only /var/task bundle on Vercel
    data = scrape_sih_2026(save_to_disk=False)
    try:
        with open(TMP_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        print(f"Notice: Could not cache to {TMP_DATA_FILE}: {e}")
    return data

class handler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path.endswith('/refresh'):
            self.handle_refresh()
        elif path.endswith('/stats'):
            self.handle_stats()
        elif path.endswith('/export'):
            self.handle_export()
        else:
            self.handle_data()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path.endswith('/refresh'):
            self.handle_refresh()
        else:
            self.handle_data()

    def handle_data(self):
        try:
            data = get_current_data()
            self.send_json(data)
        except Exception as e:
            self.send_json({'error': str(e)}, status=500)

    def handle_stats(self):
        try:
            data = get_current_data()
            stats = {
                'last_updated': data.get('last_updated'),
                'last_updated_human': data.get('last_updated_human'),
                'total_problem_statements': data.get('total_problem_statements'),
                'total_submissions': data.get('total_submissions'),
                'software_count': data.get('software_count'),
                'hardware_count': data.get('hardware_count'),
                'competition_stats': data.get('competition_stats')
            }
            self.send_json(stats)
        except Exception as e:
            self.send_json({'error': str(e)}, status=500)

    def handle_refresh(self):
        try:
            data = scrape_and_cache()
            self.send_json({
                'status': 'success',
                'message': f"Successfully refreshed {data.get('total_problem_statements')} problem statements.",
                'last_updated': data.get('last_updated_human'),
                'data': data
            })
        except Exception as e:
            err_msg = str(e)
            if '403' in err_msg or 'Forbidden' in err_msg:
                current_data = get_current_data()
                self.send_json({
                    'status': 'notice',
                    'message': "Notice: The official Government of India portal (sih.gov.in) restricts scraping directly from cloud servers (403 Forbidden). Live data is automatically kept up-to-date every 30 minutes by your local background sync.",
                    'data': current_data
                })
            else:
                self.send_json({'status': 'error', 'message': err_msg}, status=500)

    def handle_export(self):
        try:
            data = get_current_data()
            output = io.StringIO()
            writer = csv.writer(output)
            # Only export table columns - clean data without external Google Drive or video links
            writer.writerow([
                'PS ID', 'Title', 'Category', 'Theme', 'Organization',
                'Department', 'Submitted Ideas', 'Max Capacity', 'Slots Left',
                'Fill %', 'Competition Level', 'Deadline'
            ])
            for p in data.get('problem_statements', []):
                title = str(p.get('title', '')).replace('\r', ' ').replace('\n', ' ').strip()
                org = str(p.get('organization', '')).replace('\r', ' ').replace('\n', ' ').strip()
                dept = str(p.get('department', '') or p.get('organization', '')).replace('\r', ' ').replace('\n', ' ').strip()
                theme = str(p.get('theme', '')).replace('\r', ' ').replace('\n', ' ').strip()
                writer.writerow([
                    p.get('ps_number') or p.get('id', ''),
                    title,
                    p.get('category', ''),
                    theme,
                    org,
                    dept,
                    p.get('submitted_count', 0),
                    p.get('max_capacity', 500),
                    p.get('slots_left', 0),
                    f"{p.get('fill_percentage', 0)}%",
                    p.get('competition', ''),
                    p.get('deadline', '30 September 2026')
                ])
            csv_bytes = output.getvalue().encode('utf-8-sig')
            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Disposition', 'attachment; filename="sih2026_problem_statements.csv"')
            self.send_header('Content-Length', str(len(csv_bytes)))
            self.end_headers()
            self.wfile.write(csv_bytes)
        except Exception as e:
            self.send_json({'error': str(e)}, status=500)

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
