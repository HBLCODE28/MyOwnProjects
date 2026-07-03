<%@ Page Language="C#" AutoEventWireup="true" CodeFile="../cs/LogIn.aspx.cs" Inherits="LogIn_namespace.LogIn" MasterPageFile="../Master/Site.Master" %>

<asp:Content ID="Content1" ContentPlaceHolderID="MainContent" runat="server">
    <h1 class="text-center my-4"  ForeColor="#FF6F61">Login</h1>
    <asp:Label ID="errorLabel" runat="server" ForeColor="Red" Visible="False"></asp:Label>
    <link rel="stylesheet" type="text/css" href="/css/Site.css">

    <div class="container my-5">
        <!-- Email -->
        <div class="form-floating mb-3">
            <asp:TextBox ID="txtEmail" runat="server" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " autocomplete="username"/>
            <label for="txtEmail">Email</label>
            <asp:Label ID="uEmailError" runat="server" ClientIDMode="Static" CssClass="badge bg-danger text-white mt-1" Text="Email is required." style="display:none;" />
        </div>

        <!-- Password -->
        <div class="form-floating mb-3 position-relative">
            <asp:TextBox ID="txtPassword" runat="server" TextMode="Password" CssClass="form-control slippery-snail" ClientIDMode="Static" placeholder=" " autocomplete="current-password" />
            <label for="txtPassword">Password</label>
            <button id="togglePassword" type="button" class="password-toggle">
                <i class="fas fa-eye"></i>
            </button>
            <asp:Label ID="pwError" runat="server" ClientIDMode="Static" CssClass="badge bg-danger text-white mt-1" Text="Password is required." style="display:none;" />
        </div>

        <!-- Submit Button -->
        <div class="text-center mt-3">
            <asp:Button ID="loginButton" runat="server" CssClass="button" Text="Log In" OnClientClick="loginUser(event);" />
        </div>

        <asp:ScriptManager ID="ScriptManager1" runat="server" EnablePageMethods="true" />
    </div>

    <style>
        /* עיצוב לכפתור הצגת/הסתרת סיסמה */
      /*  .password-toggle {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            background: none;
            border: none;
            color: #ff6666;
            font-size: 1.2em;
        }

        .password-toggle:hover {
            color: #cc0000;
        }*/

        .container {
            max-width: 400px;
            margin: auto;
            padding: 20px;
            text-align: center;
        }

        /*.slippery-snail {
            position: relative;
            padding: 10px;
            border: 2px solid transparent;
            background-color: #FFA49C;
            border-radius: 12px;
            transition: all 0.3s ease;
        }

        .slippery-snail:hover {
            border-color: #ff0000;
        }*/

        /* Updated Button Style */
        /*.button {
            cursor: pointer;
            position: relative;
            padding: 10px 24px;
            font-size: 18px;
            color: lightcoral;
            border: 2px solid lightcoral;
            border-radius: 34px;
            background-color: transparent;
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
            overflow: hidden;
        }

        .button::before {
            content: '';
            position: absolute;
            inset: 0;
            margin: auto;
            width: 50px;
            height: 50px;
            border-radius: inherit;
            scale: 0;
            z-index: -1;
            background-color: lightcoral;
            transition: all 0.6s cubic-bezier(0.23, 1, 0.320, 1);
        }

        .button:hover::before {
            scale: 3;
        }

        .button:hover {
            color: #212121;
            scale: 1.1;
            box-shadow: 0 0px 20px rgba(255, 102, 102, 0.4);
        }

        .button:active {
            scale: 1;
        }*/

    </style>

    <script type="text/javascript">
        document.addEventListener("DOMContentLoaded", function () {
            function togglePasswordVisibility(toggleId, inputId) {
                const toggleElement = document.getElementById(toggleId);
                const inputElement = document.getElementById(inputId);

                if (toggleElement && inputElement) {
                    toggleElement.addEventListener("click", function () {
                        inputElement.type = inputElement.type === "password" ? "text" : "password";
                        toggleElement.innerHTML = inputElement.type === "password"
                            ? '<i class="fas fa-eye"></i>'
                            : '<i class="fas fa-eye-slash"></i>';
                    });
                }
            }

            togglePasswordVisibility("togglePassword", "txtPassword");

            window.loginUser = function (event) {
                event.preventDefault();
                var Uemail = document.getElementById("txtEmail").value.trim();
                var Upassword = document.getElementById("txtPassword").value.trim();

                // בדיקת אם יש מייל וסיסמה
                if (!Uemail || !Upassword) {
                    document.getElementById("uEmailError").style.display = "block";
                    document.getElementById("pwError").style.display = "block";
                    return;
                }
                //console.log(`LoginUser called with email: ${Uemail} and password: ${Upassword}`);

                // קריאה לפונקציה ב-Server דרך AJAX
                PageMethods.Login(Uemail, Upassword, function (result) {
                    if (result === "success") {
                        alert("Login successed");
                        window.location.href = "HomePage.aspx";
                    } else {
                        alert("❌ Login failed: " + result);
                    }
                }, function (error) {
                    alert("❌ Error: " + error.get_message());
                });
            };

        });
    </script>

    <!-- Font Awesome Link -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" rel="stylesheet">
</asp:Content>
