import os
import time
import traceback
from playwright.sync_api import sync_playwright, Page
from pydantic import BaseModel
from api.db import jobs_collection, applications_collection

class AutoApplyRequest(BaseModel):
    job_id: str
    job_url: str 
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    candidate_linkedin: str
    resume_path: str = "output/Aryan_Nishen_Enhanced_Resume.pdf" # Used as default

def fill_lever_form(page: Page, req: AutoApplyRequest):
    """Fills a Lever ATS form."""
    print("[AutoApplier] Detected Lever ATS. Waiting for form...")
    apply_btn = page.locator("a.postings-btn", has_text="Apply")
    if apply_btn.count() > 0:
        apply_btn.first.click()

    page.wait_for_selector("form#application-form")
    
    page.fill("input[name='name']", req.candidate_name)
    page.fill("input[name='email']", req.candidate_email)
    page.fill("input[name='phone']", req.candidate_phone)
    if req.candidate_linkedin:
        page.fill("input[name='urls[LinkedIn]']", req.candidate_linkedin)

    if os.path.exists(req.resume_path):
        page.set_input_files("input[type='file'][name='resume']", req.resume_path)
    else:
        print(f"[AutoApplier] WARN: Resume not found at {req.resume_path}")

    print("[AutoApplier] ✅ Form filled. Ready for submission.")
    # page.click("button.postings-btn[type='submit']")

def fill_greenhouse_form(page: Page, req: AutoApplyRequest):
    """Fills a Greenhouse ATS form."""
    print("[AutoApplier] Detected Greenhouse ATS. Waiting for form...")
    
    page.wait_for_selector("form#application_form")

    page.fill("input#first_name", req.candidate_name.split()[0])
    page.fill("input#last_name", " ".join(req.candidate_name.split()[1:]))
    page.fill("input#email", req.candidate_email)
    page.fill("input#phone", req.candidate_phone)

    if os.path.exists(req.resume_path):
        page.set_input_files("input[type='file'][name='resume']", req.resume_path)

    print("[AutoApplier] ✅ Form filled. Ready for submission.")
    # page.click("input[type='submit'][id='submit_app']")

def run_auto_applier_sync(req: AutoApplyRequest) -> dict:
    """Spins up headless Chromium to automatically map and submit a job application."""
    print(f"[AutoApplier] Launching RPA task for {req.job_url}...")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            page = context.new_page()

            page.goto(req.job_url, wait_until="networkidle")

            url_lower = req.job_url.lower()
            if "lever.co" in url_lower or page.locator("form#application-form").count() > 0:
                fill_lever_form(page, req)
                ats_type = "Lever"
            elif "greenhouse.io" in url_lower or page.locator("form#application_form").count() > 0:
                fill_greenhouse_form(page, req)
                ats_type = "Greenhouse"
            else:
                browser.close()
                return {"success": False, "error": "Unsupported ATS or form not found. Currently supports Lever and Greenhouse."}

            time.sleep(2)
            browser.close()
            
            return {"success": True, "ats": ats_type, "message": f"Successfully mapped and staged application on {ats_type}."}

    except Exception as e:
        print(f"[AutoApplier] Error during RPA sequence: {traceback.format_exc()}")
        return {"success": False, "error": repr(e)}
