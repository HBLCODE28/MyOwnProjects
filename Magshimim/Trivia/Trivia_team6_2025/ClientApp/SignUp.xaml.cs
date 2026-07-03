using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Net.Sockets;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;

namespace ClientApp
{
    
    public partial class SignUpWindow : Window
    {
       
        public SignUpWindow()
        {
            InitializeComponent();
        }
        private void back(object sender, RoutedEventArgs e)
        {
            Utils.goToMain(this);
        }
        
        private void SignUpButton_Click(object sender, RoutedEventArgs e)
        {
            int passwordLength = passwordInput.Password.Length;
            int userNameLength = userNameInput.Text.Length;
            int emailLength = emailInput.Text.Length;
            string email = emailInput.Text;
            string password = passwordInput.Password;
            string userName = userNameInput.Text;
            List<string> missingFields = new List<string>();

            if (userNameLength == 0)
            {
                missingFields.Add("username");
            }
            if (passwordLength == 0)
            {
                missingFields.Add("password");
            }
            if (emailLength == 0)
            {
                missingFields.Add("email");
            }

            if (Utils.ContainsForbiddenChars(userName) || Utils.ContainsForbiddenChars(password) || Utils.ContainsForbiddenChars(email))
            {
                Print.Error("Fields contain invalid characters. Please avoid using characters like: \":{}<> etc.");
                return;
            }

            if (missingFields.Count > 0)
            {
                string message = " ";
                if (missingFields.Count == 1)
                {
                    message = $"Please enter your {missingFields[0]}.";
                }
                else if (missingFields.Count == 2)
                {
                    message = $"Please enter your {missingFields[0]} and {missingFields[1]}.";
                }
                else
                {
                    message = $"Please enter your {string.Join(", ", missingFields.Take(missingFields.Count - 1))} and {missingFields.Last()}.";
                }
                if (message != " ")
                {
                    Print.Error(message);
                }

            }

            else
            {
                if (addUser(userName, password, email))
                {
                    Print.Welcom(userName, "Sign Up");
                    Application.Current.Properties["Username"] = userName;
                    Application.Current.Properties["Password"] = password;
                    Application.Current.Properties["Email"] = email;
                    var Main = new Main();
                    Main.Show();
                    this.Close();
                }
            }

        }


        private bool addUser(string userName, string password, string email)
        {
            bool isValid = true;
           
            isValid = SignUpToServer(userName, password, email);
          
            return isValid;
        }
        private bool SignUpToServer(string userName, string password, string email)
        {
            bool flagStatus = false;
            byte status = Utils._signUpStatus;
         

            var message = new Dictionary<string, string>
    {
        { "username", userName },
        { "password", password },
        { "email", email }
    };

            string json = Utils.DictionaryToJson(message);

            try
            {
                string response = Utils.serverRespond(status, json);


                string[] entries = response.Split(';');
                foreach (string entry in entries)
                {
                    if (!entry.Contains(":")) continue;

                    string[] parts = entry.Split(':');
                    if (parts.Length != 2) continue;

                    string key = parts[0].Trim();
                    string val = parts[1].Trim();

                    if (key.Contains("status") && val == Utils._validStatusCode)
                        flagStatus = true;
                }
            }
            catch (Exception e)
            {
                Print.Error("Error communicating with server: " + e.Message);
                Utils.goToMain(this);
            }

            return flagStatus;
        }


     
    
    }
}
