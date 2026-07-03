<%@ Page Language="C#" AutoEventWireup="true" MasterPageFile="~/pages/Master/Site.Master" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" Runat="server">
    <h1 class="text-center my-4">Math Questions</h1>
    <link rel="stylesheet" type="text/css" href="/css/Site.css">

    <div class="container my-5">
        <!-- Random Question for the user -->
        <div class="right">
            <div id="quizSection" class="form-floating mb-3">
                <h3>Try to Solve This:</h3>
                <p id="question" class="input form-control slippery-snail" style="text-align: center;"></p>
                <input type="number" id="answerInput" class=" input form-control slippery-snail" placeholder="Enter your answer">
                <button class="button" onclick="checkAnswer()">Submit Answer</button>
            </div>
        </div>
         <a href="/pages/aspx/Calculator.aspx" class="button">
                      Regular Calculator!
                    </a>
    </div>
<style>
/* הגדרת הקונטיינר שיהיה בתצוגה אנכית */
.container {
    display: flex;
    flex-direction: column; /* הפריסה תהיה אנכית */
    justify-content: center; /* מיישר את התוכן במרכז */
    align-items: center; /* ממקם את כל התוכן במרכז */
    padding: 20px;
    width: 100%;
    max-width: 600px; /* גודל מקסימלי עבור הקונטיינר */
    margin: 0 auto;
}

/* כל תפריט יהיה בשורה נפרדת */
.left, .right {
    display: flex;
    flex-direction: column; /* כל אחד יתפוס שורה אחת */
    width: 100%; /* כל אחד יתפוס את כל רוחב הקונטיינר */
    margin-bottom: 20px; /* מרווח בין השדות */
}

input, select {
    margin: 10px 0;
    padding: 10px;
    border-radius: 10px;
    border: 2px solid #feba02;
    background-color: #f2f6fa;
    box-sizing: border-box; /* כדי להבטיח שה-padding נלקח בחשבון ברוחב */
    height: 50px; /* גובה קבוע */
    width: 60%; /* רוחב 60% */
}

/* עיצוב כותרות ופסקאות */
input, h1, p {
    margin-bottom: 20px; /* רווח בין כותרות לפסקאות */
    text-align: center;
}

/* עיצוב שדה השאלה הרנדומלית */
#quizSection {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin-top: 20px;
}

/* עיצוב השאלה והתשובה (שני השדות יהיו בעלי אותו רוחב) */
#question, #answerInput {
    width: 60%; /* רוחב אחיד של 60% */
    height: 50px; /* גובה אחיד */
    margin: 10px 0;
    padding: 10px;
    background-color: #f2f6fa;
    border: 2px solid #feba02;
    border-radius: 10px;
    text-align: center;
    box-sizing: border-box; /* כדי להבטיח שה-padding נלקח בחשבון ברוחב */
}

/* עיצוב כותרת השאלה */
#question {
    margin: 10px 0;
    padding: 10px;
    background-color: #f2f6fa;
    border: 2px solid #feba02;
    border-radius: 10px;
    width: 60%; /* רוחב 60% */
    height: 50px; /* גובה קבוע */
    text-align: center;
    box-sizing: border-box; /* כדי להבטיח שה-padding נלקח בחשבון ברוחב */
}

</style>


    <script>
        let attempts = 0;
        let correctAnswer;

        // Generate random question
        function generateQuestion() {
            const num1 = Math.floor(Math.random() * 10) + 1;
            const num2 = Math.floor(Math.random() * 10) + 1;
            const operations = ["+", "-", "*"];
            const operation = operations[Math.floor(Math.random() * operations.length)];

            switch (operation) {
                case "+":
                    correctAnswer = num1 + num2;
                    break;
                case "-":
                    correctAnswer = num1 - num2;
                    break;
                case "*":
                    correctAnswer = num1 * num2;
                    break;
            }

            document.getElementById("question").textContent = `${num1} ${operation} ${num2} = ?`;
        }

        // Check the answer entered by the user
        function checkAnswer() {
            const userAnswer = parseInt(document.getElementById("answerInput").value);

            if (userAnswer === correctAnswer) {
                alert("Correct!");
                attempts = 0;
                generateQuestion(); // Generate a new question
            } else {
                attempts++;
                if (attempts < 3) {
                    alert("Try again!");
                } else {
                    alert(`The correct answer was: ${correctAnswer}`);
                    attempts = 0;
                    generateQuestion(); // Generate a new question
                }
            }
        }



        window.onload = generateQuestion;
    </script>
</asp:Content>
