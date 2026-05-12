"""
Views for serving legal pages (Terms of Service, Privacy Policy).
These are public-facing HTML pages, not API endpoints.
"""

from django.views.generic import TemplateView


class TermsOfServiceView(TemplateView):
    template_name = "legal/terms.html"


class PrivacyPolicyView(TemplateView):
    template_name = "legal/privacy.html"
