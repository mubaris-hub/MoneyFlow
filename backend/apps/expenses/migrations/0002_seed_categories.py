from django.db import migrations

SYSTEM_CATEGORIES = [
    {'id': 1, 'name': 'Food & Dining', 'icon': 'Utensils', 'is_system': True},
    {'id': 2, 'name': 'Rent & Housing', 'icon': 'Home', 'is_system': True},
    {'id': 3, 'name': 'Utilities & Bills', 'icon': 'Zap', 'is_system': True},
    {'id': 4, 'name': 'Groceries', 'icon': 'ShoppingCart', 'is_system': True},
    {'id': 5, 'name': 'Travel & Transport', 'icon': 'Car', 'is_system': True},
    {'id': 6, 'name': 'Entertainment', 'icon': 'Film', 'is_system': True},
    {'id': 7, 'name': 'Shopping', 'icon': 'ShoppingBag', 'is_system': True},
    {'id': 8, 'name': 'General / Other', 'icon': 'Tag', 'is_system': True},
]

def seed_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    for cat in SYSTEM_CATEGORIES:
        Category.objects.get_or_create(id=cat['id'], defaults=cat)

def reverse_categories(apps, schema_editor):
    Category = apps.get_model('expenses', 'Category')
    Category.objects.filter(is_system=True).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_categories, reverse_categories),
    ]
