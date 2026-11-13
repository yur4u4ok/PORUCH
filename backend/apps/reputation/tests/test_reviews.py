import pytest

from apps.help_requests.services.lifecycle import complete_help_request
from apps.interactions.services.responses import select_helper
from apps.reputation.models import Review
from tests.factories import HelpRequestFactory, HelpResponseFactory, UserFactory


def completed():
    hr = HelpRequestFactory()
    resp = HelpResponseFactory(help_request=hr)
    select_helper(hr.author, hr.id, resp.id)
    complete_help_request(hr.author, hr.id)
    return hr, hr.author, resp.helper


def review_url(hr):
    return f"/api/v1/help-requests/{hr.id}/reviews/"


@pytest.mark.django_db
class TestReviews:
    def test_both_sides_review_and_it_shows_on_profiles(self, make_client, no_push):
        hr, author, helper = completed()
        author_client, helper_client = make_client(author), make_client(helper)
        detail = author_client.get(f"/api/v1/help-requests/{hr.id}/").data
        assert detail["reviews_to_leave"] == [{"user": detail["reviews_to_leave"][0]["user"], "reviewed": False}]

        r = author_client.post(review_url(hr), {"to_user": str(helper.id), "rating": 5, "text": "Супер"}, format="json")
        assert r.status_code == 201
        r = helper_client.post(review_url(hr), {"to_user": str(author.id), "rating": 4}, format="json")
        assert r.status_code == 201

        assert author_client.get(f"/api/v1/help-requests/{hr.id}/").data["reviews_to_leave"][0]["reviewed"] is True
        profile = author_client.get(f"/api/v1/users/{helper.id}/").data
        assert profile["rating"] == 5.0 and profile["reviews_count"] == 1
        reviews = author_client.get(f"/api/v1/users/{helper.id}/reviews/").data["results"]
        assert reviews[0]["text"] == "Супер" and reviews[0]["rating"] == 5

    def test_one_review_per_person_and_no_way_to_remove_it(self, make_client, no_push):
        hr, author, helper = completed()
        client = make_client(author)
        client.post(review_url(hr), {"to_user": str(helper.id), "rating": 2}, format="json")
        again = client.post(review_url(hr), {"to_user": str(helper.id), "rating": 5}, format="json")
        assert again.status_code == 409
        review = Review.objects.get()
        helper_client = make_client(helper)
        for method in (helper_client.delete, helper_client.patch, helper_client.put):
            assert method(f"/api/v1/users/{helper.id}/reviews/{review.id}/").status_code in (404, 405)
        assert Review.objects.count() == 1

    def test_only_partners_after_completion(self, make_client, no_push):
        hr, author, helper = completed()
        stranger = make_client(UserFactory())
        r = stranger.post(review_url(hr), {"to_user": str(helper.id), "rating": 5}, format="json")
        assert r.status_code == 403
        open_request = HelpRequestFactory()
        r = make_client(open_request.author).post(
            review_url(open_request), {"to_user": str(helper.id), "rating": 5}, format="json"
        )
        assert r.status_code in (400, 409)
        bad = make_client(author).post(review_url(hr), {"to_user": str(helper.id), "rating": 6}, format="json")
        assert bad.status_code == 400
