document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const emailField = document.getElementById("txtEmail");
            const passwordField = document.getElementById("txtPassword");

            let isValid = true;

            // Validate Email
            if (emailField && !validateEmail(emailField.value.trim())) {
                alert("Please enter a valid email.");
                isValid = false;
            }

            // Validate Password
            if (passwordField && passwordField.value.trim() === "") {
                alert("Password cannot be empty.");
                isValid = false;
            }

            if (isValid) {
                // Submit the form if validation passes
                loginForm.submit();
            }
        });
    }

    const togglePassword = document.getElementById("togglePassword");
    if (togglePassword) {
        togglePassword.addEventListener("click", function () {
            const passwordField = document.getElementById("txtPassword");
            if (passwordField) {
                if (passwordField.type === "password") {
                    passwordField.type = "text";
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    passwordField.type = "password";
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
    }
});

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
