import http.server
import socketserver
import os
import json
import csv
import io
import sys
import threading
from urllib.parse import urlparse, parse_qs
from scraper import scrape_sih_2026, DATA_FILE, DATA_DIR

PORT = int(os.environ.get('PORT', 5050))
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), 'public')

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
        if path in ('/api/data', '/api/refresh', '/api/stats', '/api/export'):
            self.send_response(200)
            self.end_headers()
        else:
            super().do_HEAD()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/data':
            self.handle_get_data()
        elif path == '/api/refresh':
            self.handle_refresh()
        elif path == '/api/stats':
            self.handle_get_stats()
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

        if path == '/api/refresh':
            self.handle_refresh()
        else:
            self.send_error(404, "Endpoint not found")

    def handle_get_data(self):
        if not os.path.exists(DATA_FILE):
            try:
                scrape_sih_2026()
            except Exception as e:
                self.send_json_response({'error': str(e)}, status=500)
                return

        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            self.send_json_response(data)
        except Exception as e:
            self.send_json_response({'error': f"Failed to read data: {e}"}, status=500)

    def handle_get_stats(self):
        if not os.path.exists(DATA_FILE):
            self.handle_get_data()
            return
            
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
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

    def handle_export_csv(self):
        if not os.path.exists(DATA_FILE):
            self.send_error(404, "Data not found. Please refresh first.")
            return

        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)

            ps_list = data.get('problem_statements', [])
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                'PS ID', 'PS Number', 'Title', 'Category', 'Theme', 'Organization',
                'Department', 'Submitted Ideas', 'Max Capacity', 'Fill %', 'Slots Left',
                'Competition Level', 'Deadline', 'YouTube Link', 'Dataset Link'
            ])

            for p in ps_list:
                writer.writerow([
                    p.get('id', ''),
                    p.get('ps_number', ''),
                    p.get('title', ''),
                    p.get('category', ''),
                    p.get('theme', ''),
                    p.get('organization', ''),
                    p.get('department', ''),
                    p.get('submitted_count', 0),
                    p.get('max_capacity', 500),
                    f"{p.get('fill_percentage', 0)}%",
                    p.get('slots_left', 0),
                    p.get('competition', ''),
                    p.get('deadline', ''),
                    p.get('youtube_link', ''),
                    p.get('dataset_link', '')
                ])

            csv_bytes = output.getvalue().encode('utf-8')
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

def run_server():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # Ensure initial scrape exists
    if not os.path.exists(DATA_FILE):
        print("Initial data file not found. Running initial scrape...")
        try:
            scrape_sih_2026()
        except Exception as e:
            print(f"Warning: Initial scrape failed: {e}")

    class ThreadingTCPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
        allow_reuse_address = True

    with ThreadingTCPServer(('0.0.0.0', PORT), SIHTrackerHandler) as httpd:
        print(f"\n========================================================")
        print(f"  SIH 2026 Live Tracker & Dashboard Server Running")
        print(f"  Local URL:   http://localhost:{PORT}")
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
