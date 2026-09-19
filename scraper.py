import urllib.request
import ssl
import json
import os
import re
from datetime import datetime
import lxml.html

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DATA_FILE = os.path.join(DATA_DIR, 'sih2026_data.json')
SIH_URL = 'https://sih.gov.in/sih2026PS'

def get_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def scrape_sih_2026(save_to_disk=True, target_file=None):
    """Scrapes SIH 2026 problem statements and live submissions count from sih.gov.in."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching SIH 2026 Problem Statements from {SIH_URL}...")
    import http.cookiejar
    
    cj = http.cookiejar.CookieJar()
    ctx = get_ssl_context()
    https_handler = urllib.request.HTTPSHandler(context=ctx)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), https_handler)
    
    common_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Sec-Ch-Ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    }
    
    # Step 1: Establish session on root domain to get XSRF and laravel_session
    try:
        req_root = urllib.request.Request('https://sih.gov.in/', headers=common_headers)
        with opener.open(req_root, timeout=15) as r_root:
            pass
    except Exception as e:
        print(f"Notice: Root session init failed ({e}), trying direct fetch...")

    # Step 2: Fetch the actual problem statements page with session cookies and referer
    ps_headers = dict(common_headers)
    ps_headers['Referer'] = 'https://sih.gov.in/'
    
    req = urllib.request.Request(SIH_URL, headers=ps_headers)
    with opener.open(req, timeout=30) as response:
        html = response.read().decode('utf-8', errors='ignore')
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Page fetched successfully ({len(html):,} bytes). Parsing DOM...")
    doc = lxml.html.fromstring(html)
    
    table = doc.get_element_by_id('dataTablePS', None)
    if table is None:
        raise ValueError("Could not find table #dataTablePS in SIH 2026 page!")
        
    tbody = table.find('tbody')
    if tbody is None:
        raise ValueError("Could not find tbody inside #dataTablePS")
        
    trs = tbody.xpath('./tr')
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Found {len(trs)} problem statement rows.")
    
    problem_statements = []
    
    for tr in trs:
        tds = tr.xpath('./td')
        if len(tds) < 7:
            continue
            
        sno = tds[0].text_content().strip()
        org = tds[1].text_content().strip()
        
        # In tds[2], there is title link and modal
        title_el = tds[2].xpath('.//a')
        title = title_el[0].text_content().strip() if title_el else tds[2].text_content().strip()
        # Clean title extra whitespace
        title = re.sub(r'\s+', ' ', title).strip()
        
        category = tds[3].text_content().strip()
        ps_num = tds[4].text_content().strip()
        submitted_ideas_str = tds[5].text_content().strip()
        theme = tds[6].text_content().strip()
        deadline = tds[7].text_content().strip() if len(tds) > 7 else '30 September 2026'
        
        # Parse submitted count and max capacity (e.g. "186/500")
        submitted_count = 0
        max_cap = 500
        if '/' in submitted_ideas_str:
            parts = submitted_ideas_str.split('/')
            try:
                submitted_count = int(parts[0].strip())
                max_cap = int(parts[1].strip())
            except ValueError:
                pass
        else:
            try:
                submitted_count = int(submitted_ideas_str)
            except ValueError:
                pass
                
        fill_pct = round((submitted_count / max_cap * 100), 1) if max_cap > 0 else 0
        slots_left = max(0, max_cap - submitted_count)
        
        # Competition level classification
        if submitted_count < 50:
            competition = "Low"
            competition_desc = "High Chance / Golden Opportunity"
        elif submitted_count <= 150:
            competition = "Medium"
            competition_desc = "Moderate Competition"
        elif submitted_count <= 300:
            competition = "High"
            competition_desc = "Competitive"
        else:
            competition = "Crowded"
            competition_desc = "Very High Competition"
            
        # Parse modal details (Full description, department, links)
        description = ''
        department = org
        youtube_link = ''
        dataset_link = ''
        contact_info = ''
        ps_id = ps_num.replace('SIH', '')
        
        modal = tds[2].xpath('.//div[contains(@class, "modal")]')
        if modal:
            modal_tables = modal[0].xpath('.//table[@id="settings"] | .//table')
            if modal_tables:
                for row in modal_tables[0].xpath('.//tr'):
                    header_cells = row.xpath('./th')
                    data_cells = row.xpath('./td')
                    if header_cells and data_cells:
                        h_name = header_cells[0].text_content().strip().lower()
                        d_val = data_cells[0].text_content().strip()
                        
                        if 'problem statement id' in h_name:
                            ps_id = d_val or ps_id
                        elif 'description' in h_name:
                            description = d_val
                        elif 'department' in h_name:
                            department = d_val or department
                        elif 'youtube' in h_name:
                            link = data_cells[0].xpath('.//a/@href')
                            youtube_link = link[0].strip() if link else d_val
                        elif 'dataset' in h_name:
                            link = data_cells[0].xpath('.//a/@href')
                            dataset_link = link[0].strip() if link else d_val
                        elif 'contact' in h_name:
                            contact_info = d_val
                            
        # Clean description HTML entities and extra spaces
        description = re.sub(r'&times;?', '', description)
        description = re.sub(r'\s+', ' ', description).strip()
        
        item = {
            'sno': sno,
            'id': ps_id,
            'ps_number': ps_num,
            'title': title,
            'organization': org,
            'department': department,
            'category': category,
            'theme': theme,
            'submitted_count': submitted_count,
            'max_capacity': max_cap,
            'submitted_ideas_str': submitted_ideas_str,
            'fill_percentage': fill_pct,
            'slots_left': slots_left,
            'competition': competition,
            'competition_desc': competition_desc,
            'deadline': deadline,
            'description': description,
            'youtube_link': youtube_link,
            'dataset_link': dataset_link,
            'contact_info': contact_info,
            'sih_url': f"https://sih.gov.in/sih2026PS"
        }
        problem_statements.append(item)
        
    # Aggregate statistics
    total_submissions = sum(p['submitted_count'] for p in problem_statements)
    total_capacity = sum(p['max_capacity'] for p in problem_statements)
    software_count = sum(1 for p in problem_statements if p['category'].lower() == 'software')
    hardware_count = sum(1 for p in problem_statements if p['category'].lower() == 'hardware')
    
    theme_counts = {}
    org_counts = {}
    comp_counts = {'Low': 0, 'Medium': 0, 'High': 0, 'Crowded': 0}
    
    # Load previous submission counts for delta tracking
    prev_counts = {}
    read_source = target_file if (target_file and os.path.exists(target_file)) else (DATA_FILE if os.path.exists(DATA_FILE) else None)
    if not read_source and os.path.exists('/tmp/sih2026_data.json'):
        read_source = '/tmp/sih2026_data.json'
    
    if read_source:
        try:
            with open(read_source, 'r', encoding='utf-8') as f:
                old_data = json.load(f)
                for old_p in old_data.get('problem_statements', []):
                    prev_counts[old_p['id']] = old_p.get('submitted_count', 0)
        except Exception:
            pass

    new_submissions_in_sync = 0
    active_ps_count = 0
    for p in problem_statements:
        old_count = prev_counts.get(p['id'], p['submitted_count'])
        delta = max(0, p['submitted_count'] - old_count)
        p['delta_submissions'] = delta
        p['previous_count'] = old_count
        if delta > 0:
            new_submissions_in_sync += delta
            active_ps_count += 1

        t = p['theme'] or 'Uncategorized'
        theme_counts[t] = theme_counts.get(t, 0) + 1
        
        o = p['organization'] or 'Other'
        org_counts[o] = org_counts.get(o, 0) + 1
        
        c = p['competition']
        comp_counts[c] = comp_counts.get(c, 0) + 1
        
    # Sorted rankings
    sorted_by_submissions = sorted(problem_statements, key=lambda x: x['submitted_count'], reverse=True)
    top_submitted = [{'id': p['id'], 'title': p['title'], 'count': p['submitted_count'], 'theme': p['theme']} for p in sorted_by_submissions[:5]]
    least_submitted = [{'id': p['id'], 'title': p['title'], 'count': p['submitted_count'], 'theme': p['theme']} for p in sorted_by_submissions if p['submitted_count'] >= 0][-5:]
    
    payload = {
        'last_updated': datetime.now().isoformat(),
        'last_updated_human': datetime.now().strftime('%d %B %Y, %I:%M:%S %p IST'),
        'total_problem_statements': len(problem_statements),
        'total_submissions': total_submissions,
        'total_capacity': total_capacity,
        'new_submissions_in_sync': new_submissions_in_sync,
        'active_ps_count': active_ps_count,
        'software_count': software_count,
        'hardware_count': hardware_count,
        'competition_stats': comp_counts,
        'themes_distribution': dict(sorted(theme_counts.items(), key=lambda item: item[1], reverse=True)),
        'organizations_distribution': dict(sorted(org_counts.items(), key=lambda item: item[1], reverse=True)),
        'top_submitted': top_submitted,
        'least_submitted': least_submitted,
        'problem_statements': problem_statements
    }
    
    if save_to_disk:
        dest_path = target_file if target_file else DATA_FILE
        try:
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with open(dest_path, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(problem_statements)} problem statements to {dest_path}")
        except OSError as e:
            print(f"Notice: Cannot save to {dest_path} ({e}). Trying /tmp/sih2026_data.json...")
            try:
                tmp_path = '/tmp/sih2026_data.json'
                with open(tmp_path, 'w', encoding='utf-8') as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved fallback copy to {tmp_path}")
            except Exception as e_tmp:
                print(f"Notice: Read-only environment, skipping disk cache: {e_tmp}")

    return payload

if __name__ == '__main__':
    data = scrape_sih_2026()
    print("Scraping completed successfully!")
    print(f"Total PS: {data['total_problem_statements']}, Total Submissions: {data['total_submissions']}")
