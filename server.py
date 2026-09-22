import http.server
import socketserver
import os
import json
import csv
import io
import sys
import threading
from urllib.parse import urlparse, parse_qs
from datetime import datetime
from scraper import scrape_sih_2026, DATA_FILE, DATA_DIR

PORT = int(os.environ.get('PORT', 5050))
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

def get_data_filepath():
    candidates = [
        DATA_FILE,
        os.path.join(PUBLIC_DIR, 'data', 'sih2026_data.json'),
        '/tmp/sih2026_data.json'
    ]
    for c in candidates:
        if os.path.exists(c) and os.path.getsize(c) > 0:
            return c
    return DATA_FILE

def get_history_filepath():
    candidates = [
        os.path.join(DATA_DIR, 'history.json'),
        os.path.join(PUBLIC_DIR, 'data', 'history.json'),
        '/tmp/history.json'
    ]
    for c in candidates:
        if os.path.exists(c) and os.path.getsize(c) > 0:
            return c
    return os.path.join(DATA_DIR, 'history.json')

is_refreshing = False
refresh_lock = threading.Lock()

class SIHTrackerHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        # Add CORS and no-cache for APIs
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_HEAD(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ('/api/data', '/api/refresh', '/api/stats', '/api/export', '/api/history', '/healthz', '/api/health'):
            self.send_response(200)
            self.end_headers()
        else:
            super().do_HEAD()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ('/healthz', '/api/health'):
            self.send_json_response({'status': 'healthy', 'service': 'sih2026-tracker'})
        elif path == '/api/data':
            self.handle_get_data()
        elif path == '/api/refresh':
            self.handle_refresh()
        elif path == '/api/stats':
            self.handle_get_stats()
        elif path == '/api/history':
            self.handle_get_history()
        elif path == '/api/export':
            self.handle_export_csv()
        elif path in ('', '/'):
            self.path = '/index.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ('/api/refresh', '/refresh'):
            self.handle_refresh()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_get_data(self):
        target_file = get_data_filepath()
        if not os.path.exists(target_file):
            try:
                scrape_sih_2026()
            except Exception as e:
                self.send_json_response({'error': str(e)}, status=500)
                return

        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': f"Failed to read data: {e}"}, status=500)

    def handle_get_stats(self):
        target_file = get_data_filepath()
        if not os.path.exists(target_file):
            self.handle_get_data()
            return
            
        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            stats = {
                'last_updated': data.get('last_updated'),
                'last_updated_human': data.get('last_updated_human'),
                'total_problem_statements': data.get('total_problem_statements'),
                'total_submissions': data.get('total_submissions'),
                'software_count': data.get('software_count'),
                'hardware_count': data.get('hardware_count'),
                'competition_stats': data.get('competition_stats'),
                'top_submitted': data.get('top_submitted', [])[:5],
                'least_submitted': data.get('least_submitted', [])[:5]
            }
            self.send_json_response(stats)
        except Exception as e:
            self.send_json_response({'error': str(e)}, status=500)

    def handle_refresh(self):
        global is_refreshing
        with refresh_lock:
            if is_refreshing:
                self.send_json_response({'status': 'in_progress', 'message': 'Refresh is already running...'})
                return
            is_refreshing = True

        try:
            updated_data = scrape_sih_2026()
            self.send_json_response({
                'status': 'success',
                'message': f"Successfully refreshed data with {updated_data['total_problem_statements']} problem statements.",
                'last_updated': updated_data['last_updated_human'],
                'data': updated_data
            })
        except Exception as e:
            self.send_json_response({
                'status': 'error',
                'message': f"Scraping failed: {e}"
            }, status=500)
        finally:
            with refresh_lock:
                is_refreshing = False

    def handle_get_history(self):
        target_file = get_history_filepath()
        if not os.path.exists(target_file):
            self.send_json_response({'dates': [], 'daily_totals': {}, 'history': {}})
            return

        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': f"Failed to read history: {e}"}, status=500)

    def handle_export_csv(self):
        target_file = get_data_filepath()
        if not os.path.exists(target_file):
            self.send_error(404, "Data not found. Please refresh first.")
            return

        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            ps_list = data.get('problem_statements', [])

            # Compute strictly unique sequential ranks (duplicates ranked one below the other)
            def sort_key(x):
                sub = x.get('submitted_count', 0)
                try:
                    sno = int(x.get('sno') or 0)
                except ValueError:
                    sno = 9999
                return (-sub, sno)

            sorted_by_sub = sorted(ps_list, key=sort_key)
            ranks = {}
            for rank_idx, p_item in enumerate(sorted_by_sub, start=1):
                ranks[p_item['id']] = rank_idx

            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header - Only export table columns (no external Google Drive or video links)
            writer.writerow([
                'S.No.', 'Rank', 'PS ID', 'Problem Statement Title', 'Category', 'Theme', 'Organization',
                'Department', 'Submitted Ideas', 'Max Capacity', 'Slots Left',
                'Fill %', 'Competition Level', 'Deadline'
            ])

            for idx, p in enumerate(ps_list, start=1):
                title = str(p.get('title', '')).replace('\r', ' ').replace('\n', ' ').strip()
                org = str(p.get('organization', '')).replace('\r', ' ').replace('\n', ' ').strip()
                dept = str(p.get('department', '') or p.get('organization', '')).replace('\r', ' ').replace('\n', ' ').strip()
                theme = str(p.get('theme', '')).replace('\r', ' ').replace('\n', ' ').strip()
                rank_val = ranks.get(p.get('id'), idx)
                writer.writerow([
                    p.get('sno') or idx,
                    f"#{rank_val}",
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
            self.send_json_response({'error': str(e)}, status=500)

    def send_json_response(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(body)

def background_periodic_sync():
    import time
    while True:
        time.sleep(1800)
        try:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Periodic background sync running...")
            scrape_sih_2026()
        except Exception as e:
            print(f"Periodic background sync error: {e}")

def run_server():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # Ensure initial scrape exists
    target = get_data_filepath()
    if not os.path.exists(target):
        print("Initial data file not found. Running initial scrape...")
        try:
            scrape_sih_2026()
        except Exception as e:
            print(f"Warning: Initial scrape failed: {e}")

    # Start periodic sync thread
    sync_thread = threading.Thread(target=background_periodic_sync, daemon=True)
    sync_thread.start()

    class ThreadingTCPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    with ThreadingTCPServer(('0.0.0.0', PORT), SIHTrackerHandler) as httpd:
        print(f"\n========================================================")
        print(f"  SIH 2026 Live Tracker & Dashboard Server Running")
        print(f"  Local URL:   http://localhost:{PORT}")
        print(f"  Health Check: http://localhost:{PORT}/healthz")
        print(f"  API Data:    http://localhost:{PORT}/api/data")
        print(f"  API Refresh: http://localhost:{PORT}/api/refresh")
        print(f"  API Export:  http://localhost:{PORT}/api/export")
        print(f"========================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()

if __name__ == '__main__':
    run_server()
