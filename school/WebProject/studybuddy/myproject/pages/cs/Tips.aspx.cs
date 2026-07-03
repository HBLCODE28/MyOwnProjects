using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.IO;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.Services;
using System.Web;

namespace Namespace
{
    public partial class Tips : Page
    {

        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                LoadTips(); // Load all tips once
            }
        }
        private static string connectionString = @"Data Source=HBL\SQLEXPRESS;Initial Catalog=demotasks_4389;Integrated Security=True;";


        protected void LoadTips()
        {
            List<string> tips = new List<string>();

            string currentUserEmail = Session["Email"]?.ToString();
            HashSet<int> likedTips = new HashSet<int>();

            // שליפת כל הטיפים שהמשתמש אהב
            if (!string.IsNullOrEmpty(currentUserEmail))
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    conn.Open();
                    using (SqlCommand cmd = new SqlCommand("SELECT TipId FROM TipLikes WHERE UserEmail = @Email", conn))
                    {
                        cmd.Parameters.AddWithValue("@Email", currentUserEmail);
                        using (SqlDataReader reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                likedTips.Add(Convert.ToInt32(reader["TipId"]));
                            }
                        }
                    }
                }
            }

            // שליפת כל הטיפים
            using (SqlConnection connection = new SqlConnection(connectionString))
            {
                connection.Open();

                string query = "SELECT TipId, TipName, TipText, UserEmail, TipDate, TipSubject, TipRelatedFiles FROM Tips ORDER BY TipDate DESC";

                using (SqlCommand command = new SqlCommand(query, connection))
                {
                    using (SqlDataReader reader = command.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            string tipName = reader["TipName"].ToString();
                            string tipText = reader["TipText"].ToString();
                            string userEmail = reader["UserEmail"].ToString();
                            DateTime tipDate = Convert.ToDateTime(reader["TipDate"]);
                            string tipSubject = reader["TipSubject"].ToString();
                            int tipId = Convert.ToInt32(reader["TipId"]);
                            string filePath = string.IsNullOrEmpty(reader["TipRelatedFiles"].ToString())
                                ? null
                                : ResolveUrl("../../Uploads/" + Path.GetFileName(reader["TipRelatedFiles"].ToString()));

                            // שליפת כמות לייקים מהטבלה TipLikes
                            int likeCount = 0;
                            using (SqlConnection countConn = new SqlConnection(connectionString))
                            {
                                countConn.Open();
                                using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", countConn))
                                {
                                    countCmd.Parameters.AddWithValue("@TipId", tipId);
                                    likeCount = (int)countCmd.ExecuteScalar();
                                }
                            }

                            string isLiked = likedTips.Contains(tipId) ? "true" : "false";

                            string tipHtml = $@"
<div class='col-md-4 tip-card mb-4' data-date='{tipDate:yyyy-MM-ddTHH:mm:ss}' data-subject='{tipSubject}'>
    <div class='card shadow-sm' style='background-color: #f2f6fa; border: 2px solid #feba02;'>
        <div class='card-body'>
            <h5 class='card-title font-weight-bold'>{tipName}</h5>";

                            if (!string.IsNullOrEmpty(filePath))
                            {
                                string fileExtension = Path.GetExtension(filePath).ToLower();
                                if (fileExtension == ".pdf")
                                {
                                    tipHtml += $"<a href='{filePath}' target='_blank'>Download PDF</a>";
                                }
                                else
                                {
                                    tipHtml += $"<img src='{filePath}' class='card-img-top mt-3' alt='Related image' style='width: 100%; height: auto; object-fit: cover;' />";
                                }
                            }

                            string userDisplay = string.IsNullOrEmpty(userEmail) ? "Anonymous" : userEmail;

                            tipHtml += $@"
            <h6 class='card-subtitle mb-2 text-muted'>
                By {userDisplay} - {tipDate:dd/MM/yyyy HH:mm}
                <button type='button' id='like-btn-{tipId}' data-likes='{likeCount}' data-liked='{isLiked}'
                    class='like-btn' style='border: none; background: none; cursor: pointer; margin-left: 10px;'
                    onclick='toggleLike({tipId})'>❤️ {likeCount}</button>
            </h6>
            <p class='card-text' style='color: black;'><strong>Subject:</strong> {tipSubject}</p>
            <p class='card-text' style='color: black;'>{tipText}</p>
        </div>
    </div>
</div>";

                            tips.Add(tipHtml);
                        }
                    }
                }
            }

            tipsContainer.InnerHtml = string.Join("", tips);
        }

        [WebMethod(EnableSession = true)]
        public static int LikeTip(int tipId)
        {
            string userEmail = HttpContext.Current.Session["Email"]?.ToString();
            if (string.IsNullOrEmpty(userEmail)) return -1;

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // נסה להוסיף לייק רק אם לא קיים
                using (SqlCommand insertCmd = new SqlCommand(@"
            IF NOT EXISTS (
                SELECT 1 FROM TipLikes WHERE UserEmail = @UserEmail AND TipId = @TipId
            )
            BEGIN
                INSERT INTO TipLikes (UserEmail, TipId) VALUES (@UserEmail, @TipId)
            END
        ", conn))
                {
                    insertCmd.Parameters.AddWithValue("@UserEmail", userEmail);
                    insertCmd.Parameters.AddWithValue("@TipId", tipId);
                    int result = insertCmd.ExecuteNonQuery();
                    if (result == 0) return -1; // כבר עשה לייק
                }

                // החזר את כמות הלייקים הנוכחית
                using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", conn))
                {
                    countCmd.Parameters.AddWithValue("@TipId", tipId);
                    return (int)countCmd.ExecuteScalar();
                }
            }
        }



        [WebMethod(EnableSession = true)]
        public static int UnlikeTip(int tipId)
        {
            string userEmail = HttpContext.Current.Session["Email"]?.ToString();
            if (string.IsNullOrEmpty(userEmail)) return -1;

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                conn.Open();

                // מחיקת הלייק
                using (SqlCommand deleteCmd = new SqlCommand("DELETE FROM TipLikes WHERE UserEmail = @UserEmail AND TipId = @TipId", conn))
                {
                    deleteCmd.Parameters.AddWithValue("@UserEmail", userEmail);
                    deleteCmd.Parameters.AddWithValue("@TipId", tipId);
                    int result = deleteCmd.ExecuteNonQuery();
                    if (result == 0) return -1; // לא היה לייק
                }

                // החזר את כמות הלייקים המעודכנת
                using (SqlCommand countCmd = new SqlCommand("SELECT COUNT(*) FROM TipLikes WHERE TipId = @TipId", conn))
                {
                    countCmd.Parameters.AddWithValue("@TipId", tipId);
                    return (int)countCmd.ExecuteScalar();
                }
            }
        }








    }
}

