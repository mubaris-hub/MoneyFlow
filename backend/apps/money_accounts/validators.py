import os
from django.core.exceptions import ValidationError

ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_receipt_file(file_obj):
    if not file_obj:
        return

    # 1. Size check
    if file_obj.size > MAX_FILE_SIZE:
        raise ValidationError("File size exceeds maximum allowed limit of 5 MB.")

    # 2. Extension check
    ext = os.path.splitext(file_obj.name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"Unsupported file format '{ext}'. Allowed formats: JPG, PNG, WEBP.")

    # 3. Content type check if available
    content_type = getattr(file_obj, 'content_type', '').lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"Invalid file content type '{content_type}'. Allowed types: JPG, PNG, WEBP.")
