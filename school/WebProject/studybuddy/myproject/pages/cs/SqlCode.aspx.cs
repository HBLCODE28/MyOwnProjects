using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Web;
using System.Security.Cryptography;

namespace SqlCode_namespace
    {




    public partial class Sql_code : System.Web.UI.Page
    {
        /// Hashes a plain-text password using PBKDF2 with a randomly generated salt.
        /// The resulting hash (including the salt) is returned as a Base64-encoded string.
        public static string HashPassword(string password, int saltSize = 16, int iterations = 10000)
        {
            using (var rng = new RNGCryptoServiceProvider())
            {
                // Generate salt
                byte[] salt = new byte[saltSize];
                rng.GetBytes(salt);

                // Hash the password
                using (var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations))
                {
                    byte[] hash = pbkdf2.GetBytes(32); // Derive a 256-bit key

                    // Combine salt and hash
                    byte[] hashBytes = new byte[salt.Length + hash.Length];
                    Array.Copy(salt, 0, hashBytes, 0, salt.Length);
                    Array.Copy(hash, 0, hashBytes, salt.Length, hash.Length);

                    // Convert to Base64 for storage
                    return Convert.ToBase64String(hashBytes);
                }
            }
        }

        public static bool VerifyPassword(string password, string hashedPassword, int iterations = 10000)
        {
            byte[] hashBytes = Convert.FromBase64String(hashedPassword);

            // Extract salt
            byte[] salt = new byte[16];
            Array.Copy(hashBytes, 0, salt, 0, salt.Length);

            // Hash the password provided
            using (var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations))
            {
                byte[] hash = pbkdf2.GetBytes(32); // Derive a 256-bit key

                // Compare hashes
                for (int i = 0; i < hash.Length; i++)
                {
                    if (hashBytes[i + salt.Length] != hash[i])
                    {
                        return false;
                    }
                }
            }

            return true;
        }


        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (Request.HttpMethod == "POST")
            {
                string formSource = HttpContext.Current.Request.Form["formPage"];
                Response.Write("formPage value: " + formSource + "\n");

                if (formSource == "signup")
                {
                    bool result = ProcessSignupForm();
                    if (result)
                    {
                        Response.Write("Signup successed!");
                    }

                }
             


                else if (formSource == "new tip")
                {
                    Session["userName"] = HttpContext.Current.Request.Form["userName"];
                    bool result = InsertNewTip();
                    if (result)
                    {
                      
                        Response.Write("New Tip Was Added!");
                    }
                }
            }
        }

        // פונקציה המרה של הקלט לטופס
        public static string[][] ConvertFormToParams(HttpRequest request)
        {
            List<string[]> paramList = new List<string[]>();
            foreach (string key in request.Form.Keys)
            {
                if (!string.IsNullOrWhiteSpace(request.Form[key]))
                {
                    paramList.Add(new string[] { key, request.Form[key] });
                }
            }
            return paramList.ToArray();  // שינוי ל-ToArray
        }

        private static (bool success, object result) RunQuery(string query, string[][] parms)
        {
            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand(query, con))
                {
                    if (parms != null)
                    {
                        foreach (var param in parms)
                        {
                            if (param.Length == 2)
                            {
                                cmd.Parameters.AddWithValue("@" + param[0], param[1]);


                            }
                        }
                    }

                    try
                    {
                        con.Open();
                        if (query.Trim().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
                        {
                            using (SqlDataReader reader = cmd.ExecuteReader())
                            {
                                var results = new List<Dictionary<string, object>>();
                                while (reader.Read())
                                {
                                    var row = new Dictionary<string, object>();
                                    for (int i = 0; i < reader.FieldCount; i++)
                                    {
                                        row[reader.GetName(i)] = reader.GetValue(i);
                                    }
                                    results.Add(row);
                                }
                                return (true, results);
                            }
                        }
                        else
                        {
                            int rowsAffected = cmd.ExecuteNonQuery();
                            return (rowsAffected > 0, null);
                        }
                    }
                    catch (Exception ex)
                    {
                        HttpContext.Current.Response.Write($"General Error: {ex.Message}\n");
                        return (false, null);
                    }
                }
            }
        }

       

        private Dictionary<string, string> GetUserDetailsFromDB(string email)
        {
            Dictionary<string, string> userDetails = new Dictionary<string, string>();

            // שאילתה לשליפת פרטי המשתמש
            string query = "SELECT userName , userFirstName, userLastName, email, admin FROM users WHERE email = @email";

            try
            {
                string[][] Params = new string[][] {
            new string[] { "email", email }
        };

                var queryResult = RunQuery(query, Params);

                if (queryResult.result is List<Dictionary<string, object>> results && results.Count > 0)
                {
                    var row = results[0];

                    userDetails["userName"] = row["userName"].ToString();
                    userDetails["first_name"] = row["userFirstName"].ToString();
                    userDetails["last_name"] = row["userLastName"].ToString();
                    userDetails["email"] = row["email"].ToString();
                    userDetails["admin"] = row["admin"].ToString();
                }
            }
            catch (Exception ex)
            {
                Response.Write("Error retrieving user details: " + ex.Message);
            }

            return userDetails;
        }
        private bool ProcessSignupForm()
        {
            try
            {
                // שאילתה להוספת משתמש חדש למסד הנתונים
                string query = @"INSERT INTO users (userName, userFirstName, userLastName, email, userPassword, admin)
VALUES (@userName, @userFirstName, @userLastName, @email, @userPassword, @admin);
";

                // המרת נתוני הטופס לפרמטרים
                var formParams = ConvertFormToParams(HttpContext.Current.Request);
                
                for (int i = 0; i < formParams.Length; i++)
                {
                    if (formParams[i][0].Equals("userPassword", StringComparison.OrdinalIgnoreCase))
                    {

                        formParams[i][1] = HashPassword(formParams[i][1]); // Replace with the desired new email value
                    }
                }
                
                // הרצת השאילתה
                var queryResult = RunQuery(query, formParams);

                // אם הפעולה הצליחה
                if (queryResult.success)
                {
                    // שמירת פרטי המשתמש ב-Session
                    Session["UserName"] = HttpContext.Current.Request.Form["userName"];
                    Session["FirstName"] = HttpContext.Current.Request.Form["userFirstName"];
                    Session["LastName"] = HttpContext.Current.Request.Form["userLastName"];
                    Session["Email"] = HttpContext.Current.Request.Form["email"];
                    return true;  // רישום הצליח
                }
                else
                {
                    return false;  // הרישום נכשל
                }
            }
            catch (Exception ex)
            {
                // טיפול בשגיאות והחזרת הודעה
                Response.Write("Error: " + ex.Message + "\n");
                return false;
            }
        }

        private bool InsertNewTip()
        {

            DateTime currentDate = DateTime.Now;

            string query = @"INSERT INTO tips (tip name, tip date, tip text, tip subject, tip related files,tip name,userName)
  VALUES (@tip name, @tip date, @tip text, @tip subject, @tip related files, @userName);
  ";
            var formParams = ConvertFormToParams(HttpContext.Current.Request);



            var queryResult = RunQuery(query, formParams);
            if (queryResult.success)
            {
                return true;
            }
            return false;


        }
    }
}
