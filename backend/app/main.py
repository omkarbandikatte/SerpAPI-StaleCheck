import asyncio
from datetime import date
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .auth import AuthUser, get_current_user
from .models import CheckCreated, CheckStatus, CheckSummary, Report
from .pipeline import run_check
from .store import PostgresStore

app = FastAPI(
	title="StaleCheck API",
	description="Checks dated documents against current web evidence.",
	version="1.0.0",
)
app.add_middleware(
	CORSMiddleware,
	allow_origins=config.FRONTEND_ORIGINS,
	allow_credentials=True,
	allow_methods=["GET", "POST", "OPTIONS"],
	allow_headers=["*"],
)
store = PostgresStore(config.DATABASE_URL)
running_checks: set[asyncio.Task[None]] = set()


@app.get("/health")
async def health() -> dict[str, str]:
	return {"status": "ok"}


@app.post("/api/checks", response_model=CheckCreated, status_code=status.HTTP_202_ACCEPTED)
async def create_check(
	current_user: AuthUser = Depends(get_current_user),
	file: UploadFile | None = File(default=None),
	text: str | None = Form(default=None),
	title: str = Form(default="Untitled notes", max_length=200),
	doc_as_of: str = Form(...),
) -> CheckCreated:
	parsed_date = _validate_date(doc_as_of)
	supplied_text = text.strip() if text else ""
	if (file is None) == (not supplied_text):
		raise HTTPException(status_code=422, detail="Provide exactly one PDF file or text document.")

	document: str | bytes
	if file is not None:
		if file.content_type != "application/pdf" or not (file.filename or "").lower().endswith(".pdf"):
			raise HTTPException(status_code=415, detail="Only PDF uploads are supported.")
		document = await file.read(config.MAX_UPLOAD_BYTES + 1)
		await file.close()
		if len(document) > config.MAX_UPLOAD_BYTES:
			raise HTTPException(status_code=413, detail="PDF files must be no larger than 20 MB.")
		if not document.startswith(b"%PDF"):
			raise HTTPException(status_code=422, detail="The uploaded file is not a valid PDF.")
	else:
		if len(supplied_text) > config.MAX_DOCUMENT_CHARS:
			raise HTTPException(
				status_code=413,
				detail=f"Text must be no longer than {config.MAX_DOCUMENT_CHARS:,} characters.",
			)
		document = supplied_text

	check_id = uuid4().hex
	document_title = title.strip() or "Untitled notes"
	owner_name = current_user.name.strip() or current_user.email.strip() or "Unknown user"
	await asyncio.to_thread(
		store.create,
		check_id,
		current_user.id,
		owner_name,
		current_user.email.strip(),
		document_title,
		parsed_date,
	)
	task = asyncio.create_task(
		run_check(store, check_id, current_user.id, document_title, doc_as_of, document),
		name=f"check-{check_id}",
	)
	running_checks.add(task)
	task.add_done_callback(running_checks.discard)
	return CheckCreated(check_id=check_id)


@app.get("/api/checks", response_model=list[CheckSummary])
async def list_checks(current_user: AuthUser = Depends(get_current_user)) -> list[dict[str, object]]:
	return await asyncio.to_thread(store.list_checks, current_user.id)


@app.get("/api/checks/{check_id}", response_model=CheckStatus)
async def get_check(check_id: str, current_user: AuthUser = Depends(get_current_user)) -> CheckStatus:
	check = await asyncio.to_thread(store.get_status, check_id, current_user.id)
	if check is None:
		raise HTTPException(status_code=404, detail="Check not found.")
	return check


@app.get("/api/checks/{check_id}/report", response_model=Report)
async def get_report(check_id: str, current_user: AuthUser = Depends(get_current_user)) -> Report:
	check = await asyncio.to_thread(store.get_status, check_id, current_user.id)
	if check is None:
		raise HTTPException(status_code=404, detail="Check not found.")
	if check.status == "failed":
		raise HTTPException(status_code=409, detail=check.error or "The check failed.")
	report = await asyncio.to_thread(store.get_report, check_id, current_user.id)
	if report is None:
		raise HTTPException(status_code=409, detail="The report is not ready yet.")
	return report


def _validate_date(value: str) -> date:
	try:
		parsed = date.fromisoformat(value)
	except ValueError as error:
		raise HTTPException(status_code=422, detail="doc_as_of must be an ISO date (YYYY-MM-DD).") from error
	if parsed > date.today():
		raise HTTPException(status_code=422, detail="doc_as_of cannot be in the future.")
	return parsed
