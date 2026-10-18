import os
import io
from django.core.exceptions import ValidationError
from PIL import Image

ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_receipt_image(file_obj):
    """
    Validates uploaded receipt image:
    - Must be provided
    - Max size 5 MB
    - Extension in [.jpg, .jpeg, .png, .webp]
    - Content-type in allowed MIME types
    - Image is readable and not corrupt (verified via Pillow)
    """
    if not file_obj:
        raise ValidationError("Receipt image file is required.")

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

    # 4. Integrity check with Pillow
    try:
        # Read bytes without consuming original pointer completely
        file_obj.seek(0)
        img_bytes = file_obj.read()
        file_obj.seek(0)
        
        with Image.open(io.BytesIO(img_bytes)) as img:
            img.verify()
    except Exception as e:
        raise ValidationError(f"Invalid or unreadable image file: {str(e)}")
