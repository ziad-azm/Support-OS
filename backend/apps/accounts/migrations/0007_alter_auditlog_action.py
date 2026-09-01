from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_grant_audit_log_permission'),
    ]

    operations = [
        migrations.AlterField(
            model_name='auditlog',
            name='action',
            field=models.CharField(
                choices=[
                    ('user_created', 'User created'),
                    ('user_role_changed', 'User role changed'),
                    ('user_status_changed', 'User status changed'),
                    ('user_deleted', 'User deleted'),
                    ('role_created', 'Role created'),
                    ('role_renamed', 'Role renamed'),
                    ('role_permissions_changed', 'Role permissions changed'),
                    ('role_deleted', 'Role deleted'),
                ],
                max_length=30,
                verbose_name='action',
            ),
        ),
    ]
