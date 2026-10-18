from django.db import migrations

CATEGORIES = [
    {'id': 9, 'name': 'Education', 'icon': 'GraduationCap', 'is_system': True},
    {'id': 10, 'name': 'Healthcare', 'icon': 'HeartPulse', 'is_system': True},
]

def seed_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    for cat in CATEGORIES:
        Category.objects.get_or_create(name=cat['name'], defaults=cat)

def reverse_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    Category.objects.filter(name__in=['Education', 'Healthcare'], is_system=True).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0003_settlement'),
    ]

    operations = [
        migrations.RunPython(seed_categories, reverse_categories),
    ]
