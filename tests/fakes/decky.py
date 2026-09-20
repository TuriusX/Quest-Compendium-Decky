import logging, os, tempfile
DECKY_PLUGIN_SETTINGS_DIR = os.environ.get("QC_TEST_SETTINGS", tempfile.mkdtemp(prefix="qc-settings-"))
DECKY_PLUGIN_VERSION = "0.1.0"
DECKY_USER = "deck"
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("decky")
