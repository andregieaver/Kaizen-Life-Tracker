"""
Simple Performance Test Script
Run with: python scripts/performance_test.py
"""
import asyncio
import aiohttp
import time
import statistics
from datetime import datetime

API_BASE = "http://localhost:8001/api"

async def make_request(session, url):
    """Make a single request and return response time in ms"""
    start = time.perf_counter()
    try:
        async with session.get(url) as response:
            await response.text()
            elapsed = (time.perf_counter() - start) * 1000
            return elapsed, response.status
    except Exception as e:
        return None, str(e)

async def run_load_test(endpoint, num_requests, concurrent=10):
    """Run load test with specified concurrency"""
    url = f"{API_BASE}{endpoint}"
    results = []
    
    connector = aiohttp.TCPConnector(limit=concurrent)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [make_request(session, url) for _ in range(num_requests)]
        results = await asyncio.gather(*tasks)
    
    times = [r[0] for r in results if r[0] is not None]
    errors = [r for r in results if r[0] is None]
    
    return {
        "endpoint": endpoint,
        "requests": num_requests,
        "concurrent": concurrent,
        "success": len(times),
        "errors": len(errors),
        "min_ms": round(min(times), 2) if times else None,
        "max_ms": round(max(times), 2) if times else None,
        "avg_ms": round(statistics.mean(times), 2) if times else None,
        "p95_ms": round(sorted(times)[int(len(times) * 0.95)] if times else 0, 2),
        "p99_ms": round(sorted(times)[int(len(times) * 0.99)] if times else 0, 2),
    }

async def main():
    print("=" * 60)
    print("KAIZEN LIFE API PERFORMANCE TEST")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 60)
    
    endpoints = [
        "/health",
        "/version",
        "/metrics",
        "/health/ready",
    ]
    
    for endpoint in endpoints:
        print(f"\nTesting {endpoint}...")
        
        # Warm up
        result = await run_load_test(endpoint, 10, concurrent=5)
        
        # Actual test
        result = await run_load_test(endpoint, 100, concurrent=20)
        
        print(f"  Requests: {result['success']}/{result['requests']}")
        print(f"  Min: {result['min_ms']}ms | Avg: {result['avg_ms']}ms | Max: {result['max_ms']}ms")
        print(f"  P95: {result['p95_ms']}ms | P99: {result['p99_ms']}ms")
        if result['errors']:
            print(f"  Errors: {result['errors']}")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
