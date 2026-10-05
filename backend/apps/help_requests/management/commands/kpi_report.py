"""Core product KPIs computed in SQL (spec §92)."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils import timezone

from apps.help_requests.models import HelpRequest


def compute_kpis(days: int | None = None) -> dict:
    qs = HelpRequest.objects.all()
    if days:
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))
    totals = qs.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status="COMPLETED")),
        with_response=Count("id", filter=Q(first_response_at__isnull=False)),
        time_to_help=Avg(
            ExpressionWrapper(F("in_progress_at") - F("created_at"), output_field=DurationField()),
            filter=Q(in_progress_at__isnull=False),
        ),
    )
    helpers = (
        qs.filter(status="COMPLETED")
        .values("selected_helper")
        .annotate(n=Count("id"))
        .aggregate(total=Count("selected_helper"), repeat=Count("selected_helper", filter=Q(n__gt=1)))
    )
    total = totals["total"] or 0
    return {
        "requests_total": total,
        "help_success_rate": round(totals["completed"] / total, 3) if total else None,
        "time_to_help_minutes": (
            round(totals["time_to_help"].total_seconds() / 60, 1) if totals["time_to_help"] else None
        ),
        "response_rate": round(totals["with_response"] / total, 3) if total else None,
        "repeat_helpers": helpers["repeat"],
        "helpers_total": helpers["total"],
    }


class Command(BaseCommand):
    help = "Print core KPIs: success rate, time to help, response rate, repeat helpers."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=None, help="Only requests created in the last N days")

    def handle(self, *args, days, **options):
        for key, value in compute_kpis(days).items():
            self.stdout.write(f"{key}: {value}")
