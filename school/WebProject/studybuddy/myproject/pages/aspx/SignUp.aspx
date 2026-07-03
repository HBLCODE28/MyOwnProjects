<%@ Page Title="Sign Up" Language="C#" AutoEventWireup="true" CodeFile="../cs/signup.aspx.cs" Inherits="MyProject.Signup" MasterPageFile="../Master/Site.Master" %>
<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <h1 class="text-center my-4">Sign Up</h1>
    <script src="../js/signup.js" type="text/javascript"></script>
    <asp:HiddenField ID="formPage" runat="server" Value="signup" />

    <div class="container my-5">


        <!-- User Name -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="uName" runat="server" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="uName">User Name</label>
            <asp:Label ID="uNameError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;" Text="User Name must be 6-30 characters" />
        </div>

        <!-- Last Name -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="lName" runat="server" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="lName">Last Name</label>
            <asp:Label ID="lNameError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;" Text="Last Name is required and must be 2-50 alphabetic characters (without space between characters)." />
        </div>

        <!-- First Name -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="fName" runat="server" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="fName">First Name</label>
            <asp:Label ID="fNameError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;" Text="First Name is required and must be 2-50 alphabetic characters." />
        </div>

        <!-- Email -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="email" runat="server" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="email">Email</label>
            <asp:Label ID="emailError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;"></asp:Label>        

        </div>




        <!-- Password -->
        <div class="form-floating mb-3 position-relative">
            <asp:TextBox ID="pw" runat="server" TextMode="Password" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="pw">Password</label>
 <button id="togglePw" type="button" class="password-toggle">
    <i class="fas fa-eye"></i>
</button>
            <asp:Label ID="pwError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;" Text="Password must be at least 6 characters." />
        </div>

        <!-- Confirm Password -->
        <div class="form-floating mb-3 position-relative">
            <asp:TextBox ID="pwConfirm" runat="server" TextMode="Password" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " />
            <label for="pwConfirm">Confirm Password</label>
<button id="togglePwConfirm" type="button" class="password-toggle">
    <i class="fas fa-eye"></i>
</button>            
            <asp:Label ID="pwConfirmError" runat="server" CssClass="badge bg-danger text-white mt-1" ClientIDMode="Static" style="display:none;" Text="Passwords do not match." />
        </div>

        <!-- Submit Button -->
        <div class="text-center">
            <asp:Button ID="btnSubmit" runat="server" CssClass="button" Text="Sign Up" OnClientClick="return validateForm(event);" />
        </div>


    </div>

    <style>
 .container {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            text-align: center;
        }


 #hobbies1 {
    margin-right: 10px;
    padding-right: 5px;
}
/* #hobbies input[type="checkbox"] {
    margin-right: 5px;
}
#hobbies label {
    margin-right: 15px;
}*/


    </style>

    <script type="text/javascript">
       
    

    function togglePasswordVisibility(toggleId, inputId) {
        const toggleElement = document.getElementById(toggleId);
        const inputElement = document.getElementById(inputId);

        if (toggleElement && inputElement) {
            toggleElement.addEventListener("click", function () {
                if (inputElement.type === "password") {
                    inputElement.type = "text";
                    toggleElement.innerHTML = '<i class="fas fa-eye-slash"></i>'; 
                } else {
                    inputElement.type = "password";
                    toggleElement.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        }
    }
    
            togglePasswordVisibility("togglePw", "<%= pw.ClientID %>");
            togglePasswordVisibility("togglePwConfirm", "<%= pwConfirm.ClientID %>");


        function checkPasswordMatch() {
            const password = document.getElementById('<%= pw.ClientID %>');
    const confirmPassword = document.getElementById('<%= pwConfirm.ClientID %>');
    const pwConfirmError = document.getElementById('<%= pwConfirmError.ClientID %>');

    if (password.value !== confirmPassword.value) {
        pwConfirmError.style.display = 'block';  
    } else {
        pwConfirmError.style.display = 'none'; 
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const password = document.getElementById('<%= pw.ClientID %>');
    const confirmPassword = document.getElementById('<%= pwConfirm.ClientID %>');

    if (password && confirmPassword) {
        password.addEventListener('input', checkPasswordMatch); 
        confirmPassword.addEventListener('input', checkPasswordMatch);  
    }
});

    </script>

</asp:Content>
