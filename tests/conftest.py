import os
import sys
import tempfile
from pathlib import Path

# Keep test data away from your real summaries, and make the project importable.
os.environ["KASHUV_DATA"] = tempfile.mkdtemp(prefix="kashuv-test-")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
