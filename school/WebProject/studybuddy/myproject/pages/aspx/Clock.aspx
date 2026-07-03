<%@ Page Language="C#" AutoEventWireup="true" MasterPageFile="~/pages/Master/Site.Master" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" Runat="server">
    <div id="background-container">
        <video autoplay loop muted id="background-video">
            <source src="../../videos/backgroundVideo.mp4" type="video/mp4">
        </video>
    </div>

    <div id="clock-container">
        <h1 id="live-clock" style="color: #f2f6fa;"></h1>
        <h1 id="pomodoro-timer" style="color: #f2f6fa; display: none;"></h1>
        <button id="toggle-button" type="button"   onclick="toggleMode()">Switch to Pomodoro</button>
    </div>

    <style>
        #background-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
        }

        #background-video {
            object-fit: cover;
            width: 100%;
            height: 100%;
        }

        #clock-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(1.7);
        }

        #toggle-button {
    margin-top: 10px;
    font-size: 0.9em;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
}

    </style>

    <script>
        let isPomodoro = false;
        let pomodoroTime = 25 * 60; // 25 minutes
        let pomodoroInterval;

        document.addEventListener("DOMContentLoaded", function () {
            updateClock();
            setInterval(updateClock, 1000);
        });

        function updateClock() {
            if (!isPomodoro) {
                const now = new Date();
                let hours = now.getHours().toString().padStart(2, '0');
                let minutes = now.getMinutes().toString().padStart(2, '0');
                let seconds = now.getSeconds().toString().padStart(2, '0');
                document.getElementById("live-clock").textContent = `${hours}:${minutes}:${seconds}`;
            }
        }

        function toggleMode() {
            isPomodoro = !isPomodoro;

            const liveClock = document.getElementById("live-clock");
            const pomodoroTimer = document.getElementById("pomodoro-timer");
            const button = document.getElementById("toggle-button");

            if (isPomodoro) {
                clearInterval(pomodoroInterval);
                startPomodoro();
                liveClock.style.display = "none";
                pomodoroTimer.style.display = "block";
                button.textContent = "Switch to Clock";
            } else {
                clearInterval(pomodoroInterval);
                liveClock.style.display = "block";
                pomodoroTimer.style.display = "none";
                button.textContent = "Switch to Pomodoro";
            }
        }

        function startPomodoro() {
            let remaining = pomodoroTime;

            function updatePomodoroDisplay() {
                let minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
                let seconds = (remaining % 60).toString().padStart(2, '0');
                document.getElementById("pomodoro-timer").textContent = `${minutes}:${seconds}`;

                if (remaining > 0) {
                    remaining--;
                } else {
                    clearInterval(pomodoroInterval);
                    alert("Pomodoro finished!");
                }
            }

            updatePomodoroDisplay();
            pomodoroInterval = setInterval(updatePomodoroDisplay, 1000);
        }
    </script>
</asp:Content>
