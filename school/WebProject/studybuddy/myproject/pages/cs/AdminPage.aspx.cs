using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using System.Web;
using System.IO;


namespace AdminPageNameSpace
{
    public partial class AdminPage : System.Web.UI.Page
    {
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                // הצגת פרטי המשתמש מהסשן
                string userName = Session["UserName"] != null ? Session["UserName"].ToString() : " ";
                string firstName = Session["FirstName"] != null ? Session["FirstName"].ToString() : "";
                string lastName = Session["LastName"] != null ? Session["LastName"].ToString() : "";
                string email = Session["Email"] != null ? Session["Email"].ToString() : "";
                if (Session["Admin"] != null && Convert.ToInt32(Session["Admin"]).ToString() == "1")
                {
                    showTable();
                }
                else
                {
                    LiteralTable.Visible = false;
                }
                // UserTipsLiteral.Text = showUserTips(lblEmail.InnerText);
            }
        }


        public static (bool success, object result) RunQuery(string query, string[][] parms)
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







        public void showTable()
        {
            string query = "SELECT * FROM users";

            // Run the query and get the result
            var queryResult = RunQuery(query, null).result;

            // Check if the result is not empty
            if (queryResult != null && queryResult is List<Dictionary<string, object>>)
            {
                var listOfDictionaries = queryResult as List<Dictionary<string, object>>;

                // Table and cell styles
                string tableStyle = "border-collapse: collapse; width: 100%;";
                string headerStyle = "background-color: #9bc7c7;  padding: 8px; border: 1px solid black; cursor: pointer;";
                string cellStyle = "padding: 4px; border: 1px solid black; text-align: left;";

                // Start HTML table
                StringBuilder tableHtml = new StringBuilder();
                tableHtml.Append("<br><br>Users Table");
                tableHtml.Append($"<table id='dataTable' style='{tableStyle}'>");

                // Print headers
                if (listOfDictionaries.Count > 0)
                {
                    tableHtml.Append("<tr>");
                    int columnIndex = 0;
                    foreach (var header in listOfDictionaries[0].Keys)
                    {
                        // Adding onclick to the header for sorting
                        tableHtml.Append($"<th style='{headerStyle}' onclick='sortTable({columnIndex}, \"asc\")'>{header}</th>");
                        columnIndex++;
                    }
                    tableHtml.Append("</tr>");
                }

                // Print data rows
                foreach (var dictionary in listOfDictionaries)
                {
                    tableHtml.Append("<tr>");
                    foreach (var kvp in dictionary)
                    {
                        tableHtml.Append($"<td style='{cellStyle}'>{kvp.Value}</td>");
                    }
                    tableHtml.Append("</tr>");
                }

                // End HTML table
                tableHtml.Append("</table>");

                // Display the table in the Literal control
                LiteralTable.Text = tableHtml.ToString();
            }
            else
            {
                // No results found
                LiteralTable.Text = "<p>No results found.</p>";
            }
        }

    }
}
