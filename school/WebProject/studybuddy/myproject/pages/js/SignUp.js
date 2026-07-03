



function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

// Function to show error messages matching the ASP.NET style
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';  // Change display to block to show the error
        element.textContent = message;    // Set the error message text
        element.style.color = 'red';      // Set the text color to red
        element.style.fontWeight = 'bold';// Make the text bold
        element.style.marginTop = '5px';  // Add some space above the error message
    } else {
        console.log(`Element with ID ${elementId} not found.`);
    }
}

// Main form validation function
function validateForm(event) {
    event.preventDefault(); // Prevent automatic form submission
    console.clear();
    let isValid = true;
    console.log("Starting form validation...");

    // Form elements
    const uNameElement = document.getElementById('uName');
    const fNameElement = document.getElementById('fName');
    const lNameElement = document.getElementById('lName');
    const emailElement = document.getElementById('email');
    const passwordElement = document.getElementById('pw');
    const passwordConfirmElement = document.getElementById('pwConfirm');

    // Trim the input to remove any leading/trailing whitespace
    const userName = uNameElement ? uNameElement.value.trim() : "";
    const firstName = fNameElement ? fNameElement.value.trim() : "";
    const lastName = lNameElement ? lNameElement.value.trim() : "";
    const email = emailElement ? emailElement.value.trim() : "";
    let password = passwordElement ? passwordElement.value.trim() : "";
    const passwordConfirm = passwordConfirmElement ? passwordConfirmElement.value.trim() : "";

    // Reset error messages
    const errorFields = ['uNameError', 'fNameError', 'lNameError', 'emailError', 'pwError', 'pwConfirmError'];
    errorFields.forEach(hideError);

    // Validate User Name (6-30 characters, allows special characters)
    if (!userName || !validateUserName(userName)) {
        showError('uNameError', "User Name must be 6-30 characters, can include special characters.");
        isValid = false;
    }

    // Validate First Name
    if (!firstName || firstName === "" || !isValidName(firstName)) {
        showError('fNameError', "First Name is required and must be 2-50 alphabetic characters.");
        isValid = false;
    }

    // Validate Last Name
    if (!lastName || lastName === "" || !isValidName(lastName)) {
        showError('lNameError', "Last Name is required and must be 2-50 alphabetic characters.");
        isValid = false;
    }

    // Validate Email
    if (!email || !validateEmail(email)) {
        showError('emailError', "Please enter a valid email address.");
        isValid = false;
    }

   

    // Validate Password
    if (!password || !isValidPassword(password)) {
        showError('pwError', "Password must be at least 6 characters.");
        isValid = false;
    }

    // Validate Confirm Password
    if (!passwordConfirm || password !== passwordConfirm) {
        showError('pwConfirmError', "Passwords do not match.");
        isValid = false;
    }
    console.log("isValid:", isValid);
    if (isValid) {
        console.log("all validated ok!");
        SendToSQL(userName, firstName, lastName, email, password);
    }

    return isValid;
}


function validateUserName(username) {
    const usernameRegex = /^[\w\u0590-\u05FF\s\W]{6,30}$/;
    return usernameRegex.test(username);
}

function isValidName(name) {
    const nameRegex = /^[A-Za-z\u0590-\u05FF]{2,50}$/;
    return nameRegex.test(name);
}

function validateEmail(email) {
    const atIndex = email.indexOf('@');
    const atLastIndex = email.lastIndexOf('@');
    if (atIndex === -1 || atIndex !== atLastIndex || atIndex < 2 || atIndex === email.length - 1) {
        return false;
    }
    const domainPart = email.slice(atIndex + 1);
    const dotIndex = domainPart.indexOf('.');
    if (dotIndex === -1 || dotIndex < 2 || dotIndex === domainPart.length - 1) {
        return false;
    }
    const emailRegex = /^[A-Za-z\u0590-\u05FF0-9@._\-]+$/;
    return emailRegex.test(email);
}


function isValidPassword(password) {
    return password.length >= 6;
}

function passwordsMatch(password, passwordConfirm) {
    return password === passwordConfirm;
}

function validateHobbies(selectedHobbies) {
    return selectedHobbies.length === 0;
}


function SendToSQL(userName, firstName, lastName, email, password) {
    let formData = new FormData();


    formData.append('userName', userName);
    formData.append('userFirstName', firstName);
    formData.append('userLastName', lastName);
    formData.append('email', email);
    formData.append('admin', 0);
    formData.append('userPassword', password);

    formData.append('formPage', 'signup');
    fetch('../aspx/SqlCode.aspx', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            if (data.includes("Signup successed!")) {

 

                window.location.href = "../aspx/HomePage.aspx";

                alert("Signup successed")
            }

            else if (data.includes("Signup failed")) {
                alert("Signup failed")
            }

            else if (data.includes("email is unique")) {
                alert("You already registered!")
            }
        })
        .catch(error => {
            console.error("Error during registration:", error);
        });
}
