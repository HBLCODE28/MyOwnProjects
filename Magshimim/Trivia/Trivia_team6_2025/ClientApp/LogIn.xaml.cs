using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;


namespace ClientApp
{
    public partial class LogInWindow : Window
    {
        public LogInWindow()
        {
            InitializeComponent();
        }
        private void back(object sender, RoutedEventArgs e)
        {
            Utils.goToMain(this);

        }

        private void LogInButton_Click(object sender, RoutedEventArgs e)
        {
            int passwordLength = passwordInput.Password.Length;
            int userNameLength = userNameInput.Text.Length;

            if (Utils.ContainsForbiddenChars(userNameInput.Text) || Utils.ContainsForbiddenChars(passwordInput.Password))
            {
                Print.Error("Fields contain invalid characters. Please avoid using characters like: \":{}<> etc.");
                return;
            }
            if (userNameLength == 0 && passwordLength == 0)
            {
                Print.Error("Please enter your username and password.");

            }
            else if (userNameLength == 0)
            {
                Print.Error("Please enter your username.");
            }
            else if (passwordLength == 0)
            {
                Print.Error("Please enter your password.");
            }
           
            else
            {
                if (LogInToServer(userNameInput.Text, passwordInput.Password))
                {
                    Print.Welcom(userNameInput.Text, "Log In");
                    Application.Current.Properties["Username"] = userNameInput.Text;
                    Application.Current.Properties["Password"] = passwordInput.Password;
                    Application.Current.Properties["Email"] = "";
                    Utils.goToMain(this);
                }
            }

        }




        private bool LogInToServer(string userName, string password)
        {

            bool flagStatus = false;
            byte status = Utils._logInStatus;
            var message = new Dictionary<string, string>
            {

                {"username" , userName },
                {"password", password }
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
                    if (key.Contains("status"))
                    {
                            if (val == Utils._validStatusCode)
                                flagStatus = true; 
                    }
                }
                if (flagStatus)
                {
                    return true;
                }
                else
                {
                    Print.Error("Invalid username or password.");
                    return false;
                }
            }

            catch (Exception e)
            {
                Print.Error("Error communicating with server: " + e.Message);
                Utils.goToMain(this);

                return false;
            }
        }
    }
}