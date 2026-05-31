<# JobFlow AI - Start Both Servers #>
Write-Host ""
Write-Host "  Lightning JobFlow AI - Starting Servers" -ForegroundColor Cyan
Write-Host "  =================================" -ForegroundColor DarkGray
Write-Host ""
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "  Starting FastAPI backend on port 8000..." -ForegroundColor Yellow
$fastapi = Start-Process -NoNewWindow -PassThru -FilePath "$projectRoot\.venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "api.server:app", "--reload", "--port", "8000" -WorkingDirectory $projectRoot
Start-Sleep -Seconds 2
Write-Host "  Starting Next.js frontend on port 3000..." -ForegroundColor Green
Write-Host ""
Write-Host "  Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "  API docs at http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Set-Location "$projectRoot\webapp"
npm run dev
