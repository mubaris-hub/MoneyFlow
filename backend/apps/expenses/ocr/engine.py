import os
import sys
import shutil
import logging
import tempfile
import subprocess
from django.conf import settings
from .parser import ReceiptTextParser

logger = logging.getLogger(__name__)

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WIN_OCR_SCRIPT = os.path.join(CURRENT_DIR, 'win_ocr.ps1')


class OCREngine:
    """
    Pluggable multi-strategy OCR engine:
    1. Mock engine for test suites (zero overhead, fully deterministic)
    2. Tesseract OCR (if pytesseract and tesseract binary are available)
    3. Windows Native OCR (built-in Windows.Media.Ocr via PowerShell)
    4. Graceful fallback returning empty text (handled by parser as unknown fields)
    """

    @classmethod
    def extract_text_from_file(cls, file_obj) -> str:
        # Check if mock text override is set in settings or env (useful for deterministic tests)
        mock_text = getattr(settings, 'MOCK_OCR_TEXT', None)
        if mock_text is not None:
            return mock_text

        # Create temporary file for OCR engines
        temp_file = None
        try:
            suffix = os.path.splitext(getattr(file_obj, 'name', 'receipt.png'))[1].lower() or '.png'
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tf:
                temp_file = tf.name
                file_obj.seek(0)
                shutil.copyfileobj(file_obj, tf)
                file_obj.seek(0)

            # Strategy 1: Check Tesseract
            text = cls._try_tesseract(temp_file)
            if text:
                return text

            # Strategy 2: Check Windows Native OCR
            if sys.platform == 'win32' and os.path.exists(WIN_OCR_SCRIPT):
                text = cls._try_windows_ocr(temp_file)
                if text:
                    return text

            logger.warning("No OCR provider succeeded in extracting text. Falling back to empty text.")
            return ""

        except Exception as e:
            logger.error(f"OCR extraction encountered error: {e}", exc_info=True)
            return ""
        finally:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    @classmethod
    def _try_tesseract(cls, file_path: str) -> str:
        try:
            import pytesseract
            from PIL import Image

            # Check if tesseract binary exists in PATH or setting
            tess_cmd = getattr(settings, 'TESSERACT_CMD', None)
            if tess_cmd:
                pytesseract.pytesseract.tesseract_cmd = tess_cmd

            with Image.open(file_path) as img:
                text = pytesseract.image_to_string(img)
                if text and text.strip():
                    return text.strip()
        except Exception:
            # Tesseract binary not present or failed
            pass
        return ""

    @classmethod
    def _try_windows_ocr(cls, file_path: str) -> str:
        try:
            cmd = [
                'powershell',
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', WIN_OCR_SCRIPT,
                '-ImagePath', file_path
            ]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
                check=False
            )
            if result.returncode == 0 and result.stdout:
                return result.stdout.strip()
            if result.stderr:
                logger.debug(f"Windows OCR stderr: {result.stderr.strip()}")
        except Exception as e:
            logger.debug(f"Windows OCR failed: {e}")
        return ""

    @classmethod
    def process_receipt(cls, file_obj) -> dict:
        """
        Runs OCR on uploaded receipt file and returns structured extraction data.
        """
        raw_text = cls.extract_text_from_file(file_obj)
        parser = ReceiptTextParser(raw_text)
        return parser.extract()
