using System;
using System.Data;
using System.Data.SqlClient;
using System.Security.Cryptography;
using System.Web.Services;
using System.Web.Script.Services;
using System.Web.UI;
using System.Linq;
using System.Diagnostics;

namespace LogIn_namespace
{
    public partial class LogIn : System.Web.UI.Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        [WebMethod]
        [ScriptMethod(ResponseFormat = ResponseFormat.Json)]
        public static string Login(string email, string password)
        {
           // Page.Title = "Log In";

            //Console.WriteLine($"LoginUser called with email: {email} and password: {password}");

            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
               //Debug.WriteLine("Email or password is empty.");
                return "Email or password cannot be empty.";
            }

            bool isValid = VerifyLogin(email, password);
           //Debug.WriteLine($"Login validity check result: {isValid}");

            if (!isValid)
            {
                return "Invalid login credentials.";
            }

            try
            {
                using (SqlConnection con = new SqlConnection(connectionString))
                {
                    string query = "SELECT userFirstName, userLastName, userName, admin FROM users WHERE email = @Email";
                    using (SqlCommand cmd = new SqlCommand(query, con))
                    {
                        cmd.Parameters.Add("@Email", SqlDbType.VarChar).Value = email;
                        con.Open();
                       //Debug.WriteLine("Connection opened, executing query...");

                        using (SqlDataReader reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                // Save user details in session
                                System.Web.HttpContext.Current.Session["Email"] = email;
                                System.Web.HttpContext.Current.Session["FirstName"] = reader["userFirstName"].ToString();
                                System.Web.HttpContext.Current.Session["LastName"] = reader["userLastName"].ToString();
                                System.Web.HttpContext.Current.Session["UserName"] = reader["userName"].ToString();

                                // Check if user is admin
                                bool isAdmin = Convert.ToInt32(reader["Admin"]) == 1;
                                System.Web.HttpContext.Current.Session["Admin"] = isAdmin;

                                return "success";
                            }
                            else
                            {
                               //Debug.WriteLine("No user found with that email.");
                                return "User not found.";
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
               //Debug.WriteLine($"Error occurred: {ex.Message}");
                return "An error occurred.";
            }
        }

        //private static string GetAllUsers()
        //{
        //    try
        //    {
        //        using (SqlConnection con = new SqlConnection(connectionString))
        //        {
        //            string query = "SELECT userFirstName, userLastName, userName, email FROM users";
        //            using (SqlCommand cmd = new SqlCommand(query, con))
        //            {
        //                con.Open();
        //               //Debug.WriteLine("Connection opened, executing query to fetch all users...");

        //                using (SqlDataReader reader = cmd.ExecuteReader())
        //                {
        //                    var usersList = new System.Collections.Generic.List<string>();

        //                    while (reader.Read())
        //                    {
        //                        string user = $"Name: {reader["userFirstName"]} {reader["userLastName"]}, Username: {reader["userName"]}, Email: {reader["email"]}";
        //                        usersList.Add(user);
        //                    }

        //                    return string.Join(", ", usersList);
        //                }
        //            }
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //       //Debug.WriteLine($"Error occurred while fetching all users: {ex.Message}");
        //        return "Error occurred while fetching users.";
        //    }
        //}

        private static bool VerifyLogin(string email, string password)
        {
           //Debug.WriteLine($"Verifying login for email: {email}");

            string query = "SELECT userPassword FROM users WHERE email = @Email";

            try
            {
                using (SqlConnection con = new SqlConnection(connectionString))
                {
                    using (SqlCommand cmd = new SqlCommand(query, con))
                    {
                        cmd.Parameters.Add("@Email", SqlDbType.VarChar).Value = email;
                        con.Open();
                       //Debug.WriteLine("Connection opened, executing query...");

                        object result = cmd.ExecuteScalar();
                        if (result == null)
                        {
                           //Debug.WriteLine("No password found for the email.");
                            return false;
                        }

                        string storedPasswordHash = result.ToString();
                       //Debug.WriteLine($"Stored password hash: {storedPasswordHash}");
                        return VerifyPassword(password, storedPasswordHash);
                    }
                }
            }
            catch (Exception ex)
            {
               //Debug.WriteLine($"Error occurred: {ex.Message}");
                return false;
            }
        }

        public static bool VerifyPassword(string enteredPassword, string storedPasswordHash, int saltSize = 16, int iterations = 10000)
        {
            try
            {
                byte[] hashBytes = Convert.FromBase64String(storedPasswordHash);
               //Debug.WriteLine("Password hash successfully converted to bytes.");

                byte[] salt = new byte[saltSize];
                Array.Copy(hashBytes, 0, salt, 0, saltSize);
               //Debug.WriteLine("Salt extracted.");

                using (var pbkdf2 = new Rfc2898DeriveBytes(enteredPassword, salt, iterations))
                {
                    byte[] computedHash = pbkdf2.GetBytes(32);
                   //Debug.WriteLine("Password hash computed.");

                    byte[] storedHash = new byte[32];
                    Array.Copy(hashBytes, saltSize, storedHash, 0, 32);

                    bool isMatch = storedHash.SequenceEqual(computedHash);
                   //Debug.WriteLine($"alert(Password match result: {isMatch})");
                    return isMatch;
                }
            }
            catch (Exception ex)
            {
               //Debug.WriteLine($"Error occurred while verifying password: {ex.Message}");
                return false;
            }
        }
    }
}
