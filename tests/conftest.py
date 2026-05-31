"""
Pytest configuration — adds the project root to sys.path so that
`import api.server` and `import job_scraper.*` work from the tests/ directory.

Also configures pytest-asyncio to run async tests automatically.
"""
import sys
from pathlib import Path

# Add the job_scraper root so `api.*` and `job_scraper.*` are importable
sys.path.insert(0, str(Path(__file__).parent.parent))
# Add the src dir so `job_scraper.*` resolves when running from tests/
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
