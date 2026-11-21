# Aptis Study (local)

Run a local HTTP server from the repository root so that the frontend can read the existing private backup. For example, with Python installed:

```powershell
cd H:\Aptis\Aptis
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/frontend/`. Stop the server with Ctrl+C. Opening the HTML directly using `file://` does not reliably allow the browser to load JSON. Bind the server to localhost and do not deploy the private backup publicly.

Listening reads the existing source fields, answer keys, manifests, and local recordings directly. Selections and feedback remain in memory for the current page session; reloading the page clears them. Source-provided answers, explanations, and descriptions are not independently verified against all recordings.
