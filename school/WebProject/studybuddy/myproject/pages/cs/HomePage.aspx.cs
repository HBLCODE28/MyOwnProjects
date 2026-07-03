using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.IO;
using System.Web.UI;
using System.Web.UI.HtmlControls;

namespace Namespace
{
    public partial class HomePage : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                // קריאת נתוני המשתמש מה-Session
                //Response.Write($"<script>alert('Session FirstName: { Session["FirstName"]}  Session LastName: {Session["LastName"]}');</script>");
                //הסאשנים של שם ושם משפחה לא נשמרים
                string userName = Session["UserName"] != null ? Session["UserName"].ToString() : "";
                string firstName = Session["FirstName"] != null ? Session["FirstName"].ToString() : "";
                string lastName = Session["LastName"] != null ? Session["LastName"].ToString() : "";
                string email = Session["Email"] != null ? Session["Email"].ToString() : "";





            }
        }

        //    private void LoadTips()
        //    {
        //        string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";
        //        List<string> tips = new List<string>();

        //        using (SqlConnection connection = new SqlConnection(connectionString))
        //        {
        //            connection.Open();
        //            string query = "SELECT TipName, TipText, UserEmail, TipDate, TipRelatedFiles, TipSubject FROM Tips ORDER BY TipDate DESC";
        //            using (SqlCommand command = new SqlCommand(query, connection))
        //            {
        //                using (SqlDataReader reader = command.ExecuteReader())
        //                {
        //                    while (reader.Read())
        //                    {
        //                        string tipName = reader["TipName"].ToString();
        //                        string tipText = reader["TipText"].ToString();
        //                        string userEmail = reader["UserEmail"].ToString();
        //                        DateTime tipDate = Convert.ToDateTime(reader["TipDate"]);
        //                        string tipSubject = reader["TipSubject"].ToString();
        //                        string filePath = string.IsNullOrEmpty(reader["TipRelatedFiles"].ToString())
        //                            ? null
        //                            : ResolveUrl("../../Uploads/" + Path.GetFileName(reader["TipRelatedFiles"].ToString()));

        //                       // Response.Write($"<script>alert('filePath: {filePath} ');</script>");


        //                        string tipHtml = $@"
        //                        <div class='col-md-4'>
        //                            <div class='card mb-4 shadow-sm'>
        //                                <div class='card-body'>
        //                                    <h5 class='card-title font-weight-bold'>{tipName}</h5>";

        //                        if (!string.IsNullOrEmpty(filePath))
        //                        {
        //                            tipHtml += $"<img src='{filePath}' class='card-img-top mt-3' alt='Related image' style='width: 100%; height: auto; object-fit: cover;' />";
        //                        }

        //                        string userDisplay = string.IsNullOrEmpty(userEmail) ? "Anonymous" : userEmail;

        //                        tipHtml += $@"
        //                                    <h6 class='card-subtitle mb-2 text-muted'>By {userDisplay} - {tipDate.ToShortDateString()}</h6>
        //                                    <p class='card-text' style='color: black;'><strong>Subject:</strong> {tipSubject}</p>
        //                                    <p class='card-text' style='color: black;'>{tipText}</p>
        //                                </div>
        //                            </div>
        //                        </div>";

        //                        tips.Add(tipHtml);
        //                    }
        //                }
        //            }
        //        }

        //        HtmlGenericControl tipsContainer = (HtmlGenericControl)FindControl("TipsContainer");
        //        if (tipsContainer != null)
        //        {
        //            tipsContainer.InnerHtml = string.Join("", tips);
        //        }
        //    }

        //    //protected string GetCurrentUserEmail()
        //    //{
        //    //    return Session["UserEmail"] as string ?? "Anonymous";
        //    //}
        //}
    }
}
