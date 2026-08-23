import subprocess
import sys

def choose_folder() -> str | None:
    if sys.platform != "win32":
        return None

    script = (
        "Add-Type -AssemblyName System.Windows.Forms; "
        "$d=New-Object System.Windows.Forms.FolderBrowserDialog; "
        "$d.Description='Choose a StreamLocal media folder'; "
        "$d.ShowNewFolderButton=$false; "
        "if($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){"
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Write-Output $d.SelectedPath}"
    )
    completed = subprocess.run(
        ["powershell", "-NoProfile", "-STA", "-Command", script],
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0:
        return None
    return completed.stdout.strip() or None
